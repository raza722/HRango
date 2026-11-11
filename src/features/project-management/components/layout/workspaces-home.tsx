import { Link } from '@tanstack/react-router'
import { Eye, Lock, Plus, Star, Users } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useWorkspaceTree } from '../../hooks/use-pm'
import { usePmAccess } from '../../hooks/use-pm-access'
import type { Visibility, WorkspaceSummary } from '../../types/pm.types'
import { CreateWorkspaceLanding } from './create-workspace-landing'

const VISIBILITY: Record<Visibility, { label: string; Icon: typeof Lock }> = {
  private: { label: 'Private', Icon: Lock },
  public: { label: 'Everyone can view', Icon: Eye },
  workspace: { label: 'Everyone can work in it', Icon: Users },
}

/**
 * Sidebar → Project Management → Workspaces: the workspaces the person can open, favourites
 * first, each a card that opens it; Create Workspace beside the title. With none yet it is the
 * design's Create Workspace page (the illustration and its one call to action).
 */
export function WorkspacesHome({ onCreate }: { onCreate: () => void }) {
  const tree = useWorkspaceTree()
  const access = usePmAccess(null)

  if (tree.isPending) {
    return (
      <div role="status" aria-label="Loading workspaces" className="grid gap-4">
        <Skeleton className="h-10 w-56 bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-36 rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    )
  }
  if (tree.isError) {
    return (
      <ErrorState
        title="Could not load the workspaces"
        message={tree.error.message}
        onRetry={() => {
          void tree.refetch()
        }}
      />
    )
  }

  const workspaces = tree.data.workspaces
    .filter((workspace) => !workspace.hidden)
    .toSorted((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name))
  if (workspaces.length === 0) return <CreateWorkspaceLanding onCreate={onCreate} />

  return (
    <section aria-labelledby="workspaces-heading" className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="workspaces-heading"
            className="text-xl leading-tight font-semibold text-[#303030] sm:text-2xl dark:text-title"
          >
            Workspaces
          </h1>
          <p className="mt-1 text-sm text-[#707070] dark:text-grey">
            {workspaces.length === 1
              ? 'The workspace you can open.'
              : `The ${String(workspaces.length)} workspaces you can open.`}
          </p>
        </div>
        {access.createWorkspace && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7127EA] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.5} />
            Create Workspace
          </button>
        )}
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <WorkspaceCard workspace={workspace} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceSummary }) {
  const { label, Icon } = VISIBILITY[workspace.visibility]
  return (
    <Link
      to="/project-management/workspaces/$workspaceId"
      params={{ workspaceId: workspace.id }}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-[#ECECEC] bg-white p-5 shadow-xs transition-colors outline-none hover:border-[#A181FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] dark:border-border dark:bg-card"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F0E9FD] text-base font-semibold text-[#7127EA] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF]"
        >
          {workspace.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-[#303030] group-hover:text-[#7127EA] dark:text-title">
            {workspace.name}
          </span>
          <span className="block truncate text-xs text-[#707070] dark:text-grey">
            {workspace.departmentName ?? 'No department'}
            {workspace.ownerName ? ` · Owner: ${workspace.ownerName}` : ''}
          </span>
        </span>
        {workspace.favorite && (
          <Star aria-label="Favourite" className="size-4 shrink-0 fill-[#F79009] text-[#F79009]" />
        )}
      </div>
      <p
        className={cn(
          'line-clamp-2 min-h-10 text-sm',
          workspace.description
            ? 'text-[#5D5D5D] dark:text-grey'
            : 'text-[#A4A4A4] italic dark:text-grey',
        )}
      >
        {workspace.description || 'No description yet.'}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-[#5D5D5D] dark:text-grey">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F4F4F4] px-2 py-1 dark:bg-white/5">
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F4F4F4] px-2 py-1 dark:bg-white/5">
          <Users aria-hidden="true" className="size-3.5" />
          {workspace.memberCount} {workspace.memberCount === 1 ? 'member' : 'members'}
        </span>
      </div>
    </Link>
  )
}
