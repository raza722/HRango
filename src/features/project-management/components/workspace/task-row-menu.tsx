import { useMemo, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { cn } from '@/lib/utils'

import { pmApi, pmKeys } from '../../api/pm.api'
import { useReminder } from '../../hooks/use-pm'
import type { TaskRow, WorkspaceSummary } from '../../types/pm.types'
import { ShareDialog } from '../task-fields/share-dialog'
import { useListView } from './list-context'
import { descendantIds, topLevel } from './list-utils'
import {
  PmMenu,
  PmMenuCheckItem,
  PmMenuContent,
  PmMenuItem,
  PmMenuLabel,
  PmMenuSeparator,
  PmMenuSub,
  PmMenuSubContent,
  PmMenuSubTrigger,
  PmMenuTrigger,
} from './menu-parts'
import { ReminderPopover } from './reminder-popover'
import {
  ChevronRightIcon,
  ConvertIcon,
  CopyLinkIcon,
  FavoriteIcon,
  MilestoneIcon,
  MoveToIcon,
  NewTabIcon,
  RemindIcon,
  RenameIcon,
  RowDotsIcon,
  SearchIcon,
  TaskIcon,
  TaskTypeIcon,
} from './workspace-icons'
import { listStyles, menuStyles, popupStyles } from './workspace-styles'

type Dialog = 'share' | 'delete' | 'convert-list' | 'reminder' | null

/** The three-dot menu of a task row (task row menu 288:156930). */
export function TaskRowMenu({ task }: { task: TaskRow }) {
  const {
    workspace,
    tree,
    access,
    allTasks,
    actions,
    taskHref,
    onRename,
    onOpenList,
    onToggleExpand,
  } = useListView()
  const [dialog, setDialog] = useState<Dialog>(null)
  const reminder = useReminder(task.id, dialog === 'reminder')
  /** The rename box or a popup takes focus when the menu closes, not the menu button. */
  const keepFocus = useRef(false)

  const family = useMemo(() => descendantIds(task.id, allTasks), [task.id, allTasks])
  const parents = useMemo(
    () => topLevel(allTasks).filter((row) => !family.has(row.id)),
    [allTasks, family],
  )
  const subtaskCount = family.size - 1

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(taskHref(task))
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <>
      <ReminderPopover
        open={dialog === 'reminder'}
        onOpenChange={(open) => {
          setDialog(open ? 'reminder' : null)
        }}
        value={reminder.data?.remindAt ?? null}
        taskName={task.name}
        onSave={(at) => {
          void actions.setReminder(task, at)
        }}
      >
        <span className="inline-flex">
          <PmMenu modal={false}>
            <PmMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${task.name}`}
                className={cn(listStyles.iconButton, 'h-[1.875rem] w-[2.1875rem]')}
              >
                <RowDotsIcon className="h-[0.33rem] w-[1.3125rem]" />
              </button>
            </PmMenuTrigger>
            <PmMenuContent
              align="end"
              className="max-h-[min(38.4rem,var(--radix-dropdown-menu-content-available-height))] w-[17.7rem]"
              onCloseAutoFocus={(event) => {
                if (keepFocus.current) {
                  event.preventDefault()
                  keepFocus.current = false
                }
              }}
            >
              {access.editTasks && (
                <PmMenuItem
                  icon={<RenameIcon />}
                  onSelect={() => {
                    keepFocus.current = true
                    onRename(task.id)
                  }}
                >
                  Rename Task
                </PmMenuItem>
              )}
              <PmMenuItem
                icon={<FavoriteIcon />}
                onSelect={() => {
                  actions.toggleFavorite(task)
                }}
              >
                {task.favorite ? 'Remove from Favorite' : 'Add to Favorite'}
              </PmMenuItem>
              <PmMenuSeparator />

              {access.moveTasks && (
                <PmMenuSub>
                  <PmMenuSubTrigger icon={<MoveToIcon />}>Move To</PmMenuSubTrigger>
                  <PmMenuSubContent className="w-[18rem]">
                    <MoveToList
                      task={task}
                      onPick={(target) => {
                        void actions.moveTo(task, target)
                      }}
                      workspaces={tree.workspaces.filter(
                        (entry) =>
                          entry.id === workspace.id ||
                          entry.myRole === 'workspace-admin' ||
                          entry.myRole === 'hr' ||
                          entry.myRole === 'managers' ||
                          entry.myRole === 'team-leaders',
                      )}
                      currentWorkspaceId={workspace.id}
                    />
                  </PmMenuSubContent>
                </PmMenuSub>
              )}

              {access.moveTasks && (
                <PmMenuSub>
                  <PmMenuSubTrigger icon={<ConvertIcon />}>Convert Task</PmMenuSubTrigger>
                  <PmMenuSubContent className="w-[16rem]">
                    {task.parentId ? (
                      <PmMenuItem
                        onSelect={() => {
                          actions.convertToTask(task)
                        }}
                      >
                        Convert to Task
                      </PmMenuItem>
                    ) : null}
                    <PmMenuSub>
                      <PmMenuSubTrigger disabled={parents.length === 0}>
                        Convert to Subtask
                      </PmMenuSubTrigger>
                      <PmMenuSubContent className="max-h-[20rem] w-[17rem]">
                        <PmMenuLabel>Make it a subtask of</PmMenuLabel>
                        {parents.map((parent) => (
                          <PmMenuItem
                            key={parent.id}
                            disabled={parent.id === task.parentId}
                            onSelect={() => {
                              actions.convertToSubtask(task, parent)
                              onToggleExpand(parent.id, true)
                            }}
                          >
                            {parent.name}
                          </PmMenuItem>
                        ))}
                      </PmMenuSubContent>
                    </PmMenuSub>
                    {access.manageLists && (
                      <PmMenuItem
                        onSelect={() => {
                          keepFocus.current = true
                          setDialog('convert-list')
                        }}
                      >
                        Convert to List
                      </PmMenuItem>
                    )}
                  </PmMenuSubContent>
                </PmMenuSub>
              )}

              {access.editTasks && (
                <PmMenuSub>
                  <PmMenuSubTrigger icon={<TaskTypeIcon />}>Task Type</PmMenuSubTrigger>
                  <PmMenuSubContent className="w-[13rem]">
                    <PmMenuCheckItem
                      icon={<TaskIcon />}
                      checked={task.type === 'task'}
                      onSelect={() => {
                        actions.setType(task, 'task')
                      }}
                    >
                      Task
                    </PmMenuCheckItem>
                    <PmMenuCheckItem
                      icon={<MilestoneIcon />}
                      checked={task.type === 'milestone'}
                      onSelect={() => {
                        actions.setType(task, 'milestone')
                      }}
                    >
                      Milestone
                    </PmMenuCheckItem>
                  </PmMenuSubContent>
                </PmMenuSub>
              )}
              <PmMenuSeparator />

              {access.remind && (
                <PmMenuItem
                  icon={<RemindIcon />}
                  onSelect={() => {
                    keepFocus.current = true
                    setDialog('reminder')
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    Remind Me
                    <ChevronRightIcon className="h-3 w-1.5 shrink-0 text-[#7127EA]" />
                  </span>
                </PmMenuItem>
              )}
              <PmMenuItem
                icon={<CopyLinkIcon />}
                onSelect={() => {
                  void copyLink()
                }}
              >
                Copy link
              </PmMenuItem>
              <PmMenuItem
                icon={<NewTabIcon />}
                onSelect={() => {
                  window.open(taskHref(task), '_blank', 'noopener,noreferrer')
                }}
              >
                Open in new tab
              </PmMenuItem>
              <PmMenuSeparator />
              {access.viewSharing && (
                <PmMenuItem
                  className={menuStyles.outline}
                  onSelect={() => {
                    keepFocus.current = true
                    setDialog('share')
                  }}
                >
                  Sharing &amp; Permissions
                </PmMenuItem>
              )}
              {access.deleteTasks && (
                <PmMenuItem
                  className={menuStyles.danger}
                  onSelect={() => {
                    keepFocus.current = true
                    setDialog('delete')
                  }}
                >
                  Delete
                </PmMenuItem>
              )}
            </PmMenuContent>
          </PmMenu>
        </span>
      </ReminderPopover>

      <ShareDialog
        open={dialog === 'share'}
        onOpenChange={(open) => {
          setDialog(open ? 'share' : null)
        }}
        entityType="task"
        entityId={task.id}
        targetName={task.name}
        canEdit={access.share}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          setDialog(open ? 'delete' : null)
        }}
        title="Delete task?"
        description={
          subtaskCount > 0
            ? `"${task.name}" and its ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'} will be deleted.`
            : `"${task.name}" will be deleted.`
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          actions.remove(task)
        }}
      />
      <ConfirmDialog
        open={dialog === 'convert-list'}
        onOpenChange={(open) => {
          setDialog(open ? 'convert-list' : null)
        }}
        title="Convert to List?"
        description={
          subtaskCount > 0
            ? `A list named "${task.name}" takes its place, and its ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'} become the list's tasks.`
            : `A list named "${task.name}" takes its place. The task itself is removed.`
        }
        confirmLabel="Convert"
        onConfirm={() => {
          void actions.convertToList(task).then((list) => {
            if (list) onOpenList(list.id)
          })
        }}
      />
    </>
  )
}

/**
 * Move To: search, then every workspace the caller may move tasks into, with its folders' lists
 * (each workspace's lists are read when the menu opens).
 */
function MoveToList({
  task,
  workspaces,
  currentWorkspaceId,
  onPick,
}: {
  task: TaskRow
  workspaces: WorkspaceSummary[]
  currentWorkspaceId: string
  onPick: (target: { workspaceId: string; listId: string | null; listName?: string }) => void
}) {
  const [query, setQuery] = useState('')
  const details = useQueries({
    queries: workspaces.map((entry) => ({
      queryKey: pmKeys.workspace(entry.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => pmApi.workspace(entry.id, signal),
      staleTime: 60_000,
    })),
  })
  const text = query.trim().toLowerCase()
  const visible = workspaces
    .map((summary, index) => {
      const items = details[index]?.data?.items ?? []
      const entry = { id: summary.id, name: summary.name, items }
      const lists = entry.items.filter((item) => item.kind === 'list')
      const nameHit = entry.name.toLowerCase().includes(text)
      return {
        ...entry,
        lists:
          text && !nameHit ? lists.filter((item) => item.name.toLowerCase().includes(text)) : lists,
        show: !text || nameHit || lists.some((item) => item.name.toLowerCase().includes(text)),
      }
    })
    .filter((entry) => entry.show)

  return (
    <>
      <label className="relative block">
        <span className="sr-only">Search workspace</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#A181FF]" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          // Typing here must not jump through the menu (its type-ahead).
          onKeyDown={(event) => {
            if (event.key === 'Escape') return
            event.stopPropagation()
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              event.currentTarget
                .closest('[role="menu"]')
                ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])')
                ?.focus()
            }
          }}
          placeholder="Search workspace here..."
          className={cn(popupStyles.field, 'h-9 rounded-full pl-9 text-xs')}
        />
      </label>
      {visible.length === 0 && <p className="px-2 py-3 text-xs text-[#909090]">Nothing matches.</p>}
      {visible.map((entry) => {
        const here = entry.id === currentWorkspaceId && task.listId === null
        return (
          <div key={entry.id} role="group" aria-label={entry.name} className="flex flex-col gap-1">
            <PmMenuItem
              disabled={here}
              className="font-medium"
              onSelect={() => {
                onPick({ workspaceId: entry.id, listId: null })
              }}
            >
              {entry.name}
            </PmMenuItem>
            {entry.lists.map((list) => {
              const folder = entry.items.find((item) => item.id === list.parentId)
              return (
                <PmMenuItem
                  key={list.id}
                  disabled={list.id === task.listId}
                  className="ml-4 h-auto min-h-9 py-1.5"
                  onSelect={() => {
                    onPick({ workspaceId: entry.id, listId: list.id, listName: list.name })
                  }}
                >
                  <span className="block truncate">{list.name}</span>
                  {folder && (
                    <span className="block truncate text-[0.6875rem] text-[#909090]">
                      {folder.name}
                    </span>
                  )}
                </PmMenuItem>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
