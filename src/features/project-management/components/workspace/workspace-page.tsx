import { useMemo, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'

import { ErrorState } from '@/components/feedback/error-state'
import { Skeleton } from '@/components/ui/skeleton'

import { VIEW_LABELS } from '../../constants'
import { usePeople, usePmLookups, useTags, useTasks, useWorkspaceTree } from '../../hooks/use-pm'
import type { WorkspaceSearch } from '../../pm-search'
import type { PmPerson, TaskType, ViewKind } from '../../types/pm.types'
import type { Workspace, WorkspaceTree } from '../../types/pm.types'
import {
  EMPTY_FILTERS,
  filterCount,
  type ListSort,
  narrowTasks,
  type TaskFilters,
} from './list-utils'
import { type Composer, ListView } from './list-view'
import { useWorkspacePatch } from './use-workspace-patch'
import { ViewBar } from './view-bar'
import { VIEW_ICONS } from './view-icons'
import { WorkspaceBanner } from './workspace-banner'
import { PlusIcon } from './workspace-icons'

export interface WorkspacePageProps {
  workspaceId: string
  search: WorkspaceSearch
  onSearch: (patch: Partial<WorkspaceSearch>) => void
}

/** A workspace: cover banner, view bar and the List view of its tasks (Workspace Page 1:2755). */
export function WorkspacePage({ workspaceId, search, onSearch }: WorkspacePageProps) {
  const tree = useWorkspaceTree()
  const workspace = tree.data?.workspaces.find((entry) => entry.id === workspaceId)

  if (tree.isPending) return <PageSkeleton />
  if (tree.isError) {
    return (
      <ErrorState
        title="Could not load the workspace"
        message={tree.error.message}
        onRetry={() => {
          void tree.refetch()
        }}
      />
    )
  }
  if (!workspace) {
    return (
      <ErrorState
        title="Workspace not found"
        message="It may have been deleted, or you are no longer a member."
      />
    )
  }
  return (
    <WorkspaceContent workspace={workspace} tree={tree.data} search={search} onSearch={onSearch} />
  )
}

function WorkspaceContent({
  workspace,
  tree,
  search,
  onSearch,
}: {
  workspace: Workspace
  tree: WorkspaceTree
  search: WorkspaceSearch
  onSearch: (patch: Partial<WorkspaceSearch>) => void
}) {
  const listId = search.list ?? null
  const tasks = useTasks(workspace.id, listId)
  const lookups = usePmLookups()
  const people = usePeople()
  const tags = useTags(workspace.id)
  const { save, saving } = useWorkspacePatch(workspace)
  const hash = useRouterState({ select: (state) => state.location.hash })

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ListSort | null>(null)
  const [composer, setComposer] = useState<Composer | null>(null)

  const view: ViewKind = search.view ?? workspace.setup.defaultView
  const members = useMemo(
    () =>
      [...new Set([workspace.ownerId, ...workspace.memberIds])]
        .map((id) => people.get(id))
        .filter((person): person is PmPerson => Boolean(person)),
    [workspace.ownerId, workspace.memberIds, people],
  )

  const rows = useMemo(() => tasks.data ?? [], [tasks.data])
  const narrowed = useMemo(() => narrowTasks(rows, query, filters), [rows, query, filters])
  const isNarrowed = query.trim() !== '' || filterCount(filters) > 0

  /** The search value for a view: absent for the workspace's default. */
  const viewParam = (kind: ViewKind) => (kind === workspace.setup.defaultView ? undefined : kind)
  const firstStatus = workspace.setup.statuses[0]
  const addTask = (type: TaskType) => {
    if (view !== 'list') onSearch({ view: viewParam('list') })
    if (firstStatus) setComposer({ statusId: firstStatus.id, type })
  }

  const highlightedId = hash && rows.some((task) => task.id === hash) ? hash : null

  return (
    <section aria-labelledby="workspace-title" className="flex min-w-0 flex-col">
      <WorkspaceBanner
        workspace={workspace}
        people={people}
        employees={lookups.data?.employees ?? []}
        query={query}
        onQueryChange={setQuery}
        onSave={save}
        saving={saving}
      />

      <div className="mt-3.5 flex min-w-0 flex-col">
        <ViewBar
          workspace={workspace}
          view={view}
          onView={(kind) => {
            onSearch({ view: viewParam(kind) })
          }}
          onAddView={(kind) => {
            void save(
              { setup: { views: [...workspace.setup.views, kind] } },
              `${VIEW_LABELS[kind]} view added`,
            )
            onSearch({ view: viewParam(kind) })
          }}
          filters={filters}
          onFilters={setFilters}
          members={members}
          onColumns={(columns) => {
            void save({ columns })
          }}
          onAddTask={addTask}
        />

        <div className="mt-8 min-w-0 pb-4 sm:mt-[3.75rem]">
          {view !== 'list' ? (
            <ViewNotDesigned
              view={view}
              onBack={() => {
                onSearch({ view: viewParam('list') })
              }}
            />
          ) : tasks.isPending ? (
            <ListSkeleton />
          ) : tasks.isError ? (
            <ErrorState
              title="Could not load the tasks"
              message={tasks.error.message}
              onRetry={() => {
                void tasks.refetch()
              }}
            />
          ) : rows.length === 0 && !composer ? (
            <EmptyTasks
              inList={listId !== null}
              onAdd={() => {
                addTask('task')
              }}
            />
          ) : (
            <ListView
              workspace={workspace}
              tree={tree}
              tasks={rows}
              visibleTasks={narrowed.tasks}
              searchExpanded={narrowed.expand}
              narrowed={isNarrowed}
              listId={listId}
              people={people}
              tags={tags.data ?? []}
              sort={sort}
              onSort={setSort}
              composer={composer}
              onCompose={setComposer}
              onCloseComposer={() => {
                setComposer(null)
              }}
              onOpenList={(id) => {
                onSearch({ list: id })
              }}
              highlightedId={highlightedId}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function ViewNotDesigned({ view, onBack }: { view: ViewKind; onBack: () => void }) {
  const { Icon } = VIEW_ICONS[view]
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-[0.875rem] border border-[#ECECEC] bg-white px-6 py-14 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-[#F0E9FD] text-[#7127EA]">
        <Icon className="size-6" />
      </span>
      <h2 className="text-base font-medium text-[#303030]">This view is not designed yet</h2>
      <p className="max-w-md text-sm text-[#707070]">
        The {VIEW_LABELS[view]} view has no screen in the design. Your tasks are in the List view.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-1 inline-flex h-10 items-center rounded-xl bg-[#7127EA] px-5 text-sm font-semibold text-white hover:bg-[#5f1fd0]"
      >
        Open List view
      </button>
    </div>
  )
}

function EmptyTasks({ inList, onAdd }: { inList: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[0.875rem] border border-[#ECECEC] bg-white px-6 py-14 text-center">
      <h2 className="text-base font-medium text-[#303030]">No tasks yet</h2>
      <p className="max-w-md text-sm text-[#707070]">
        {inList
          ? 'Add the first task of this list. Tasks are grouped by status, with their subtasks under them.'
          : 'Add the first task of this workspace. Tasks are grouped by status, with their subtasks under them.'}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl bg-[#7127EA] px-5 text-sm font-semibold text-white hover:bg-[#5f1fd0]"
      >
        <PlusIcon className="size-4" />
        Add Task
      </button>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading workspace" className="flex flex-col gap-4">
      <Skeleton className="h-36 rounded-[1.25rem]" />
      <Skeleton className="h-12 rounded-[1.25rem]" />
      <ListSkeleton />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading tasks" className="flex flex-col gap-2 pt-2">
      <Skeleton className="h-10 w-64 rounded-xl" />
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-11 rounded-xl" />
      ))}
    </div>
  )
}
