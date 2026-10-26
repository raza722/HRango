import { useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { EmployeeAvatar } from '@/components/layout/employee-avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { ROLE_LABELS, WORKSPACE_NAME_MAX } from '../../constants'
import { usePmAccess } from '../../hooks/use-pm-access'
import type { PmPerson, Workspace, WorkspacePatch } from '../../types/pm.types'
import { CoverPopover, DescriptionPopover } from './banner-popovers'
import { coverStyle } from './covers'
import { InviteMembersDialog } from './invite-members-dialog'
import { PmMenu, PmMenuContent, PmMenuItem, PmMenuTrigger } from './menu-parts'
import {
  AppsIcon,
  CopyLinkIcon,
  DotsIcon,
  FavoriteIcon,
  InviteIcon,
  RenameIcon,
  SearchIcon,
} from './workspace-icons'
import { membersOf } from './workspace-members'
import { bannerStyles, popupStyles } from './workspace-styles'

/** Avatars drawn before the "16 +" bubble. */
const SHOWN_MEMBERS = 3

/** "Quick Action Menu": the module's dashboards. */
const APPS = [
  { to: '/project-management/home', label: 'Home Dashboard' },
  { to: '/project-management/workspace-dashboard', label: 'Workspace Dashboard' },
  { to: '/project-management/project-dashboard', label: 'Project Dashboard' },
  { to: '/project-management/task-dashboard', label: 'Task Dashboard' },
] as const

const avatarRing = 'size-[2.875rem] border-[0.16rem] border-white'

/**
 * The workspace header (Cover BG Section 1:3842): cover image, name and "Workspace", the four
 * frosted buttons (Workspace Settings, Add Description, Change Cover, Quick Action Menu), the
 * task search, the members and "Invite Members".
 */
export function WorkspaceBanner({
  workspace,
  people,
  employees,
  query,
  onQueryChange,
  onSave,
  saving,
}: {
  workspace: Workspace
  people: ReadonlyMap<string, PmPerson>
  employees: readonly PmPerson[]
  query: string
  onQueryChange: (query: string) => void
  onSave: (patch: WorkspacePatch, success?: string) => Promise<boolean>
  saving: boolean
}) {
  const router = useRouter()
  const [inviting, setInviting] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const renameFocus = useRef(false)
  const access = usePmAccess(workspace)
  const members = membersOf(workspace, people)
  const roleOf = (id: string) =>
    workspace.members.find((member) => member.employeeId === id)?.role ?? 'contributors'
  const extra = members.length - SHOWN_MEMBERS

  const copyLink = async () => {
    const { href } = router.buildLocation({
      to: '/project-management/workspaces/$workspaceId',
      params: { workspaceId: workspace.id },
    })
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <header
      className="flex min-h-[11.25rem] flex-col justify-between gap-4 rounded-[0.9375rem] bg-[#A181FF] p-5"
      style={coverStyle(workspace.cover?.url ?? null)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <RenameField
              initial={workspace.name}
              onDone={(name) => {
                setRenaming(false)
                if (name && name !== workspace.name) void onSave({ name }, 'Workspace renamed')
              }}
            />
          ) : (
            <h1
              id="workspace-title"
              className="truncate text-2xl leading-tight font-bold text-white sm:text-[2.25rem] sm:leading-[3.375rem]"
            >
              {workspace.name}
            </h1>
          )}
          <p className="text-base leading-tight font-medium text-white sm:-mt-1.5 sm:text-[1.375rem] sm:leading-[2.0625rem]">
            Workspace
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 sm:mt-1.5 sm:gap-5">
          <PmMenu modal={false}>
            <PmMenuTrigger asChild>
              <button type="button" className={bannerStyles.iconButton}>
                <DotsIcon className="h-[0.386rem] w-[1.54rem] shrink-0" />
                <span className={bannerStyles.label}>Workspace Settings</span>
              </button>
            </PmMenuTrigger>
            <PmMenuContent
              align="end"
              className="w-[17.7rem]"
              onCloseAutoFocus={(event) => {
                // The rename box keeps the focus.
                if (renameFocus.current) event.preventDefault()
                renameFocus.current = false
              }}
            >
              {access.editWorkspace && (
                <PmMenuItem
                  icon={<RenameIcon />}
                  onSelect={() => {
                    renameFocus.current = true
                    setRenaming(true)
                  }}
                >
                  Rename Workspace
                </PmMenuItem>
              )}
              <PmMenuItem
                icon={<FavoriteIcon />}
                onSelect={() => {
                  void onSave(
                    { favorite: !workspace.favorite },
                    workspace.favorite ? 'Removed from favorites' : 'Added to favorites',
                  )
                }}
              >
                {workspace.favorite ? 'Remove from Favorite' : 'Add to Favorite'}
              </PmMenuItem>
              <PmMenuItem
                icon={<CopyLinkIcon />}
                onSelect={() => {
                  void copyLink()
                }}
              >
                Copy link
              </PmMenuItem>
            </PmMenuContent>
          </PmMenu>
          {access.editWorkspace && <DescriptionPopover workspace={workspace} onSave={onSave} />}
          {access.editWorkspace && <CoverPopover workspace={workspace} />}
          <PmMenu modal={false}>
            <PmMenuTrigger asChild>
              <button type="button" className={bannerStyles.iconButton}>
                <AppsIcon className="size-[1.4375rem] shrink-0" />
                <span className={bannerStyles.label}>Quick Action Menu</span>
              </button>
            </PmMenuTrigger>
            <PmMenuContent align="end" className="w-[17.7rem]">
              {APPS.map((app) => (
                <PmMenuItem key={app.to} asChild>
                  <Link to={app.to}>{app.label}</Link>
                </PmMenuItem>
              ))}
            </PmMenuContent>
          </PmMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-[1.4rem] gap-y-3">
        <label
          className={cn(
            bannerStyles.frosted,
            'flex h-11 min-w-0 flex-1 basis-60 items-center gap-3 rounded-full pr-5 pl-3',
          )}
        >
          <SearchIcon className="size-[1.2rem] shrink-0 text-[#7127EA]" />
          <span className="sr-only">Search tasks</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value)
            }}
            placeholder="Search here ..."
            className="min-w-0 flex-1 bg-transparent text-[1.0547rem] text-[#1D1A1A] outline-none placeholder:text-[#1D1A1A]"
          />
        </label>
        <div className="ml-auto flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${members.length} members`}
                className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {members.slice(0, SHOWN_MEMBERS).map((person, index) => (
                  <EmployeeAvatar
                    key={person.id}
                    name={person.name}
                    photoUrl={person.photoUrl}
                    className={cn(avatarRing, index > 0 && '-ml-[0.6875rem]')}
                  />
                ))}
                {extra > 0 && (
                  <span
                    className={cn(
                      avatarRing,
                      '-ml-[0.6875rem] flex items-center justify-center rounded-full bg-[#7127EA] text-[1.17rem] leading-none font-medium text-white',
                    )}
                  >
                    {extra} +
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className={cn(popupStyles.content, 'w-80')}>
              <h2 className="px-1 pb-2 text-base font-semibold text-[#393636]">
                {members.length} Members
              </h2>
              <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                {members.map((person) => (
                  <li
                    key={person.id}
                    className="flex items-center gap-2.5 rounded-full bg-[#F4F4F4] py-1 pr-3 pl-1"
                  >
                    <EmployeeAvatar
                      name={person.name}
                      photoUrl={person.photoUrl}
                      className="size-8"
                      fallbackClassName="text-[0.6rem]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#5D5D5D]">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-[#909090]">
                        {person.designation}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-[#F0E9FD] px-2 py-0.5 text-[0.6875rem] text-[#7127EA]">
                      {person.id === workspace.ownerId ? 'Owner' : ROLE_LABELS[roleOf(person.id)]}
                    </span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
          {access.editWorkspace && (
            <button
              type="button"
              onClick={() => {
                setInviting(true)
              }}
              className={cn(
                bannerStyles.frosted,
                'inline-flex h-[3.125rem] shrink-0 items-center gap-3 rounded-full border border-dashed border-[#7127EA] px-7 text-lg font-semibold text-[#1D1A1A] transition-colors hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none',
              )}
            >
              <InviteIcon className="h-[1.332rem] w-[0.9375rem] shrink-0 text-[#262424]" />
              Invite Members
            </button>
          )}
        </div>
      </div>

      <InviteMembersDialog
        open={inviting}
        onOpenChange={setInviting}
        workspace={workspace}
        employees={employees}
        saving={saving}
        onInvite={(ids) => {
          void onSave(
            { addMemberIds: ids },
            ids.length === 1 ? 'Member invited' : `${ids.length} members invited`,
          ).then((ok) => {
            if (ok) setInviting(false)
          })
        }}
      />
    </header>
  )
}

function RenameField({
  initial,
  onDone,
}: {
  initial: string
  onDone: (name: string | null) => void
}) {
  return (
    <input
      autoFocus
      defaultValue={initial}
      maxLength={WORKSPACE_NAME_MAX}
      aria-label="Workspace name"
      onFocus={(event) => {
        event.currentTarget.select()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          onDone(event.currentTarget.value.trim())
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onDone(null)
        }
      }}
      onBlur={(event) => {
        onDone(event.currentTarget.value.trim())
      }}
      className={cn(
        bannerStyles.frosted,
        'h-[3.375rem] w-full max-w-[40rem] rounded-xl border border-white/70 px-3 text-2xl font-bold text-[#1D1A1A] outline-none',
      )}
    />
  )
}
