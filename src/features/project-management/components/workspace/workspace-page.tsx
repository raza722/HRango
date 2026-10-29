import { useEffect, useMemo, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'

import { ErrorState } from '@/components/feedback/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { pageTitle } from '@/lib/constants'

import { VIEW_LABELS } from '../../constants'
import {
  usePeople,
  usePmLookups,
  useTags,
  useTaskList,
  useWorkspace,
  useWorkspaceTree,
} from '../../hooks/use-pm'
import { usePmAccess } from '../../hooks/use-pm-access'
import type { WorkspaceSearch } from '../../pm-search'
import type { TaskRow, TaskType, ViewKind } from '../../types/pm.types'
import type { Workspace, WorkspaceTree } from '../../types/pm.types'
import { ActivityView } from './activity-view'
import { CalendarView } from './calendar-view'
import {
  EMPTY_FILTERS,
  filterCount,
  type ListSort,
  narrowTasks,
  type TaskFilters,
  taskMatches,
} from './list-utils'
import { type Composer, ListView } from './list-view'
import { OverdueView } from './overdue-view'
import { TeamView } from './team-view'
import { TimelineView } from './timeline-view'
import { useWorkspacePatch } from './use-workspace-patch'
import { ViewBar } from './view-bar'
import { VIEW_ICONS } from './view-icons'
import { WorkspaceBanner } from './workspace-banner'
import { PlusIcon } from './workspace-icons'
import { membersOf } from './workspace-members'

export interface WorkspacePageProps {
  workspaceId: string
  search: WorkspaceSearch
  /** `hash`: a task to show (the List view scrolls to it and marks it). */
  onSearch: (patch: Partial<WorkspaceSearch>, options?: { hash?: string }) => void
}

/** A workspace: cover banner, view bar and the List view of its tasks (Workspace Page 1:2755). */
export function WorkspacePage({ workspaceId, search, onSearch }: WorkspacePageProps) {
  const query = useWorkspace(workspaceId)
  const tree = useWorkspaceTree()
  if (query.isPending) return <PageSkeleton />
  if (query.isError) {
    return query.error.isNotFound ? (
      <ErrorState
        title="Workspace not found"
        message="It may have been deleted, or you are no longer a member."
      />
    ) : (
      <ErrorState
        title="Could not load the workspace"
        message={query.error.message}
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }
  const workspace = query.data
  return (
    <WorkspaceContent
      workspace={workspace}
      tree={tree.data ?? { workspaces: [] }}
      search={search}
      onSearch={onSearch}
    />
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
  onSearch: WorkspacePageProps['onSearch']
}) {
  const listId = search.list ?? null
  const tasks = useTaskList(workspace.id, listId)
  const lookups = usePmLookups()
  const people = usePeople()
  const access = usePmAccess(workspace)
  const tags = useTags(workspace.id)
  const { save, saving } = useWorkspacePatch(workspace)
  const hash = useRouterState({ select: (state) => state.location.hash })

  // The route's head says "Workspace" until the workspace loads; then the tab shows its name.
  useEffect(() => {
    document.title = pageTitle(workspace.name)
  }, [workspace.name])

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<ListSort | null>(null)
  const [composer, setComposer] = useState<Composer | null>(null)

  const view: ViewKind = search.view ?? workspace.setup.defaultView
  const overdueTab = search.overdue === true
  const members = useMemo(() => membersOf(workspace, people), [workspace, people])

  const rows = useMemo(() => tasks.data?.rows ?? [], [tasks.data])
  const overdueCount = rows.filter((task) => task.isOverdue).length
  const narrowed = useMemo(() => narrowTasks(rows, query, filters), [rows, query, filters])
  const isNarrowed = query.trim() !== '' || filterCount(filters) > 0
  const taskIds = useMemo(() => new Set(rows.map((task) => task.id)), [rows])

  /** The search value for a view: absent for the workspace's default. */
  const viewParam = (kind: ViewKind) => (kind === workspace.setup.defaultView ? undefined : kind)
  const firstStatus = workspace.setup.statuses[0]
  // The views drawn from the task list: List, and the Table and Board layouts of it; Calendar,
  // Timeline and Team are views of their own over the same tasks, Activity of their history.
  const layout =
    view === 'board' ? 'board' : view === 'table' ? 'table' : view === 'list' ? 'list' : null
  const ownView =
    view === 'calendar' || view === 'timeline' || view === 'activity' || view === 'team'
  const addTask = (type: TaskType) => {
    if (!access.addTasks) return
    // The Board adds in its first column; elsewhere the List view's new-task row opens.
    if (layout !== 'list' && layout !== 'board') {
      onSearch({ view: viewParam('list'), overdue: undefined })
    } else if (overdueTab) onSearch({ overdue: undefined })
    if (firstStatus) setComposer({ statusId: firstStatus.id, type })
  }
  /** From the Overdue tab and the other views: the task in the List view, scrolled to and marked. */
  const openTask = (task: Pick<TaskRow, 'id'>) => {
    onSearch({ view: viewParam('list'), overdue: undefined }, { hash: task.id })
  }
  /** From the Team view: the List view with only that person's tasks (or the unassigned ones). */
  const showPerson = (assigneeId: string) => {
    setQuery('')
    setFilters({ ...EMPTY_FILTERS, assigneeIds: [assigneeId] })
    onSearch({ view: viewParam('list'), overdue: undefined })
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
            onSearch({ view: viewParam(kind), overdue: undefined })
          }}
          overdue={{
            count: overdueCount,
            active: overdueTab,
            onSelect: () => {
              onSearch({ overdue: true })
            },
          }}
          onAddView={(kind) => {
            void save({ addView: kind }, `${VIEW_LABELS[kind]} view added`)
            onSearch({ view: viewParam(kind) })
          }}
          filters={filters}
          onFilters={setFilters}
          members={members}
          onColumns={(columns) => {
            void save({ columns })
          }}
          onAddTask={access.addTasks ? addTask : undefined}
          canAddView={access.editWorkspace}
        />

        <div className="mt-8 min-w-0 pb-4 sm:mt-[3.75rem]">
          {overdueTab ? (
            tasks.isPending ? (
              <ListSkeleton />
            ) : tasks.isError ? (
              <ErrorState
                title="Could not load the tasks"
                message={tasks.error.message}
                onRetry={() => {
                  void tasks.refetch()
                }}
              />
            ) : (
              <OverdueView tasks={rows} access={access} onOpenTask={openTask} />
            )
          ) : layout === null && !ownView ? (
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
          ) : view === 'calendar' ? (
            <CalendarView
              workspace={workspace}
              tree={tree}
              listId={listId}
              tasks={rows}
              visibleTasks={narrowed.tasks}
              access={access}
              on={search.on}
              mode={search.calendar ?? 'month'}
              onSearch={onSearch}
              onOpenTask={openTask}
            />
          ) : view === 'timeline' ? (
            <TimelineView
              workspace={workspace}
              tree={tree}
              listId={listId}
              tasks={rows}
              visibleTasks={narrowed.tasks}
              access={access}
              on={search.on}
              scale={search.scale ?? 'month'}
              group={search.group ?? 'list'}
              onSearch={onSearch}
              onOpenTask={openTask}
            />
          ) : view === 'activity' ? (
            <ActivityView
              workspace={workspace}
              people={people}
              taskIds={taskIds}
              onOpenTask={(id) => {
                openTask({ id })
              }}
            />
          ) : view === 'team' ? (
            <TeamView
              workspace={workspace}
              tasks={isNarrowed ? rows.filter((task) => taskMatches(task, query, filters)) : rows}
              narrowed={isNarrowed}
              people={people}
              onShowPerson={showPerson}
            />
          ) : layout === null ? null : rows.length === 0 && !composer && layout !== 'board' ? (
            <EmptyTasks
              inList={listId !== null}
              onAdd={
                access.addTasks
                  ? () => {
                      addTask('task')
                    }
                  : undefined
              }
            />
          ) : (
            <ListView
              layout={layout}
              workspace={workspace}
              tree={tree}
              tasks={rows}
              hiddenColumns={tasks.data.hiddenColumns}
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
      className="flex flex-col items-center gap-3 rounded-[0.875rem] border border-[#ECECEC] bg-white px-6 py-14 text-center dark:border-border dark:bg-card"
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-[#F0E9FD] text-[#7127EA] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF]">
        <Icon className="size-6" />
      </span>
      <h2 className="text-base font-medium text-[#303030] dark:text-title">
        This view is not designed yet
      </h2>
      <p className="max-w-md text-sm text-[#707070] dark:text-grey">
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

function EmptyTasks({ inList, onAdd }: { inList: boolean; onAdd: (() => void) | undefined }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[0.875rem] border border-[#ECECEC] bg-white px-6 py-14 text-center dark:border-border dark:bg-card">
      <h2 className="text-base font-medium text-[#303030] dark:text-title">No tasks yet</h2>
      <p className="max-w-md text-sm text-[#707070] dark:text-grey">
        {inList
          ? 'Add the first task of this list. Tasks are grouped by status, with their subtasks under them.'
          : 'Add the first task of this workspace. Tasks are grouped by status, with their subtasks under them.'}
      </p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl bg-[#7127EA] px-5 text-sm font-semibold text-white hover:bg-[#5f1fd0]"
        >
          <PlusIcon className="size-4" />
          Add Task
        </button>
      )}
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
