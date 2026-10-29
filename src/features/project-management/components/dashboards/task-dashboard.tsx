import { type ReactNode, useMemo } from 'react'
import { CircleCheckBig, Loader, UserX, X } from 'lucide-react'

import { useCan } from '@/lib/permissions'

import {
  type DashboardTask,
  useDashboardData,
  useScopeWorkspaces,
} from '../../hooks/use-dashboards'
import {
  CoverageNote,
  DashboardError,
  DashboardGrid,
  DashboardShell,
  DashboardSkeleton,
  FigureSkeletons,
  NoAccess,
  NoWorkspaces,
  StatTile,
  Widget,
  WidgetEmpty,
} from './dashboard-parts'
import type { TaskDashboardSearch, TaskTile } from './dashboard-search'
import { dash } from './dashboard-styles'
import {
  completedThisWeek,
  isDueSoonOrOverdue,
  isInProgress,
  isRefused,
  isUnassigned,
  slicesByGroup,
  slicesByStatus,
} from './dashboard-utils'
import { ScopePicker } from './scope-picker'
import {
  AssigneeWidget,
  DueSoonWidget,
  LatestActivityWidget,
  WorkloadWidget,
} from './shared-widgets'
import { AvatarStack, DueChip, StatusChip, TaskLine } from './task-bits'

const ALL = 'all'
const DRILL_ID = 'task-dashboard-tiles-list'

const TILES: Record<
  TaskTile,
  { label: string; title: string; hint: string; icon: ReactNode; empty: string }
> = {
  unassigned: {
    label: 'Unassigned',
    title: 'Unassigned tasks',
    hint: 'Open, with nobody on them',
    icon: <UserX />,
    empty: 'Every open task has someone on it.',
  },
  'in-progress': {
    label: 'In Progress',
    title: 'Tasks in progress',
    hint: 'In an active status',
    icon: <Loader />,
    empty: 'No task is in an active status.',
  },
  completed: {
    label: 'Completed',
    title: 'Completed tasks',
    hint: 'Done or closed',
    icon: <CircleCheckBig />,
    empty: 'No task is completed yet.',
  },
  'completed-this-week': {
    label: 'Completed this week',
    title: 'Completed this week',
    hint: 'Closed since Sunday',
    icon: <CircleCheckBig />,
    empty: 'Nothing was completed this week yet.',
  },
}

function tileTasks(tile: TaskTile, tasks: readonly DashboardTask[], now: Date): DashboardTask[] {
  switch (tile) {
    case 'unassigned':
      return tasks.filter(isUnassigned)
    case 'in-progress':
      return tasks.filter((task) => isInProgress(task) && !task.done)
    case 'completed':
      return tasks.filter((task) => task.done)
    case 'completed-this-week':
      return tasks.filter((task) => completedThisWeek(task, now))
  }
}

/**
 * Task Dashboard (BRD row 19): Unassigned, In Progress, Completed and Completed This Week (each
 * tile opens its tasks, `?show=`), Due This Week or Overdue, Workload by Status, Totals and Open
 * by Assignee and Latest Activity, over every workspace the caller can open or one of them.
 */
export function TaskDashboard({
  search,
  onSearch,
}: {
  search: TaskDashboardSearch
  onSearch: (patch: Partial<TaskDashboardSearch>) => void
}) {
  const allowed = useCan('projects.workspaces.view')
  const canCreate = useCan('projects.workspaces.create')
  const { tree, workspaces } = useScopeWorkspaces('readable')
  const selectedId = search.workspace ?? null
  const scope = useMemo(
    () =>
      selectedId
        ? [
            workspaces.find((workspace) => workspace.id === selectedId) ?? {
              id: selectedId,
              name: '',
            },
          ]
        : workspaces,
    [selectedId, workspaces],
  )
  const data = useDashboardData(scope, tree.isPending, tree.error)
  const now = new Date()

  if (!allowed) {
    return (
      <DashboardShell
        eyebrow="Task Dashboard"
        title="Task Dashboard"
        description="Tasks at a glance."
      >
        <NoAccess
          title="No access to Project Management"
          message="Your role does not include viewing workspaces. Ask your administrator if you need it."
        />
      </DashboardShell>
    )
  }

  const tasks = data.tasks
  const single = selectedId ? data.workspaces[0] : undefined
  const failure = selectedId ? data.failed[0] : undefined
  const ready = !data.isPending && !data.error && !failure && scope.length > 0
  const showWorkspace = !selectedId && data.workspaces.length > 1
  const shown = search.show

  const picker =
    workspaces.length > 0 ? (
      <ScopePicker
        label="Workspace"
        value={selectedId ?? ALL}
        options={[
          { value: ALL, label: 'All workspaces' },
          ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
        ]}
        onChange={(value) => {
          onSearch({ workspace: value === ALL ? undefined : value })
        }}
      />
    ) : undefined

  let body
  if (data.isPending && !failure) {
    body = <DashboardSkeleton label="Loading the task dashboard" />
  } else if (failure && isRefused(failure.error.status)) {
    body = (
      <NoAccess
        title="You cannot open this workspace"
        message="It may have been deleted, or it is private and you are not a member. Choose another workspace above."
      />
    )
  } else if (data.error ?? failure) {
    body = (
      <DashboardError
        message={(data.error ?? failure?.error)?.message ?? ''}
        onRetry={tree.error ? () => void tree.refetch() : data.refetch}
      />
    )
  } else if (scope.length === 0) {
    body = (
      <NoWorkspaces
        canCreate={canCreate}
        message="There is no workspace you can open yet. Once there is, its tasks are summed up here."
      />
    )
  } else {
    const drill = shown ? tileTasks(shown, tasks, now) : []
    body = (
      <DashboardGrid refreshing={data.isFetching}>
        {shown && (
          <Widget
            id={DRILL_ID}
            title={TILES[shown].title}
            icon={TILES[shown].icon}
            count={drill.length}
            description="Chosen from the figures above."
            action={
              <button
                type="button"
                onClick={() => {
                  onSearch({ show: undefined })
                }}
                className={dash.ghost}
              >
                <X aria-hidden="true" className="size-4" />
                Close
                <span className="sr-only"> {TILES[shown].title}</span>
              </button>
            }
            className="@5xl/page:col-span-12"
          >
            {drill.length === 0 ? (
              <WidgetEmpty icon={TILES[shown].icon} title="Nothing to show">
                {TILES[shown].empty}
              </WidgetEmpty>
            ) : (
              <ul className="grid gap-0.5">
                {drill.map((task) => (
                  <TaskLine
                    key={task.id}
                    task={task}
                    showWorkspace={showWorkspace}
                    trailing={
                      <>
                        <StatusChip task={task} />
                        <AvatarStack task={task} />
                        {!task.done && task.dueDate && <DueChip task={task} now={now} />}
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </Widget>
        )}
        <DueSoonWidget
          tasks={tasks.filter((task) => isDueSoonOrOverdue(task, now))}
          showWorkspace={showWorkspace}
          className="@5xl/page:col-span-7"
        />
        <WorkloadWidget
          slices={single ? slicesByStatus(single.workspace, tasks) : slicesByGroup(tasks)}
          description={
            single
              ? 'Every task by its status, subtasks included.'
              : 'Workspaces have their own statuses, so tasks are counted by status group.'
          }
          className="@5xl/page:col-span-5"
        />
        <AssigneeWidget
          title="Totals and Open by Assignee"
          tasks={tasks}
          className="@5xl/page:col-span-6"
        />
        <LatestActivityWidget
          tasks={tasks}
          showWorkspace={showWorkspace}
          className="@5xl/page:col-span-6"
        />
      </DashboardGrid>
    )
  }

  return (
    <DashboardShell
      eyebrow="Task Dashboard"
      title={single ? `Tasks in ${single.workspace.name}` : 'Task Dashboard'}
      description={
        <p>
          {ready && !selectedId ? (
            <CoverageNote covered={data.workspaces.length} failed={data.failed} />
          ) : (
            'Who has what, what is late and what moved lately.'
          )}
        </p>
      }
      controls={picker}
      figures={
        ready ? (
          <>
            {(Object.keys(TILES) as TaskTile[]).map((tile) => (
              <StatTile
                key={tile}
                label={TILES[tile].label}
                value={tileTasks(tile, tasks, now).length}
                hint={TILES[tile].hint}
                icon={TILES[tile].icon}
                pressed={shown === tile}
                controls={shown === tile ? DRILL_ID : undefined}
                onClick={() => {
                  onSearch({ show: shown === tile ? undefined : tile })
                }}
              />
            ))}
          </>
        ) : data.isPending && !failure ? (
          <FigureSkeletons />
        ) : undefined
      }
    >
      {body}
    </DashboardShell>
  )
}
