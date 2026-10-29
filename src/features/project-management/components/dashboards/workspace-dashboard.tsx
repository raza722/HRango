import { useMemo } from 'react'
import { CircleCheckBig, ListTodo, TriangleAlert, Users } from 'lucide-react'

import { useCan } from '@/lib/permissions'

import { useDashboardData, useScopeWorkspaces } from '../../hooks/use-dashboards'
import {
  DashboardError,
  DashboardGrid,
  DashboardShell,
  DashboardSkeleton,
  FigureSkeletons,
  NoAccess,
  NoWorkspaces,
  StatTile,
} from './dashboard-parts'
import type { WorkspaceDashboardSearch } from './dashboard-search'
import {
  completedThisWeek,
  defaultWorkspace,
  folderStats,
  isRefused,
  listStats,
  slicesByStatus,
} from './dashboard-utils'
import { ScopePicker } from './scope-picker'
import {
  BookmarksWidget,
  DocsWidget,
  FilesWidget,
  FoldersWidget,
  ListsWidget,
  RecentsWidget,
  WorkloadWidget,
} from './shared-widgets'

/**
 * Workspace Dashboard (BRD row 19; no design): one workspace's Workload by Status, Folders,
 * Lists, Recents, Docs, Bookmarks and files. Read from the workspace page's own calls; Recents
 * and Docs wait on the backend (T7, T1).
 */
export function WorkspaceDashboard({
  search,
  onSearch,
}: {
  search: WorkspaceDashboardSearch
  onSearch: (patch: Partial<WorkspaceDashboardSearch>) => void
}) {
  const allowed = useCan('projects.workspaces.view')
  const canCreate = useCan('projects.workspaces.create')
  const { tree, workspaces } = useScopeWorkspaces('readable')
  const selectedId = search.workspace ?? defaultWorkspace(workspaces)?.id ?? null
  const summary = workspaces.find((workspace) => workspace.id === selectedId)
  const scope = useMemo(
    () => (selectedId ? [{ id: selectedId, name: summary?.name ?? '' }] : []),
    [selectedId, summary?.name],
  )
  const data = useDashboardData(scope, tree.isPending, tree.error)
  const entry = data.workspaces[0]
  const failure = data.failed[0]
  const now = new Date()

  const picker = (
    <ScopePicker
      label="Workspace"
      value={selectedId ?? ''}
      options={workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
      onChange={(workspace) => {
        onSearch({ workspace })
      }}
    />
  )

  if (!allowed) {
    return (
      <DashboardShell
        eyebrow="Workspace Dashboard"
        title="Workspace Dashboard"
        description="One workspace at a glance."
      >
        <NoAccess
          title="No access to Project Management"
          message="Your role does not include viewing workspaces. Ask your administrator if you need it."
        />
      </DashboardShell>
    )
  }

  const tasks = entry?.tasks ?? []
  const open = tasks.filter((task) => !task.done)
  const lists = entry ? listStats(entry.workspace, tasks) : []
  const folders = entry ? folderStats(entry.workspace, lists) : []
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]))

  // Until a branch below applies, the page is still loading.
  let body = <DashboardSkeleton label="Loading the workspace dashboard" />
  if (tree.isPending || (data.isPending && !failure)) {
    // keep the skeleton
  } else if (tree.error) {
    body = <DashboardError message={tree.error.message} onRetry={() => void tree.refetch()} />
  } else if (workspaces.length === 0 && !search.workspace) {
    body = (
      <NoWorkspaces
        canCreate={canCreate}
        message="There is no workspace you can open yet. Create one to see its folders, lists and workload here."
      />
    )
  } else if (failure && isRefused(failure.error.status)) {
    body = (
      <NoAccess
        title="You cannot open this workspace"
        message="It may have been deleted, or it is private and you are not a member. Choose another workspace above."
      />
    )
  } else if (failure) {
    body = <DashboardError message={failure.error.message} onRetry={data.refetch} />
  } else if (entry) {
    const workspaceId = entry.workspace.id
    body = (
      <DashboardGrid refreshing={data.isFetching}>
        <WorkloadWidget
          slices={slicesByStatus(entry.workspace, tasks)}
          description="Every task by its status, subtasks included."
          className="@5xl/page:col-span-5"
        />
        <FoldersWidget
          workspaceId={workspaceId}
          folders={folders}
          className="@5xl/page:col-span-7"
        />
        <ListsWidget
          workspaceId={workspaceId}
          lists={lists}
          folderNames={folderNames}
          className="@5xl/page:col-span-7"
        />
        <RecentsWidget
          workspaceId={workspaceId}
          folderId={null}
          description="What you opened lately in this workspace."
          singleColumn
          className="@5xl/page:col-span-5"
        />
        <DocsWidget workspaceId={workspaceId} folderId={null} className="@5xl/page:col-span-6" />
        <BookmarksWidget
          inScope={(bookmark) => bookmark.workspaceId === workspaceId}
          className="@5xl/page:col-span-6"
        />
        <FilesWidget tasks={tasks} className="@5xl/page:col-span-12" />
      </DashboardGrid>
    )
  }

  return (
    <DashboardShell
      eyebrow="Workspace Dashboard"
      title={entry?.workspace.name ?? summary?.name ?? 'Workspace Dashboard'}
      description={
        <p className="line-clamp-2">
          {!entry || entry.workspace.description.trim() === ''
            ? 'Folders, lists, files and the spread of work in one workspace.'
            : entry.workspace.description}
        </p>
      }
      controls={workspaces.length > 0 ? picker : undefined}
      figures={
        entry ? (
          <>
            <StatTile
              label="Open tasks"
              value={open.length}
              hint={`of ${String(tasks.length)} in all`}
              icon={<ListTodo />}
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
              value={tasks.filter((task) => completedThisWeek(task, now)).length}
              hint="Since Sunday"
              icon={<CircleCheckBig />}
            />
            <StatTile
              label="Members"
              value={entry.workspace.memberCount}
              hint={entry.workspace.ownerName ? `Owner ${entry.workspace.ownerName}` : undefined}
              icon={<Users />}
            />
          </>
        ) : tree.isPending || (data.isPending && !failure) ? (
          <FigureSkeletons />
        ) : undefined
      }
    >
      {body}
    </DashboardShell>
  )
}
