import { type ReactNode, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Bookmark,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  History,
  LayoutGrid,
  List,
  ListChecks,
  MessageSquare,
  Paperclip,
  PieChart,
  PlusCircle,
  Star,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/utils'

import type { DashboardEntity, PmBookmark, PmRecentItem } from '../../api/dashboards.api'
import {
  type DashboardTask,
  useBookmarks,
  useDocs,
  useRecents,
  useTaskFiles,
} from '../../hooks/use-dashboards'
import { fileKind, formatFileSize } from '../task-fields/field-utils'
import { AssigneeBars } from './assignee-bars'
import {
  NotAvailable,
  PreviewBadge,
  Widget,
  WidgetEmpty,
  WidgetError,
  WidgetSkeleton,
} from './dashboard-parts'
import { dash } from './dashboard-styles'
import {
  type FolderStat,
  latestEvents,
  type ListStat,
  loadByAssignee,
  plural,
  type StatusSlice,
  whenLabel,
} from './dashboard-utils'
import { StatusBreakdown } from './status-breakdown'
import { AvatarStack, DueChip, TaskLine, TaskLink } from './task-bits'

const ENTITY_ICONS: Record<DashboardEntity, ReactNode> = {
  workspace: <LayoutGrid />,
  folder: <Folder />,
  task_list: <List />,
  task: <CircleDot />,
  doc: <FileText />,
}

const ENTITY_LABELS: Record<DashboardEntity, string> = {
  workspace: 'Workspace',
  folder: 'Project',
  task_list: 'List',
  task: 'Task',
  doc: 'Doc',
}

/**
 * Where a recent item or a bookmark leads: a workspace or list opens in the workspace page, a
 * task opens its screen there, a folder (a project) opens its Project Dashboard. Docs have no
 * screen yet (Backend Dependencies T1), so they are not links.
 */
function EntityLink({
  entityType,
  entityId,
  workspaceId,
  className,
  children,
}: {
  entityType: DashboardEntity
  entityId: string
  workspaceId: string
  className: string
  children: ReactNode
}) {
  switch (entityType) {
    case 'workspace':
      return (
        <Link
          to="/project-management/workspaces/$workspaceId"
          params={{ workspaceId: entityId }}
          className={className}
        >
          {children}
        </Link>
      )
    case 'task_list':
      return (
        <Link
          to="/project-management/workspaces/$workspaceId"
          params={{ workspaceId }}
          search={{ list: entityId }}
          className={className}
        >
          {children}
        </Link>
      )
    case 'task':
      return (
        <Link
          to="/project-management/workspaces/$workspaceId"
          params={{ workspaceId }}
          hash={entityId}
          className={className}
        >
          {children}
        </Link>
      )
    case 'folder':
      return (
        <Link
          to="/project-management/project-dashboard"
          search={{ workspace: workspaceId, folder: entityId }}
          className={className}
        >
          {children}
        </Link>
      )
    case 'doc':
      return <div className={className}>{children}</div>
  }
}

function EntityGlyph({ entityType }: { entityType: DashboardEntity }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-[#F7F7F7] text-[#2E64E2] dark:bg-white/5 dark:text-[#8FB0FF] [&_svg]:size-4"
    >
      {ENTITY_ICONS[entityType]}
    </span>
  )
}

// --- recents -----------------------------------------------------------------------------------------

/** Recents (pending endpoint T7): what the caller opened lately, as quick-jump tiles. */
export function RecentsWidget({
  workspaceId,
  folderId,
  description,
  singleColumn = false,
  className,
}: {
  workspaceId: string | null
  folderId: string | null
  description: string
  /** In a narrow column: one tile per row at every width. */
  singleColumn?: boolean
  className?: string
}) {
  const recents = useRecents(workspaceId, folderId)
  const now = new Date()
  let body: ReactNode
  if (recents.isPending) body = <WidgetSkeleton rows={2} />
  else if (recents.isError)
    body = <WidgetError message={recents.error.message} onRetry={() => void recents.refetch()} />
  else if (!recents.data.available) body = <NotAvailable what="Recents" dependency="T7" />
  else if (recents.data.data.length === 0)
    body = (
      <WidgetEmpty icon={<History />} title="Nothing opened yet">
        Workspaces, lists and tasks you open show up here.
      </WidgetEmpty>
    )
  else
    body = (
      <ul
        className={cn('grid gap-2', !singleColumn && '@3xl/page:grid-cols-2 @6xl/page:grid-cols-4')}
      >
        {recents.data.data.map((item: PmRecentItem) => (
          <li key={`${item.entityType}:${item.entityId}`}>
            <EntityLink
              entityType={item.entityType}
              entityId={item.entityId}
              workspaceId={item.workspaceId}
              className={cn(
                dash.row,
                'border border-[#F0F0F0] bg-[#FCFCFD] dark:border-white/5 dark:bg-white/[0.02]',
              )}
            >
              <EntityGlyph entityType={item.entityType} />
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium text-title">{item.name}</span>
                <span className="truncate text-xs text-grey">
                  {ENTITY_LABELS[item.entityType]}
                  {item.workspaceName && item.entityType !== 'workspace'
                    ? ` · ${item.workspaceName}`
                    : ''}{' '}
                  · {whenLabel(item.openedAt, now)}
                </span>
              </span>
            </EntityLink>
          </li>
        ))}
      </ul>
    )
  return (
    <Widget
      title="Recents"
      icon={<History />}
      description={description}
      badge={recents.data?.available ? <PreviewBadge dependency="T7" /> : undefined}
      className={className}
    >
      {body}
    </Widget>
  )
}

// --- docs --------------------------------------------------------------------------------------------

/** Docs (pending endpoint T1): the workspace's (or folder's) latest docs. */
export function DocsWidget({
  workspaceId,
  folderId,
  className,
}: {
  workspaceId: string
  folderId: string | null
  className?: string
}) {
  const docs = useDocs(workspaceId, folderId)
  const now = new Date()
  let body: ReactNode
  if (docs.isPending) body = <WidgetSkeleton rows={3} />
  else if (docs.isError)
    body = <WidgetError message={docs.error.message} onRetry={() => void docs.refetch()} />
  else if (!docs.data.available) body = <NotAvailable what="Docs" dependency="T1" />
  else if (docs.data.data.length === 0)
    body = (
      <WidgetEmpty icon={<FileText />} title="No docs yet">
        Docs written in this {folderId ? 'project' : 'workspace'} will be listed here.
      </WidgetEmpty>
    )
  else
    body = (
      <ul className="grid gap-1">
        {docs.data.data.map((doc) => (
          <li
            key={doc.id}
            className={cn(dash.row, 'hover:bg-transparent dark:hover:bg-transparent')}
          >
            <EntityGlyph entityType="doc" />
            <span className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium text-title">{doc.title}</span>
              <span className="truncate text-xs text-grey">
                {[doc.ownerName, plural(doc.wordCount, 'word')].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="shrink-0 text-xs text-grey">{whenLabel(doc.updatedAt, now)}</span>
          </li>
        ))}
      </ul>
    )
  return (
    <Widget
      title="Docs"
      icon={<FileText />}
      description="Latest docs, newest first. Docs open once the editor exists."
      badge={docs.data?.available ? <PreviewBadge dependency="T1" /> : undefined}
      className={className}
    >
      {body}
    </Widget>
  )
}

// --- bookmarks ---------------------------------------------------------------------------------------

/**
 * Bookmarks: the caller's favourites (`GET /favorites`) inside the scope: a workspace, or a
 * folder with its lists and their tasks (`inScope`).
 */
export function BookmarksWidget({
  inScope,
  className,
}: {
  inScope: (bookmark: PmBookmark) => boolean
  className?: string
}) {
  const bookmarks = useBookmarks()
  const shown = (bookmarks.data ?? []).filter(inScope)
  let body: ReactNode
  if (bookmarks.isPending) body = <WidgetSkeleton rows={3} />
  else if (bookmarks.isError)
    body = (
      <WidgetError message={bookmarks.error.message} onRetry={() => void bookmarks.refetch()} />
    )
  else if (shown.length === 0)
    body = (
      <WidgetEmpty icon={<Bookmark />} title="No bookmarks here">
        Mark a workspace or a task as a favourite to keep it one click away.
      </WidgetEmpty>
    )
  else
    body = (
      <ul className="grid gap-1">
        {shown.map((bookmark) => (
          <li key={bookmark.id}>
            <EntityLink
              entityType={bookmark.entityType}
              entityId={bookmark.entityId}
              workspaceId={bookmark.workspaceId}
              className={dash.row}
            >
              <EntityGlyph entityType={bookmark.entityType} />
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium text-title">{bookmark.name}</span>
                <span className="text-xs text-grey">{ENTITY_LABELS[bookmark.entityType]}</span>
              </span>
              <Star aria-hidden="true" className="size-4 shrink-0 fill-[#F79009] text-[#F79009]" />
            </EntityLink>
          </li>
        ))}
      </ul>
    )
  return (
    <Widget
      title="Bookmarks"
      icon={<Bookmark />}
      description="Your favourites here."
      count={bookmarks.data ? shown.length : undefined}
      className={className}
    >
      {body}
    </Widget>
  )
}

// --- files -------------------------------------------------------------------------------------------

const FILE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'doc', label: 'Documents' },
  { key: 'jpg', label: 'Images' },
  { key: 'xls', label: 'Sheets' },
] as const
type FileFilter = (typeof FILE_FILTERS)[number]['key']

const FILE_ICONS = {
  pdf: <FileText />,
  doc: <FileText />,
  xls: <FileSpreadsheet />,
  jpg: <FileImage />,
  file: <Paperclip />,
}

const matches = (filter: FileFilter, name: string) => {
  if (filter === 'all') return true
  const kind = fileKind(name)
  return filter === 'doc' ? kind === 'doc' || kind === 'pdf' : kind === filter
}

/**
 * Resources and file manager: every file attached to the scope's tasks (each task's
 * `GET /tasks/{id}/attachments`), newest first, by type. Names open the signed link.
 */
export function FilesWidget({
  tasks,
  className,
}: {
  tasks: readonly DashboardTask[]
  className?: string
}) {
  const result = useTaskFiles(tasks)
  const [filter, setFilter] = useState<FileFilter>('all')
  const now = new Date()
  const shown = result.files.filter((file) => matches(filter, file.attachment.name))
  const bytes = result.files.reduce((sum, file) => sum + file.attachment.size, 0)

  let body: ReactNode
  if (result.isPending) body = <WidgetSkeleton rows={3} />
  else if (result.error && result.files.length === 0)
    body = <WidgetError message={result.error.message} onRetry={result.refetch} />
  else if (result.files.length === 0)
    body = (
      <WidgetEmpty icon={<Paperclip />} title="No files yet">
        Files attached to tasks show up here, with the task they belong to.
      </WidgetEmpty>
    )
  else
    body = (
      <div className="grid gap-3">
        <div
          role="group"
          aria-label="File type"
          className={cn(dash.segmentGroup, 'w-fit flex-wrap')}
        >
          {FILE_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={filter === option.key}
              onClick={() => {
                setFilter(option.key)
              }}
              className={dash.segment}
            >
              {option.label}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-grey">No files of this type.</p>
        ) : (
          <ul className="grid gap-2 @4xl/page:grid-cols-2">
            {shown.map(({ attachment, task }) => (
              <li
                key={attachment.id}
                className="flex min-w-0 items-center gap-3 rounded-[0.625rem] border border-[#F0F0F0] p-2.5 dark:border-white/5"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-[0.5rem] bg-[#F0E9FD] text-[#7127EA] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF] [&_svg]:size-5"
                >
                  {FILE_ICONS[fileKind(attachment.name)]}
                </span>
                <span className="grid min-w-0 flex-1">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(dash.link, 'truncate text-sm')}
                  >
                    {attachment.name}
                  </a>
                  <span className="truncate text-xs text-grey">
                    {formatFileSize(attachment.size)} · {whenLabel(attachment.uploadedAt, now)} ·{' '}
                    <TaskLink task={task} className="underline-offset-2 hover:underline">
                      {task.name}
                    </TaskLink>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )

  return (
    <Widget
      title="Resources and files"
      icon={<Paperclip />}
      description={
        result.files.length > 0
          ? `${plural(result.files.length, 'file')} · ${formatFileSize(bytes)}, attached to tasks`
          : 'Files attached to the tasks here.'
      }
      className={className}
    >
      {body}
    </Widget>
  )
}

// --- folders and lists -------------------------------------------------------------------------------

function Progress({ percent, label }: { percent: number; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(dash.track, 'flex-1')}
      >
        <span className={cn(dash.trackFill, 'block')} style={{ width: `${String(percent)}%` }} />
      </span>
      <span className="w-9 shrink-0 text-right text-xs font-semibold text-title tabular-nums">
        {percent}%
      </span>
    </span>
  )
}

/** Folders (projects): each with its lists, tasks done and a link to its Project Dashboard. */
export function FoldersWidget({
  workspaceId,
  folders,
  currentId = null,
  title = 'Folders',
  description = 'Each folder is a project. Open one for its own dashboard.',
  singleColumn = false,
  className,
}: {
  workspaceId: string
  folders: readonly FolderStat[]
  currentId?: string | null
  title?: string
  description?: string
  singleColumn?: boolean
  className?: string
}) {
  return (
    <Widget
      title={title}
      icon={<FolderOpen />}
      description={description}
      count={folders.length}
      className={className}
    >
      {folders.length === 0 ? (
        <WidgetEmpty icon={<Folder />} title="No folders yet">
          Add a folder from the Workspaces panel to group lists into a project.
        </WidgetEmpty>
      ) : (
        <ul className={cn('grid gap-2.5', !singleColumn && '@3xl/page:grid-cols-2')}>
          {folders.map((folder) => {
            const current = folder.id === currentId
            return (
              <li key={folder.id}>
                <Link
                  to="/project-management/project-dashboard"
                  search={{ workspace: workspaceId, folder: folder.id }}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'grid gap-2.5 rounded-[0.75rem] border p-3.5 transition-colors',
                    dash.focus,
                    current
                      ? 'border-[#7127EA] bg-[#F8F5FF] dark:border-[#9F7BF3] dark:bg-[#7127EA]/10'
                      : 'border-[#ECECEC] hover:border-[#D9C8FB] hover:bg-[#FCFAFF] dark:border-border dark:hover:bg-white/[0.03]',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-[#EEE7FF] text-[#7127EA] dark:bg-[#7127EA]/25 dark:text-[#C4ABFF]"
                    >
                      <Folder className="size-4" />
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate text-sm font-semibold text-title">
                        {folder.name}
                      </span>
                      <span className="text-xs text-grey">
                        {plural(folder.lists.length, 'list')} · {plural(folder.total, 'task')}
                      </span>
                    </span>
                    {folder.overdue > 0 && (
                      <span className={cn(dash.chip, dash.danger)}>{folder.overdue} overdue</span>
                    )}
                  </span>
                  <Progress percent={folder.percent} label={`${folder.name}: tasks done`} />
                  {folder.lists.length > 0 && (
                    // BRD row 7: a folder shows its first three lists, then "See more".
                    <span className="flex min-w-0 flex-wrap gap-1.5">
                      {folder.lists.slice(0, 3).map((list) => (
                        <span
                          key={list.id}
                          className={cn(dash.chip, dash.neutral, 'block max-w-full truncate')}
                        >
                          {list.name}
                        </span>
                      ))}
                      {folder.lists.length > 3 && (
                        <span className={cn(dash.chip, dash.lavender)}>
                          +{folder.lists.length - 3} more
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}

/** Lists with a progress bar each (BRD: "progress bar per list"); a list opens its List view. */
export function ListsWidget({
  workspaceId,
  lists,
  folderNames,
  className,
}: {
  workspaceId: string
  lists: readonly ListStat[]
  folderNames: ReadonlyMap<string, string>
  className?: string
}) {
  const [all, setAll] = useState(false)
  const shown = all ? lists : lists.slice(0, 6)
  return (
    <Widget
      title="Lists"
      icon={<ListChecks />}
      description="Tasks done in each list, subtasks included."
      count={lists.length}
      className={className}
    >
      {lists.length === 0 ? (
        <WidgetEmpty icon={<List />} title="No lists yet">
          Lists hold the tasks. Add one from the Workspaces panel.
        </WidgetEmpty>
      ) : (
        <div className="grid gap-2">
          <ul className="grid gap-1">
            {shown.map((list) => (
              <li key={list.id}>
                <Link
                  to="/project-management/workspaces/$workspaceId"
                  params={{ workspaceId }}
                  search={{ list: list.id }}
                  className={cn(
                    dash.row,
                    'grid grid-cols-[auto_minmax(0,1fr)] gap-y-1.5 @3xl/page:grid-cols-[auto_minmax(0,1fr)_12rem]',
                  )}
                >
                  <EntityGlyph entityType="task_list" />
                  <span className="grid min-w-0">
                    <span className="truncate text-sm font-medium text-title">{list.name}</span>
                    <span className="truncate text-xs text-grey">
                      {[
                        list.folderId ? folderNames.get(list.folderId) : null,
                        `${String(list.done)}/${String(list.total)} done`,
                        list.overdue > 0 ? `${String(list.overdue)} overdue` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="col-span-2 pl-11 @3xl/page:col-span-1 @3xl/page:pl-0">
                    <Progress percent={list.percent} label={`${list.name}: tasks done`} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {lists.length > 6 && (
            <button
              type="button"
              aria-expanded={all}
              onClick={() => {
                setAll((value) => !value)
              }}
              className={cn(dash.ghost, 'justify-self-start')}
            >
              {all ? 'See less' : `See all ${String(lists.length)}`}
            </button>
          )}
        </div>
      )}
    </Widget>
  )
}

// --- charts --------------------------------------------------------------------------------------

export function WorkloadWidget({
  slices,
  description,
  className,
}: {
  slices: StatusSlice[]
  description: string
  className?: string
}) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  return (
    <Widget
      title="Workload by Status"
      icon={<PieChart />}
      description={description}
      className={className}
    >
      {total === 0 ? (
        <WidgetEmpty icon={<PieChart />} title="No tasks yet">
          Once tasks are added, their spread over the statuses shows here.
        </WidgetEmpty>
      ) : (
        <StatusBreakdown title="Workload by status" slices={slices} />
      )}
    </Widget>
  )
}

export function AssigneeWidget({
  title,
  tasks,
  className,
}: {
  title: string
  tasks: readonly DashboardTask[]
  className?: string
}) {
  const rows = loadByAssignee(tasks)
  return (
    <Widget
      title={title}
      icon={<Users />}
      description="Open and done tasks per person; a task with two assignees counts for both."
      className={className}
    >
      {rows.length === 0 ? (
        <WidgetEmpty icon={<Users />} title="No tasks yet">
          Assign tasks to see who carries what.
        </WidgetEmpty>
      ) : (
        <AssigneeBars title={title} rows={rows} />
      )}
    </Widget>
  )
}

// --- latest activity ----------------------------------------------------------------------------------

const EVENT_META = {
  created: { icon: <PlusCircle />, verb: 'created', tone: 'text-[#2E64E2] dark:text-[#8FB0FF]' },
  completed: {
    icon: <CheckCircle2 />,
    verb: 'completed',
    tone: 'text-[#1E7B3A] dark:text-emerald-300',
  },
  commented: {
    icon: <MessageSquare />,
    verb: 'commented on',
    tone: 'text-[#7127EA] dark:text-[#C4ABFF]',
  },
} as const

/** Latest Activity: the newest creations, completions and comments, as a timeline. */
export function LatestActivityWidget({
  tasks,
  showWorkspace,
  className,
}: {
  tasks: readonly DashboardTask[]
  showWorkspace: boolean
  className?: string
}) {
  const events = latestEvents(tasks)
  const now = new Date()
  return (
    <Widget
      title="Latest Activity"
      icon={<History />}
      description="From the tasks themselves: when each was created, completed and last commented on."
      className={className}
    >
      {events.length === 0 ? (
        <WidgetEmpty icon={<History />} title="Nothing has happened yet" />
      ) : (
        <ol className="relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[0.9rem] before:w-px before:bg-[#ECECEC] dark:before:bg-border">
          {events.map((event) => {
            const meta = EVENT_META[event.kind]
            return (
              <li key={event.id} className="relative flex gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'z-[1] flex size-[1.8rem] shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-card dark:border-border [&_svg]:size-3.5',
                    meta.tone,
                  )}
                >
                  {meta.icon}
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  {event.who ? (
                    <p className="text-sm text-title">
                      <span className="font-semibold">{event.who}</span> {meta.verb}{' '}
                      <TaskLink task={event.task} className={dash.link}>
                        {event.task.name}
                      </TaskLink>
                    </p>
                  ) : (
                    // Who closed a task is not on its row: say what happened to it.
                    <p className="text-sm text-title">
                      <TaskLink task={event.task} className={dash.link}>
                        {event.task.name}
                      </TaskLink>{' '}
                      was {meta.verb}
                    </p>
                  )}
                  {event.text && (
                    <p className="line-clamp-2 rounded-md bg-[#F8F8F8] px-2.5 py-1.5 text-xs text-grey dark:bg-white/5">
                      {event.text}
                    </p>
                  )}
                  <p className="text-xs text-grey">
                    {whenLabel(event.at, now)}
                    {showWorkspace ? ` · ${event.task.workspaceName}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Widget>
  )
}

// --- due this week -----------------------------------------------------------------------------------

/** Due This Week or Overdue: open tasks, the overdue ones first, by due date. */
export function DueSoonWidget({
  tasks,
  showWorkspace,
  className,
}: {
  tasks: readonly DashboardTask[]
  showWorkspace: boolean
  className?: string
}) {
  const now = new Date()
  const sorted = tasks.toSorted(
    (a, b) =>
      Number(b.isOverdue) - Number(a.isOverdue) || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''),
  )
  return (
    <Widget
      title="Due This Week or Overdue"
      icon={<CalendarClock />}
      description="Open tasks due by Saturday, and those already late."
      count={tasks.length}
      className={className}
    >
      {sorted.length === 0 ? (
        <WidgetEmpty icon={<CheckCircle2 />} title="Nothing due this week">
          No open task is due before the week ends, and none is late.
        </WidgetEmpty>
      ) : (
        <ul className="grid gap-0.5">
          {sorted.map((task) => (
            <TaskLine
              key={task.id}
              task={task}
              showWorkspace={showWorkspace}
              trailing={
                <>
                  <AvatarStack task={task} />
                  <DueChip task={task} now={now} />
                </>
              }
            />
          ))}
        </ul>
      )}
    </Widget>
  )
}
