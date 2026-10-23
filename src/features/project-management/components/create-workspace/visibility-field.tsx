import { useId, useState } from 'react'

import { EmployeeAvatar } from '@/components/layout'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import type { PmPerson, Visibility } from '../../types/pm.types'
import { EmployeePickerDialog } from './employee-picker-dialog'
import { FormError, IconTile, RadioMark } from './wizard-controls'
import { AddMemberIcon, CloseIcon, DropdownChevronIcon, VisibilityIcon } from './wizard-icons'
import { wz } from './wizard-styles'

const OPTIONS: { value: Visibility; title: string; text: string }[] = [
  {
    value: 'private',
    title: 'Make Private',
    text: 'Only you and invited members can see this workspace. Workspace admins can delete the workspace or remove members.',
  },
  {
    value: 'public',
    title: 'Public',
    text: 'Anyone on the internet can see this workspace, only workspace members can edit.',
  },
  {
    value: 'workspace',
    title: 'Only Workspace',
    text: 'All members of the HRango workspace can see and edit this workspace',
  },
]

/** Avatars shown before the overflow count. */
const STACK_SIZE = 3

interface VisibilityFieldProps {
  visibility: Visibility | null
  memberIds: readonly string[]
  employees: readonly PmPerson[]
  people: ReadonlyMap<string, PmPerson>
  onVisibilityChange: (visibility: Visibility) => void
  onMembersChange: (ids: string[]) => void
  error: string | undefined
}

/**
 * Share Visibility (510:153602, 510:161107): the dropdown with Make Private, Public and Only
 * Workspace (the third row, below the fold of the list). Make
 * Private shows the "Share only with members" chip, the chosen members as stacked avatars (with
 * a "+n Members" list) and the add-member button that opens the members popup.
 */
export function VisibilityField({
  visibility,
  memberIds,
  employees,
  people,
  onVisibilityChange,
  onMembersChange,
  error,
}: VisibilityFieldProps) {
  const labelId = useId()
  const valueId = useId()
  const errorId = useId()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const members = memberIds.flatMap((id) => people.get(id) ?? [])
  const chosen = OPTIONS.find((option) => option.value === visibility)

  return (
    <div>
      <span id={labelId} className={wz.label}>
        Share Visibility
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn(wz.field, wz.fieldFocus, 'mt-3 p-0', error && wz.fieldInvalid)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-labelledby={`${labelId} ${valueId}`}
              aria-describedby={error ? errorId : undefined}
              className="flex min-h-[4.0625rem] w-full min-w-0 items-center gap-[1.0625rem] rounded-[1.125rem] px-5 text-left outline-none"
            >
              <IconTile>
                <VisibilityIcon className={cn('h-[1.07rem] w-[1.28rem]', wz.iconPurple)} />
              </IconTile>
              <span id={valueId} className={cn(wz.value, 'truncate text-[#3D3D3D]')}>
                {chosen?.title ?? 'Select visibility option'}
                {visibility === 'private' && members.length > 0 && (
                  <span className="sr-only">
                    , {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                )}
              </span>
              {visibility === 'private' && members.length > 0 && (
                <AvatarStack people={members} className="hidden sm:flex" />
              )}
              <DropdownChevronIcon
                className={cn(
                  'ml-auto h-[0.8125rem] w-[1.4375rem] shrink-0 text-[#7127EA] transition-transform',
                  open && 'rotate-180',
                )}
              />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn(wz.panel, 'rounded-[1.125rem] border-0 p-0')}
          // The members popup opens over the list; keep the list open behind it.
          onInteractOutside={(event) => {
            if (picking) event.preventDefault()
          }}
          onFocusOutside={(event) => {
            if (picking) event.preventDefault()
          }}
        >
          <div
            role="radiogroup"
            aria-labelledby={labelId}
            className={cn(
              wz.scrollbar,
              'flex max-h-[min(13.4375rem,50dvh)] flex-col gap-[1.5625rem] overflow-y-auto py-6 pr-3 pl-5',
            )}
          >
            {OPTIONS.map((option) => {
              const checked = visibility === option.value
              return (
                <div key={option.value} className="flex flex-col">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => {
                      onVisibilityChange(option.value)
                      if (option.value !== 'private') setOpen(false)
                    }}
                    className="flex items-start gap-4 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={wz.optionTitle}>{option.title}</span>
                      <span className={cn(wz.optionText, 'mt-2 max-w-[46.1875rem]')}>
                        {option.text}
                      </span>
                    </span>
                    <RadioMark checked={checked} className="mt-[0.2rem]" />
                  </button>
                  {option.value === 'private' && checked && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-11 items-center rounded-xl bg-[#DBD2FF]/28 px-4 text-[0.9375rem] leading-6 font-semibold tracking-[0.0168rem] text-[#7127EA] sm:w-[15.25rem] sm:text-base">
                        Share only with members
                      </span>
                      {members.length > 0 && (
                        <MembersOverflow
                          members={members}
                          onRemove={(id) => {
                            onMembersChange(memberIds.filter((other) => other !== id))
                          }}
                        />
                      )}
                      <button
                        type="button"
                        aria-label="Add members"
                        onClick={() => {
                          setPicking(true)
                        }}
                        className="ml-auto inline-flex size-[3.375rem] shrink-0 items-center justify-center rounded-full border border-dashed border-[#7127EA] bg-[#7127EA]/3 text-[#7127EA] transition-colors hover:bg-[#7127EA]/10 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
                      >
                        <AddMemberIcon className="h-5 w-[0.88rem]" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
      <FormError id={errorId} message={error} />
      <EmployeePickerDialog
        open={picking}
        onOpenChange={setPicking}
        title="Add Members"
        showTitle={false}
        employees={employees}
        multiple
        selected={memberIds}
        onConfirm={onMembersChange}
      />
    </div>
  )
}

/** Overlapping photos of the first members. */
function AvatarStack({ people, className }: { people: readonly PmPerson[]; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center', className)}>
      {people.slice(0, STACK_SIZE).map((person, index) => (
        <EmployeeAvatar
          key={person.id}
          name={person.name}
          photoUrl={person.photoUrl}
          className={cn('size-10 ring-2 ring-white', index > 0 && '-ml-3')}
          fallbackClassName="bg-[#7127EA] text-[#C9BCFF]"
        />
      ))}
    </span>
  )
}

/** The members' avatars and "+n Members", which lists everyone chosen with a remove button. */
function MembersOverflow({
  members,
  onRemove,
}: {
  members: readonly PmPerson[]
  onRemove: (id: string) => void
}) {
  const extra = members.length - STACK_SIZE
  return (
    <span className="flex items-center gap-2">
      <AvatarStack people={members} />
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Show all ${members.length} members`}
            className="inline-flex h-9 items-center rounded-full bg-[#7127EA]/10 px-3 text-[0.875rem] leading-5 font-medium text-[#7127EA] transition-colors hover:bg-[#7127EA]/15 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
          >
            {extra > 0
              ? `+${extra} Members`
              : `${members.length} ${members.length === 1 ? 'Member' : 'Members'}`}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(wz.menu, 'w-72 border-0 p-2')}
          aria-label="Members"
        >
          <ul className={cn(wz.scrollbar, 'flex max-h-64 flex-col gap-1 overflow-y-auto')}>
            {members.map((person) => (
              <li key={person.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <EmployeeAvatar
                  name={person.name}
                  photoUrl={person.photoUrl}
                  className="size-8"
                  fallbackClassName="bg-[#7127EA] text-[#C9BCFF]"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#5D5D5D]">
                  {person.name}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${person.name}`}
                  onClick={() => {
                    onRemove(person.id)
                  }}
                  className="inline-flex size-7 items-center justify-center rounded-full bg-[#EC474F]/10 text-[#DC3545] hover:bg-[#EC474F]/20 focus-visible:ring-2 focus-visible:ring-[#DC3545]/40 focus-visible:outline-none"
                >
                  <CloseIcon className="size-2.5" />
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  )
}
