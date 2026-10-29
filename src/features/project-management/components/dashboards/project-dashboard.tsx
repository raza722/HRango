import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { CircleCheckBig, FolderSearch, ListTodo, Percent, TriangleAlert } from 'lucide-react'

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
  PageNotice,
  StatTile,
} from './dashboard-parts'
import type { ProjectDashboardSearch } from './dashboard-search'
import { dash } from './dashboard-styles'
import {
  defaultWorkspace,
  folderStats,
  folderTasks,
  isRefused,
  listStats,
  slicesByStatus,
} from './dashboard-utils'
import { ScopePicker } from './scope-picker'
import {
  AssigneeWidget,
  BookmarksWidget,
  DocsWidget,
  FilesWidget,
  FoldersWidget,
  ListsWidget,
  RecentsWidget,
  WorkloadWidget,
} from './shared-widgets'

/**
 * Project Dashboard (BRD row 19: the Workspace Dashboard plus Tasks by Assignee). A project is a
 * folder (approved): its lists and their tasks, with the workspace's other projects to switch to.
 */
export function ProjectDashboard({
  search,
  onSearch,
}: {
  search: ProjectDashboardSearch
  onSearch: (patch: Partial<ProjectDashboardSearch>) => void
}) {
  const allowed = useCan('projects.workspaces.view')
  const canCreate = useCan('projects.workspaces.create')
  const { tree, workspaces } = useScopeWorkspaces('readable')
  const workspaceId = search.workspace ?? defaultWorkspace(workspaces)?.id ?? null
  const summary = workspaces.find((workspace) => workspace.id === workspaceId)
  const scope = useMemo(
    () => (workspaceId ? [{ id: workspaceId, name: summary?.name ?? '' }] : []),
    [workspaceId, summary?.name],
  )
  const data = useDashboardData(scope, tree.isPending, tree.error)
  const entry = data.workspaces[0]
  const failure = data.failed[0]
  const now = new Date()

  if (!allowed) {
    return (
      <DashboardShell
        eyebrow="Project Dashboard"
        title="Project Dashboard"
        description="One project at a glance."
      >
        <NoAccess
          title="No access to Project Management"
          message="Your role does not include viewing workspaces. Ask your administrator if you need it."
        />
      </DashboardShell>
    )
  }

  const workspace = entry?.workspace
  const folderItems = workspace?.items.filter((item) => item.kind === 'folder') ?? []
  const folder = search.folder
    ? folderItems.find((item) => item.id === search.folder)
    : folderItems[0]
  const allTasks = entry?.tasks ?? []
  const tasks = workspace && folder ? folderTasks(workspace, folder.id, allTasks) : []
  const open = tasks.filter((task) => !task.done)
  const allLists = workspace ? listStats(workspace, allTasks) : []
  const folders = workspace ? folderStats(workspace, allLists) : []
  const lists = allLists.filter((list) => list.folderId === folder?.id)
  const listIds = new Set(lists.map((list) => list.id))
  const taskIds = new Set(tasks.map((task) => task.id))
  const done = tasks.length - open.length

  const controls =
    workspaces.length > 0 ? (
      <>
        <ScopePicker
          label="Workspace"
          value={workspaceId ?? ''}
          options={workspaces.map((option) => ({ value: option.id, label: option.name }))}
          onChange={(next) => {
            onSearch({ workspace: next, folder: undefined })
          }}
        />
        <ScopePicker
          label="Project"
          value={folder?.id ?? ''}
          options={folderItems.map((item) => ({ value: item.id, label: item.name }))}
          onChange={(next) => {
            onSearch({ workspace: workspaceId ?? undefined, folder: next })
          }}
        />
      </>
    ) : undefined

  // Until a branch below applies, the page is still loading.
  let body = <DashboardSkeleton label="Loading the project dashboard" />
  if (tree.isPending || (data.isPending && !failure)) {
    // keep the skeleton
  } else if (tree.error) {
    body = <DashboardError message={tree.error.message} onRetry={() => void tree.refetch()} />
  } else if (workspaces.length === 0 && !search.workspace) {
    body = (
      <NoWorkspaces
        canCreate={canCreate}
        message="There is no workspace you can open yet. Projects are the folders inside a workspace."
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
  } else if (workspace && !folder) {
    body = (
      <PageNotice
        icon={<FolderSearch />}
        title={search.folder ? 'This project is not here' : 'No projects in this workspace'}
        message={
          search.folder
            ? 'It may have been deleted or moved. Choose another project above.'
            : 'A project is a folder of lists. Add a folder from the Workspaces panel to see its dashboard here.'
        }
        action={
          <Link
            to="/project-management/workspaces/$workspaceId"
            params={{ workspaceId: workspace.id }}
            className={dash.ghost}
          >
            Open {workspace.name}
          </Link>
        }
      />
    )
  } else if (workspace && folder) {
    body = (
      <DashboardGrid refreshing={data.isFetching}>
        <WorkloadWidget
          slices={slicesByStatus(workspace, tasks)}
          description="The project's tasks by status, subtasks included."
          className="@5xl/page:col-span-5"
        />
        <AssigneeWidget title="Tasks by Assignee" tasks={tasks} className="@5xl/page:col-span-7" />
        <ListsWidget
          workspaceId={workspace.id}
          lists={lists}
          folderNames={new Map()}
          className="@5xl/page:col-span-7"
        />
        <RecentsWidget
          workspaceId={workspace.id}
          folderId={folder.id}
          description="What you opened lately in this project."
          singleColumn
          className="@5xl/page:col-span-5"
        />
        <DocsWidget
          workspaceId={workspace.id}
          folderId={folder.id}
          className="@5xl/page:col-span-6"
        />
        <BookmarksWidget
          inScope={(bookmark) =>
            (bookmark.entityType === 'folder' && bookmark.entityId === folder.id) ||
            (bookmark.entityType === 'task_list' && listIds.has(bookmark.entityId)) ||
            (bookmark.entityType === 'task' && taskIds.has(bookmark.entityId))
          }
          className="@5xl/page:col-span-6"
        />
        <FilesWidget tasks={tasks} className="@5xl/page:col-span-7" />
        <FoldersWidget
          workspaceId={workspace.id}
          folders={folders}
          currentId={folder.id}
          title="Projects in this workspace"
          description="Switch to another folder of the workspace."
          singleColumn
          className="@5xl/page:col-span-5"
        />
      </DashboardGrid>
    )
  }

  return (
    <DashboardShell
      eyebrow="Project Dashboard"
      title={folder?.name ?? 'Project Dashboard'}
      description={
        <p>
          {workspace && folder
            ? `A project in ${workspace.name}: ${String(lists.length)} ${lists.length === 1 ? 'list' : 'lists'} and their tasks.`
            : 'A project is a folder of lists in a workspace.'}
        </p>
      }
      controls={controls}
      figures={
        workspace && folder ? (
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
              label="Done"
              value={done}
              hint={`${String(tasks.length - done)} still to do`}
              icon={<CircleCheckBig />}
            />
            <StatTile
              label="Progress"
              value={`${String(tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100))}%`}
              hint={`As of ${format(now, 'd MMM')}`}
              icon={<Percent />}
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
