import { format } from 'date-fns'
import { AlarmClock, CircleCheckBig, ListTodo, TriangleAlert } from 'lucide-react'

import { useCan } from '@/lib/permissions'

import { useDashboardData, useScopeWorkspaces } from '../../hooks/use-dashboards'
import { usePmLookups, usePmMe, useReminders } from '../../hooks/use-pm'
import { toDay } from '../task-fields/field-utils'
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
} from './dashboard-parts'
import { completedThisWeek } from './dashboard-utils'
import {
  ActivityKpiWidget,
  AgendaWidget,
  AssignedCommentsWidget,
  AssignedToMeWidget,
  MyWorkWidget,
} from './home-widgets'
import { PersonalListWidget } from './personal-list-widget'
import { RecentsWidget } from './shared-widgets'

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Home Dashboard (BRD row 19; no design): the signed-in person's work across every workspace
 * they are a member of: Recents, My Work, Agenda, Activity KPI, Assigned Comments, Assigned to
 * Me and a Personal List. Read from each workspace's task list (no cross-workspace endpoint:
 * Backend Dependencies T7); Recents and the Personal List wait on the backend.
 */
export function HomeDashboard() {
  const allowed = useCan('projects.workspaces.view')
  const canCreate = useCan('projects.workspaces.create')
  const meId = usePmMe()
  const lookups = usePmLookups()
  const { tree, workspaces } = useScopeWorkspaces('members')
  const data = useDashboardData(workspaces, tree.isPending, tree.error)
  const reminders = useReminders(false)
  const now = new Date()
  const firstName = lookups.data?.me?.name.split(' ')[0]
  const title = firstName ? `${greeting(now)}, ${firstName}` : greeting(now)

  if (!allowed) {
    return (
      <DashboardShell
        eyebrow="Home Dashboard"
        title="Home Dashboard"
        description="Your work across Project Management."
      >
        <NoAccess
          title="No access to Project Management"
          message="Your role does not include viewing workspaces. Ask your administrator if you need it."
        />
      </DashboardShell>
    )
  }

  const mine = data.tasks.filter((task) => task.mine)
  const open = mine.filter((task) => !task.done)
  const today = toDay(now)
  const ready = !data.isPending && !data.error && workspaces.length > 0

  return (
    <DashboardShell
      eyebrow="Home Dashboard"
      title={title}
      description={
        <p>
          {format(now, 'EEEE, d MMMM')}
          {ready && (
            <>
              {' · '}
              <CoverageNote covered={data.workspaces.length} failed={data.failed} />
            </>
          )}
        </p>
      }
      figures={
        ready ? (
          <>
            <StatTile
              label="Open tasks"
              value={open.length}
              hint="Assigned to you"
              icon={<ListTodo />}
            />
            <StatTile
              label="Due today"
              value={open.filter((task) => task.dueDate === today).length}
              hint={format(now, 'EEEE')}
              icon={<AlarmClock />}
            />
            <StatTile
              label="Overdue"
              value={open.filter((task) => task.isOverdue).length}
              hint="Past their due date"
              icon={<TriangleAlert />}
              tone="danger"
            />
            <StatTile
              label="Completed this week"
              value={mine.filter((task) => completedThisWeek(task, now)).length}
              hint="Since Sunday"
              icon={<CircleCheckBig />}
            />
          </>
        ) : data.isPending ? (
          <FigureSkeletons />
        ) : undefined
      }
    >
      {data.isPending ? (
        <DashboardSkeleton label="Loading your dashboard" />
      ) : data.error ? (
        <DashboardError message={data.error.message} onRetry={data.refetch} />
      ) : workspaces.length === 0 ? (
        <NoWorkspaces
          canCreate={canCreate}
          message="You are not a member of any workspace. Once you join one, your tasks, agenda and comments gather here."
        />
      ) : (
        <DashboardGrid refreshing={data.isFetching}>
          <RecentsWidget
            workspaceId={null}
            folderId={null}
            description="Pick up where you left off."
            className="@5xl/page:col-span-12"
          />
          <MyWorkWidget tasks={mine} className="@5xl/page:col-span-7" />
          <AgendaWidget
            tasks={mine}
            reminders={reminders.data ?? []}
            className="@5xl/page:col-span-5"
          />
          <ActivityKpiWidget
            mine={mine}
            team={data.tasks}
            meId={meId}
            className="@5xl/page:col-span-7"
          />
          <AssignedCommentsWidget tasks={data.tasks} className="@5xl/page:col-span-5" />
          <AssignedToMeWidget tasks={mine} className="@5xl/page:col-span-7" />
          <PersonalListWidget className="@5xl/page:col-span-5" />
        </DashboardGrid>
      )}
    </DashboardShell>
  )
}
