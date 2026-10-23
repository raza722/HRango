import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'

import { COLUMN_LABELS } from '../../constants'
import type {
  PmPerson,
  Tag,
  TaskColumnKey,
  TaskRow,
  TaskType,
  Workspace,
  WorkspaceTree,
} from '../../types/pm.types'
import { type ColumnAction, ListViewContext, type ListViewContextValue } from './list-context'
import {
  childrenByParent,
  deleteColumn,
  groupByStatus,
  hideColumn,
  type ListSort,
  moveColumn,
  orderForMove,
  showColumn,
  topLevel,
  visibleColumns,
} from './list-utils'
import { RolePermissionDialog } from './role-permission-dialog'
import { StatusGroup } from './status-group'
import { useTaskActions } from './use-task-actions'
import { useWorkspacePatch } from './use-workspace-patch'

export interface Composer {
  statusId: string
  type: TaskType
}

/**
 * The List view (Workspace Page 1:2755): tasks grouped by the workspace's statuses, with the
 * column headers, sorting, the header menu and the row menus.
 */
export function ListView({
  workspace,
  tree,
  tasks,
  visibleTasks,
  searchExpanded,
  narrowed,
  listId,
  people,
  tags,
  sort,
  onSort,
  composer,
  onCompose,
  onCloseComposer,
  onOpenList,
  highlightedId,
}: {
  workspace: Workspace
  tree: WorkspaceTree
  /** Every task of the view. */
  tasks: readonly TaskRow[]
  /** The tasks left after the banner search and Filters. */
  visibleTasks: readonly TaskRow[]
  /** Parents the search opens to show a matching subtask. */
  searchExpanded: ReadonlySet<string>
  narrowed: boolean
  listId: string | null
  people: ReadonlyMap<string, PmPerson>
  tags: readonly Tag[]
  sort: ListSort | null
  onSort: (sort: ListSort | null) => void
  composer: Composer | null
  onCompose: (composer: Composer) => void
  onCloseComposer: () => void
  onOpenList: (listId: string) => void
  highlightedId: string | null
}) {
  const router = useRouter()
  const actions = useTaskActions({ workspace, tree, listId, tasks })
  const { save, saving } = useWorkspacePatch(workspace)

  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [permissionKey, setPermissionKey] = useState<TaskColumnKey | null>(null)
  const [deletingKey, setDeletingKey] = useState<TaskColumnKey | null>(null)
  const [bulkDelete, setBulkDelete] = useState(false)

  // Drop selections of tasks that are gone (deleted, moved, filtered out stays selected).
  const ids = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks])
  const liveSelected = useMemo(
    () => new Set([...selected].filter((id) => ids.has(id))),
    [selected, ids],
  )

  // A copied link opens the page on its task: open the parents and scroll to the row.
  useEffect(() => {
    if (!highlightedId) return
    const element = document.getElementById(`task-${highlightedId}`)
    element?.scrollIntoView({ block: 'center' })
  }, [highlightedId, tasks.length])

  const columns = useMemo(() => visibleColumns(workspace.columns), [workspace.columns])
  const children = useMemo(() => childrenByParent(visibleTasks), [visibleTasks])
  const groups = useMemo(
    () => groupByStatus(visibleTasks, workspace.setup.statuses),
    [visibleTasks, workspace.setup.statuses],
  )
  const openSet = useMemo(() => {
    const open = new Set([...expanded, ...searchExpanded])
    // The parents of a linked task open too.
    let parentId = tasks.find((task) => task.id === highlightedId)?.parentId ?? null
    while (parentId) {
      open.add(parentId)
      const id = parentId
      parentId = tasks.find((task) => task.id === id)?.parentId ?? null
    }
    return open
  }, [expanded, searchExpanded, tasks, highlightedId])

  const sortContext = useMemo(
    () => ({
      people,
      statuses: workspace.setup.statuses,
      tags: new Map(tags.map((tag) => [tag.id, tag])),
    }),
    [people, workspace.setup.statuses, tags],
  )

  const saveColumns = (next: typeof workspace.columns, success?: string) => {
    void save({ columns: next }, success)
  }

  const onColumnAction = (key: TaskColumnKey, action: ColumnAction) => {
    const label = COLUMN_LABELS[key]
    switch (action) {
      case 'sort-asc':
        onSort({ key, direction: 'asc' })
        return
      case 'sort-desc':
        onSort({ key, direction: 'desc' })
        return
      case 'clear-sort':
        onSort(null)
        return
      case 'move-start':
        saveColumns(moveColumn(workspace.columns, key, 'start'))
        return
      case 'move-end':
        saveColumns(moveColumn(workspace.columns, key, 'end'))
        return
      case 'hide':
        if (sort?.key === key) onSort(null)
        saveColumns(hideColumn(workspace.columns, key), `${label} hidden`)
        return
      case 'delete':
        setDeletingKey(key)
        return
    }
  }

  const onMove = (movingId: string, targetId: string) => {
    const moving = tasks.find((task) => task.id === movingId)
    const target = tasks.find((task) => task.id === targetId)
    if (!moving || !target) return
    const isTop = (task: TaskRow) => !task.parentId || !ids.has(task.parentId)
    const siblings = (
      isTop(target)
        ? topLevel(tasks).filter((task) => task.statusId === target.statusId)
        : tasks.filter((task) => task.parentId === target.parentId)
    ).toSorted((a, b) => a.order - b.order)
    const order = orderForMove(siblings, movingId, targetId)
    if (order === null) return
    // A task dropped into another status group takes that status; subtasks keep theirs.
    actions.reorder(moving, order, isTop(target) ? target.statusId : moving.statusId)
  }

  const value: ListViewContextValue = {
    workspace,
    tree,
    allTasks: tasks,
    columns,
    people,
    sortContext,
    sort,
    onSort,
    onColumnAction,
    onShowColumn: (key) => {
      saveColumns(showColumn(workspace.columns, key), `${COLUMN_LABELS[key]} added`)
    },
    onOpenPermission: setPermissionKey,
    selected: liveSelected,
    onSelect: (changed, on) => {
      setSelected((current) => {
        const next = new Set(current)
        for (const id of changed) {
          if (on) next.add(id)
          else next.delete(id)
        }
        return next
      })
    },
    expanded: openSet,
    onToggleExpand: (taskId, open) => {
      setExpanded((current) => {
        const next = new Set(current)
        const opening = open ?? !openSet.has(taskId)
        if (opening) next.add(taskId)
        else next.delete(taskId)
        return next
      })
    },
    renamingId,
    onRename: setRenamingId,
    highlightedId,
    onCompose: (statusId, type) => {
      setCollapsed((current) => {
        const next = new Set(current)
        next.delete(statusId)
        return next
      })
      onCompose({ statusId, type })
    },
    onMove,
    draggingId,
    onDragging: setDraggingId,
    actions,
    onOpenList,
    taskHref: (task) => {
      const location = router.buildLocation({
        to: '/project-management/workspaces/$workspaceId',
        params: { workspaceId: workspace.id },
        search: task.listId ? { list: task.listId } : {},
        hash: task.id,
      })
      return new URL(location.href, window.location.origin).href
    },
  }

  const shown = groups.filter(
    (group) => group.tasks.length > 0 || composer?.statusId === group.status.id,
  )

  return (
    <ListViewContext value={value}>
      {liveSelected.size > 0 && (
        <div
          role="region"
          aria-label="Selected tasks"
          className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-[#17263A] px-4 py-2 text-[0.8125rem] text-white shadow-md"
        >
          <span>
            {liveSelected.size} task{liveSelected.size === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            onClick={() => {
              setBulkDelete(true)
            }}
            className="rounded-lg bg-[#B7192C] px-3 py-1 text-xs font-semibold hover:bg-[#9b1524]"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(new Set())
            }}
            className="ml-auto rounded-lg px-3 py-1 text-xs font-medium hover:bg-white/10"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="@container/list overflow-x-auto pb-2">
        <div className="flex w-max min-w-full flex-col gap-[1.875rem]">
          {narrowed && shown.length === 0 && (
            <p role="status" className="sticky left-0 px-2 py-8 text-center text-sm text-[#707070]">
              No tasks match your search or filters.
            </p>
          )}
          {shown.map(({ status, tasks: groupTasks }) => (
            <StatusGroup
              key={status.id}
              status={status}
              tasks={groupTasks}
              childrenOf={(taskId) => children.get(taskId) ?? []}
              collapsed={collapsed.has(status.id)}
              onCollapsedChange={(isCollapsed) => {
                setCollapsed((current) => {
                  const next = new Set(current)
                  if (isCollapsed) next.add(status.id)
                  else next.delete(status.id)
                  return next
                })
              }}
              composing={composer?.statusId === status.id ? composer.type : null}
              listId={listId}
              onCloseComposer={onCloseComposer}
              onSelectAll={(all) => {
                value.onSelect(all, true)
              }}
              onCollapseAll={(all) => {
                setCollapsed(all ? new Set(shown.map((group) => group.status.id)) : new Set())
              }}
            />
          ))}
        </div>
      </div>

      <RolePermissionDialog
        columnKey={permissionKey}
        workspace={workspace}
        people={people}
        saving={saving}
        onOpenChange={(open) => {
          if (!open) setPermissionKey(null)
        }}
        onSave={(key, permission) => {
          const next = workspace.columns.some((column) => column.key === key)
            ? workspace.columns.map((column) =>
                column.key === key ? { ...column, permission } : column,
              )
            : workspace.columns
          void save({ columns: next }, 'Permissions saved').then((ok) => {
            if (ok) setPermissionKey(null)
          })
        }}
      />
      <ConfirmDialog
        open={deletingKey !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingKey(null)
        }}
        title="Delete column?"
        description={
          deletingKey
            ? `${COLUMN_LABELS[deletingKey]} leaves the List view and its permissions are cleared. The tasks keep their values, and the "+" can add the column back.`
            : ''
        }
        confirmLabel="Delete Column"
        variant="destructive"
        onConfirm={() => {
          if (!deletingKey) return
          if (sort?.key === deletingKey) onSort(null)
          saveColumns(
            deleteColumn(workspace.columns, deletingKey),
            `${COLUMN_LABELS[deletingKey]} deleted`,
          )
          setDeletingKey(null)
        }}
      />
      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title="Delete tasks?"
        description={`${liveSelected.size} selected task${liveSelected.size === 1 ? '' : 's'} and their subtasks will be deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          void actions.removeMany([...liveSelected]).then(() => {
            setSelected(new Set())
          })
        }}
      />
    </ListViewContext>
  )
}
