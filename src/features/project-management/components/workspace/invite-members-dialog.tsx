import { useMemo, useState } from 'react'

import { EmployeeAvatar } from '@/components/layout/employee-avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { pmButton, pmCloseButton } from '../../pm-styles'
import type { PmPerson, Workspace } from '../../types/pm.types'
import { CloseIcon, SearchIcon } from './workspace-icons'

/**
 * "Invite Members": pick employees to add to the workspace (styled as the wizard's Add Members
 * popup 510:161107: search, rows with Designation and Department chips, a purple button).
 */
export function InviteMembersDialog({
  open,
  onOpenChange,
  workspace,
  employees,
  onInvite,
  saving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace
  employees: readonly PmPerson[]
  onInvite: (ids: string[]) => void
  saving: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className="max-w-[34rem] gap-0 rounded-[1.125rem] p-0">
        {open && (
          <InviteForm
            workspace={workspace}
            employees={employees}
            saving={saving}
            onInvite={onInvite}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({
  workspace,
  employees,
  saving,
  onInvite,
}: {
  workspace: Workspace
  employees: readonly PmPerson[]
  saving: boolean
  onInvite: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const members = useMemo(() => new Set(workspace.memberIds), [workspace.memberIds])
  const text = query.trim().toLowerCase()
  const candidates = employees.filter(
    (person) =>
      !members.has(person.id) &&
      (!text ||
        person.name.toLowerCase().includes(text) ||
        person.designation.toLowerCase().includes(text) ||
        person.department.toLowerCase().includes(text)),
  )

  const toggle = (id: string, on: boolean) => {
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (chosen.size) onInvite([...chosen])
      }}
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <DialogTitle className="font-sans text-xl font-medium text-[#303030] sm:text-xl">
            Invite Members
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-[#707070]">
            People you invite can see and work in {workspace.name}.
          </DialogDescription>
        </div>
        <DialogClose className={pmCloseButton} aria-label="Close">
          <CloseIcon className="size-4" />
        </DialogClose>
      </div>

      <label className="flex h-11 items-center gap-2 rounded-full bg-white px-4 shadow-[0_0_12.95px_rgba(0,0,0,0.12)]">
        <SearchIcon className="size-5 shrink-0 text-[#A181FF]" />
        <span className="sr-only">Search employee</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          placeholder="Search employee here..."
          className="min-w-0 flex-1 bg-transparent text-sm text-[#303030] outline-none placeholder:text-[#909090]"
        />
      </label>

      <ul
        aria-label="Employees"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
      >
        {candidates.length === 0 && (
          <li className="py-6 text-center text-sm text-[#909090]">
            {text ? 'No employee matches your search.' : 'Everyone is already a member.'}
          </li>
        )}
        {candidates.map((person) => {
          const checked = chosen.has(person.id)
          const id = `invite-${person.id}`
          return (
            <li key={person.id}>
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-full bg-[#F4F4F4] py-1.5 pr-4 pl-1.5',
                  checked && 'bg-[#F0E9FD]',
                )}
              >
                <EmployeeAvatar name={person.name} photoUrl={person.photoUrl} className="size-11" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-semibold text-[#5D5D5D]">
                    {person.name}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <span className="rounded bg-[#FFF0D0] px-1.5 text-[0.6875rem] leading-[1.2rem] font-medium text-[#5D5D5D]">
                      Designation: {person.designation}
                    </span>
                    <span className="rounded bg-[#FFD0D0] px-1.5 text-[0.6875rem] leading-[1.2rem] font-medium text-[#5D5D5D]">
                      Department: {person.department}
                    </span>
                  </span>
                </span>
                <Checkbox
                  id={id}
                  tone="violet"
                  checked={checked}
                  aria-label={`Invite ${person.name}`}
                  onCheckedChange={(value) => {
                    toggle(person.id, value === true)
                  }}
                />
              </label>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#393636]">
          Showing {candidates.length} Employees
        </span>
        <button
          type="submit"
          disabled={chosen.size === 0 || saving}
          className={cn(pmButton.primary, 'h-11 rounded-2xl px-6 text-sm')}
        >
          {chosen.size > 1 ? `Invite ${chosen.size} Members` : 'Invite Member'}
        </button>
      </div>
    </form>
  )
}
