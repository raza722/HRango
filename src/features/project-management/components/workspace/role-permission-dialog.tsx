import { type ReactNode, useMemo, useState } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { EmployeeAvatar } from '@/components/layout/employee-avatar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { COLUMN_LABELS, PERMISSION_LABELS, ROLE_LABELS } from '../../constants'
import {
  type ColumnPermission,
  PERMISSION_LEVELS,
  type PermissionLevel,
  PM_ROLES,
  type PmPerson,
  type PmRole,
  type TaskColumnKey,
  type Workspace,
} from '../../types/pm.types'
import { roleOf } from './list-utils'
import { PERMISSION_DESCRIPTIONS, ROLE_PERMISSION_NOTE } from './permission-copy'
import {
  AddMembersIcon,
  CanEditIcon,
  CanViewIcon,
  ChevronDownIcon,
  CloseIcon,
  DefaultRoleIcon,
  PermissionIcon,
  PrivateIcon,
  SearchIcon,
} from './workspace-icons'
import { membersOf } from './workspace-members'
import { popupStyles } from './workspace-styles'

const LEVEL_ICONS: Record<PermissionLevel, typeof DefaultRoleIcon> = {
  default: DefaultRoleIcon,
  'can-edit': CanEditIcon,
  'can-view': CanViewIcon,
  private: PrivateIcon,
}

/** "Default Role" covers everyone; the other entries are the project roles. */
type RoleChoice = 'everyone' | PmRole

/** Dropdown buttons: 47 px, 0.73 px #E9E9E9, open 1 px purple with a 4 px purple glow. */
const dropdownClass =
  'flex h-[2.9375rem] w-full min-w-0 items-center gap-3 rounded-[0.8125rem] border-[0.045rem] border-[#E9E9E9] bg-white pr-4 pl-1.5 text-left text-[0.9085rem] leading-[1.5] text-[#454545] outline-none focus-visible:border-[#7127EA] focus-visible:ring-4 focus-visible:ring-[#7127EA]/20 data-[state=open]:border-[#7127EA] data-[state=open]:ring-4 data-[state=open]:ring-[#7127EA]/20'
const dropdownIcon =
  'flex h-[2.2425rem] w-[2.208rem] shrink-0 items-center justify-center rounded-[0.56rem] bg-[#F6F2FF] text-[#7127EA] [&_svg]:size-[1.15rem]'
const panelClass = cn(popupStyles.content, 'z-50 outline-none')

/**
 * "Set Role Permission" of a List view column (132:126211): a level per role ("Default Role" is
 * everyone in the workspace), each role's people, and custom levels for members or whole teams.
 */
export function RolePermissionDialog({
  columnKey,
  workspace,
  people,
  onOpenChange,
  onSave,
  saving,
}: {
  /** The column being set; null closes the dialog. */
  columnKey: TaskColumnKey | null
  workspace: Workspace
  people: ReadonlyMap<string, PmPerson>
  onOpenChange: (open: boolean) => void
  onSave: (key: TaskColumnKey, permission: ColumnPermission) => void
  saving: boolean
}) {
  const column = workspace.columns.find((entry) => entry.key === columnKey)
  return (
    <Dialog open={columnKey !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="max-w-[35.9375rem] gap-0 rounded-[0.8125rem] p-0 shadow-[0_0.18rem_0.78rem_rgba(0,0,0,0.14)]"
      >
        {columnKey && (
          <PermissionForm
            // A fresh draft for each column.
            key={columnKey}
            columnKey={columnKey}
            initial={column?.permission ?? { defaultLevel: 'default', roles: {}, members: [] }}
            workspace={workspace}
            people={people}
            saving={saving}
            onCancel={() => {
              onOpenChange(false)
            }}
            onSave={(permission) => {
              onSave(columnKey, permission)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PermissionForm({
  columnKey,
  initial,
  workspace,
  people,
  saving,
  onCancel,
  onSave,
}: {
  columnKey: TaskColumnKey
  initial: ColumnPermission
  workspace: Workspace
  people: ReadonlyMap<string, PmPerson>
  saving: boolean
  onCancel: () => void
  onSave: (permission: ColumnPermission) => void
}) {
  const [draft, setDraft] = useState<ColumnPermission>(() => structuredClone(initial))
  const [role, setRole] = useState<RoleChoice>('everyone')

  const members = useMemo(() => membersOf(workspace, people), [workspace, people])
  const byRole = (choice: PmRole) =>
    members.filter((person) => roleOf(person, workspace) === choice)

  const level: PermissionLevel | undefined =
    role === 'everyone' ? draft.defaultLevel : draft.roles[role]

  const setLevel = (next: PermissionLevel) => {
    setDraft((current) =>
      role === 'everyone'
        ? { ...current, defaultLevel: next }
        : { ...current, roles: { ...current.roles, [role]: next } },
    )
  }

  const addMembers = (ids: readonly string[]) => {
    setDraft((current) => {
      const have = new Set(current.members.map((entry) => entry.employeeId))
      const added = ids
        .filter((id) => !have.has(id))
        .map((employeeId): ColumnPermission['members'][number] => ({
          employeeId,
          level: 'can-edit',
        }))
      return { ...current, members: [...current.members, ...added] }
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave(draft)
      }}
      className="flex max-h-[calc(100dvh-2rem)] flex-col"
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-6">
        <div className="min-w-0">
          <DialogTitle className="font-sans text-[1.375rem] leading-[1.5] font-semibold text-[#393636] sm:text-[1.375rem]">
            Set Role Permission
          </DialogTitle>
          <p className="text-xs font-medium text-[#909090]">{COLUMN_LABELS[columnKey]} column</p>
        </div>
        <DialogClose
          aria-label="Close"
          className="flex h-[2.468rem] w-10 shrink-0 items-center justify-center rounded-[0.583rem] bg-[#EC474F]/10 text-[#DC3545] transition-colors hover:bg-[#EC474F]/20"
        >
          <CloseIcon className="size-[1.25rem]" />
        </DialogClose>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 pb-2">
        <DialogDescription className={popupStyles.text + ' leading-[1.5]'}>
          {ROLE_PERMISSION_NOTE}
        </DialogDescription>

        <div className="mt-6 grid gap-[1.3125rem] sm:grid-cols-2">
          <Dropdown
            label="Default Role"
            icon={<DefaultRoleIcon />}
            text={role === 'everyone' ? 'Default Role' : ROLE_LABELS[role]}
          >
            {(close) => (
              <ul aria-label="Roles" className="flex flex-col gap-1.5">
                <RoleOption
                  label="Default Role"
                  hint="Everyone in the workspace"
                  level={draft.defaultLevel}
                  selected={role === 'everyone'}
                  onPick={() => {
                    setRole('everyone')
                    close()
                  }}
                />
                {PM_ROLES.map((entry) => (
                  <RoleOption
                    key={entry}
                    label={ROLE_LABELS[entry]}
                    hint={`${byRole(entry).length} people`}
                    level={draft.roles[entry]}
                    selected={role === entry}
                    onPick={() => {
                      setRole(entry)
                      close()
                    }}
                  />
                ))}
              </ul>
            )}
          </Dropdown>
          <Dropdown
            label={`${role === 'everyone' ? 'Default Role' : ROLE_LABELS[role]} permission`}
            icon={<PermissionIcon />}
            text={level ? PERMISSION_LABELS[level] : 'Set Permissions'}
          >
            {(close) => (
              <LevelList
                value={level ?? 'default'}
                onPick={(next) => {
                  setLevel(next)
                  close()
                }}
              />
            )}
          </Dropdown>
        </div>

        {role !== 'everyone' && (
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-[#4A4A4A]">{ROLE_LABELS[role]} employees</p>
            <ul
              aria-label={`${ROLE_LABELS[role]} employees`}
              className="flex max-h-40 flex-col gap-1.5 overflow-y-auto"
            >
              {byRole(role).length === 0 && (
                <li className="text-xs text-[#909090]">No one in this role yet.</li>
              )}
              {byRole(role).map((person) => (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-[#F4F4F4] px-2 py-1.5"
                >
                  <EmployeeAvatar
                    name={person.name}
                    photoUrl={person.photoUrl}
                    className="size-6"
                    fallbackClassName="text-[0.5rem]"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#5D5D5D]">
                    {person.name}
                  </span>
                  <PersonChips person={person} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <hr className="mt-[2.6875rem] border-t-[0.1136rem] border-black/[0.08]" />

        <h3 className="mt-[2.1rem] text-[0.8177rem] leading-[1.5] font-semibold text-[#4A4A4A]">
          Custom Permissions
        </h3>
        <p className="mt-2 text-xs leading-[1.5] font-medium text-[#4A4A4A]">
          Custom permissions for specific members or teams.
        </p>
        <div className="mt-[1.75rem]">
          <MemberPicker
            members={members}
            chosen={new Set(draft.members.map((entry) => entry.employeeId))}
            onAdd={addMembers}
          />
        </div>
        {draft.members.length > 0 && (
          <ul aria-label="Custom permissions" className="mt-3 flex flex-col gap-2">
            {draft.members.map((entry) => {
              const person =
                people.get(entry.employeeId) ??
                members.find((member) => member.id === entry.employeeId)
              if (!person) return null
              return (
                <li
                  key={entry.employeeId}
                  className="flex flex-col gap-1.5 rounded-[0.625rem] bg-[#F4F4F4] px-2.5 py-2"
                >
                  <div className="flex items-center gap-2">
                    <EmployeeAvatar
                      name={person.name}
                      photoUrl={person.photoUrl}
                      className="size-7"
                      fallbackClassName="text-[0.55rem]"
                    />
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-[#5D5D5D]">
                      {person.name}
                    </span>
                    <span className="shrink-0 rounded bg-[#F0E9FD] px-2 py-0.5 text-[0.6875rem] font-medium text-[#A181FF]">
                      {ROLE_LABELS[roleOf(person, workspace)]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pl-9">
                    <PersonChips person={person} />
                    <span className="ml-auto flex items-center gap-1">
                      <LevelPill
                        label={person.name}
                        value={entry.level}
                        onChange={(next) => {
                          setDraft((current) => ({
                            ...current,
                            members: current.members.map((other) =>
                              other.employeeId === entry.employeeId
                                ? { ...other, level: next }
                                : other,
                            ),
                          }))
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${person.name}`}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            members: current.members.filter(
                              (other) => other.employeeId !== entry.employeeId,
                            ),
                          }))
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-[#DC3545] hover:bg-[#EC474F]/10"
                      >
                        <CloseIcon className="size-3.5" />
                      </button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex justify-center gap-3 px-5 pt-4 pb-5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-[3.75rem] w-full max-w-[11.4rem] items-center justify-center rounded-[0.81rem] bg-[#B7192C] text-[0.912rem] font-semibold text-white transition-colors hover:bg-[#9b1524]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-[3.75rem] w-full max-w-[11.2rem] items-center justify-center rounded-[0.67rem] bg-[#318845] text-[0.912rem] font-semibold text-white transition-colors hover:bg-[#287238] disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </form>
  )
}

function PersonChips({ person }: { person: PmPerson }) {
  return (
    <>
      <span className="rounded bg-[#FFF0D0] px-1.5 text-[0.6875rem] leading-[1.2rem] font-medium text-[#5D5D5D]">
        Designation: {person.designation}
      </span>
      <span className="rounded bg-[#FFD0D0] px-1.5 text-[0.6875rem] leading-[1.2rem] font-medium text-[#5D5D5D]">
        Department: {person.department}
      </span>
    </>
  )
}

/** One of the dialog's drop-down boxes, opening a panel under it. */
function Dropdown({
  label,
  icon,
  text,
  children,
}: {
  /** Accessible name of the button. */
  label: string
  icon: ReactNode
  text: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" aria-label={`${label}: ${text}`} className={dropdownClass}>
          <span className={dropdownIcon}>{icon}</span>
          <span className="min-w-0 flex-1 truncate">{text}</span>
          <ChevronDownIcon className="h-[0.42rem] w-[0.78rem] shrink-0 text-[#7127EA]" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className={cn(panelClass, 'w-(--radix-popover-trigger-width) min-w-[16rem] p-2')}
        >
          {children(() => {
            setOpen(false)
          })}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function RoleOption({
  label,
  hint,
  level,
  selected,
  onPick,
}: {
  label: string
  hint: string
  level: PermissionLevel | undefined
  selected: boolean
  onPick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onPick}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]',
          selected
            ? 'border-[#A181FF] bg-[#F8F5FF]'
            : 'border-[#E9E9E9] bg-white hover:bg-[#FAFAFA]',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium text-[#454545]">
            {label}
          </span>
          <span className="block truncate text-[0.6875rem] text-[#909090]">{hint}</span>
        </span>
        <span className="shrink-0 text-[0.6875rem] font-medium text-[#7127EA]">
          {PERMISSION_LABELS[level ?? 'default']}
        </span>
      </button>
    </li>
  )
}

/** The levels with their descriptions (the cards beside 228:145854). */
function LevelList({
  value,
  onPick,
  label = 'Permission',
}: {
  value: PermissionLevel
  onPick: (level: PermissionLevel) => void
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      {PERMISSION_LEVELS.map((entry) => {
        const Icon = LEVEL_ICONS[entry]
        const checked = entry === value
        return (
          <button
            key={entry}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => {
              onPick(entry)
            }}
            className={cn(
              'flex items-start gap-2 rounded-lg border p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]',
              checked
                ? 'border-[#A181FF] bg-[#F8F5FF]'
                : 'border-[#E9E9E9] bg-white hover:bg-[#FAFAFA]',
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-[#7127EA]" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[#7127EA]">
                {PERMISSION_LABELS[entry]}
              </span>
              <span className="block text-[0.6875rem] leading-snug text-[#707070]">
                {PERMISSION_DESCRIPTIONS[entry]}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[0.2rem] border',
                checked ? 'border-[#7127EA] bg-[#7127EA] text-white' : 'border-[#BDBDBD]',
              )}
            >
              {checked && (
                <svg
                  viewBox="0 0 12 12"
                  className="size-2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M2.5 6.2 5 8.5l4.5-5" />
                </svg>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** A member's level: a pill opening the same level cards. */
function LevelPill({
  label,
  value,
  onChange,
}: {
  label: string
  value: PermissionLevel
  onChange: (level: PermissionLevel) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`${label} permission: ${PERMISSION_LABELS[value]}`}
          className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[#7127EA] bg-white px-2 text-[0.6875rem] font-medium text-[#7127EA] outline-none hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#A181FF]"
        >
          {PERMISSION_LABELS[value]}
          <ChevronDownIcon className="h-1.5 w-2.5" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className={cn(panelClass, 'w-[17rem] p-2')}
        >
          <LevelList
            label={`${label} permission`}
            value={value}
            onPick={(next) => {
              onChange(next)
              setOpen(false)
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

/** "Add Members or Teams": the workspace's people, and its departments as teams. */
function MemberPicker({
  members,
  chosen,
  onAdd,
}: {
  members: readonly PmPerson[]
  chosen: ReadonlySet<string>
  onAdd: (ids: readonly string[]) => void
}) {
  const [query, setQuery] = useState('')
  const text = query.trim().toLowerCase()
  const teams = [...new Set(members.map((person) => person.department))].sort()
  const shownTeams = teams.filter((team) => team.toLowerCase().includes(text))
  const shownPeople = members.filter(
    (person) =>
      !chosen.has(person.id) &&
      (person.name.toLowerCase().includes(text) || person.designation.toLowerCase().includes(text)),
  )

  return (
    <Dropdown label="Add Members or Teams" icon={<AddMembersIcon />} text="Add Members or Teams">
      {(close) => (
        <div className="flex max-h-[20rem] flex-col gap-2">
          <label className="relative block">
            <span className="sr-only">Search members or teams</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#7127EA]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              placeholder="Search members or teams..."
              className={cn(popupStyles.field, 'h-9 rounded-full pl-9 text-xs')}
            />
          </label>
          <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
            {shownTeams.length > 0 && (
              <p className="px-1 text-[0.6875rem] font-semibold text-[#909090]">Teams</p>
            )}
            {shownTeams.map((team) => {
              const ids = members
                .filter((person) => person.department === team)
                .map((person) => person.id)
              return (
                <button
                  key={team}
                  type="button"
                  onClick={() => {
                    onAdd(ids)
                    close()
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#454545] hover:bg-[#F8F5FF] focus-visible:bg-[#F8F5FF] focus-visible:outline-none"
                >
                  <span className="truncate">{team}</span>
                  <span className="shrink-0 text-[0.6875rem] text-[#909090]">
                    {ids.length} members
                  </span>
                </button>
              )
            })}
            {shownPeople.length > 0 && (
              <p className="px-1 pt-1 text-[0.6875rem] font-semibold text-[#909090]">Members</p>
            )}
            {shownPeople.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  onAdd([person.id])
                  close()
                }}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#F8F5FF] focus-visible:bg-[#F8F5FF] focus-visible:outline-none"
              >
                <EmployeeAvatar
                  name={person.name}
                  photoUrl={person.photoUrl}
                  className="size-6"
                  fallbackClassName="text-[0.5rem]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-[#454545]">{person.name}</span>
                  <span className="block truncate text-[0.6875rem] text-[#909090]">
                    {person.designation}
                  </span>
                </span>
              </button>
            ))}
            {shownTeams.length === 0 && shownPeople.length === 0 && (
              <p className="px-2 py-3 text-xs text-[#909090]">No one matches.</p>
            )}
          </div>
        </div>
      )}
    </Dropdown>
  )
}
