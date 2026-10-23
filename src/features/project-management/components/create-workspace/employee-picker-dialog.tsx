import { useId, useMemo, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import type { PmPerson } from '../../types/pm.types'
import { CloseButton } from './wizard-controls'
import { SearchIcon, StepCheckIcon } from './wizard-icons'
import { wz } from './wizard-styles'

interface EmployeePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Add Workspace Owner" draws a title; the members popup has none (it gets a hidden one). */
  title: string
  showTitle: boolean
  employees: readonly PmPerson[]
  /** One owner, or any number of members. */
  multiple: boolean
  selected: readonly string[]
  onConfirm: (ids: string[]) => void
}

/**
 * Add Workspace Owner (1507:848711) and the members popup (510:161107): "Showing N Employees",
 * a search, the employee rows (photo or initials, Designation and Department chips) and the
 * purple "Add Member" button. Chosen rows show a lavender fill and a tick, which the design
 * leaves out.
 */
export function EmployeePickerDialog({ open, onOpenChange, ...props }: EmployeePickerDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={wz.popupOverlay} />
        <DialogPrimitive.Content aria-describedby={undefined} className={wz.popup}>
          <PickerBody
            {...props}
            onClose={() => {
              onOpenChange(false)
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PickerBody({
  title,
  showTitle,
  employees,
  multiple,
  selected,
  onConfirm,
  onClose,
}: Omit<EmployeePickerDialogProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [chosen, setChosen] = useState<readonly string[]>(selected)
  const listId = useId()

  const query = search.trim().toLowerCase()
  const shown = useMemo(
    () =>
      query
        ? employees.filter((person) =>
            [person.name, person.designation, person.department].some((text) =>
              text.toLowerCase().includes(query),
            ),
          )
        : employees,
    [employees, query],
  )

  const toggle = (id: string) => {
    if (!multiple) {
      setChosen([id])
      return
    }
    setChosen((previous) =>
      previous.includes(id) ? previous.filter((other) => other !== id) : [...previous, id],
    )
  }

  return (
    <div className="flex min-h-0 flex-col px-4 pt-5 pb-6 sm:px-5 sm:pt-[1.05rem] sm:pb-[1.875rem]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 pt-3">
          <DialogPrimitive.Title
            className={cn(
              'text-[1.25rem] leading-[2.0625rem] font-semibold text-[#393636] sm:text-[1.375rem]',
              !showTitle && 'sr-only',
            )}
          >
            {title}
          </DialogPrimitive.Title>
          <p
            aria-live="polite"
            className={cn(
              'text-base leading-[1.6875rem] font-medium text-[#393636] sm:text-[1.125rem]',
              showTitle && 'mt-2.5',
            )}
          >
            Showing {shown.length} Employees
          </p>
        </div>
        <DialogPrimitive.Close asChild>
          <CloseButton />
        </DialogPrimitive.Close>
      </div>

      <label className={cn(wz.search, 'mt-6 sm:mt-[1.7rem]')}>
        <SearchIcon className="ml-[0.1rem] size-[1.2rem] shrink-0 text-[#A181FF]" />
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
          }}
          aria-label="Search employee"
          aria-controls={listId}
          placeholder="Search employee here ..."
          className={wz.searchInput}
        />
      </label>

      <div
        id={listId}
        role={multiple ? 'group' : 'radiogroup'}
        aria-label={multiple ? 'Employees' : 'Employee'}
        className={cn(
          wz.scrollbar,
          'mt-6 flex max-h-[21.6875rem] min-h-0 flex-col gap-3 overflow-y-auto py-0.5 pr-2 pl-0.5 sm:mt-[2.0625rem]',
        )}
      >
        {shown.map((person) => {
          const isChosen = chosen.includes(person.id)
          return (
            <button
              key={person.id}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={isChosen}
              aria-label={`${person.name}, ${person.designation}, ${person.department}`}
              onClick={() => {
                toggle(person.id)
              }}
              className={cn(
                'flex w-full shrink-0 items-center gap-2.5 rounded-[3.5rem] bg-[#F4F4F4] px-2.5 py-3 text-left transition-colors outline-none hover:bg-[#EEEAF8] focus-visible:ring-2 focus-visible:ring-[#A181FF]',
                isChosen && 'bg-[#F0E9FD] ring-[1.5px] ring-[#7127EA] hover:bg-[#F0E9FD]',
              )}
            >
              <EmployeeAvatar
                name={person.name}
                photoUrl={person.photoUrl}
                className="size-12 sm:size-[3.9375rem]"
                fallbackClassName="bg-[#7127EA] text-[#C9BCFF] text-base sm:text-[1.17rem] font-medium"
              />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="truncate py-0.5 text-base leading-[1.1875rem] font-semibold text-[#5D5D5D] sm:text-[1.125rem]">
                  {person.name}
                </span>
                <span className="flex flex-col items-start gap-1.5">
                  <span className="rounded bg-[#FFF0D0] px-2.5 text-[0.8125rem] leading-[1.1875rem] font-medium text-[#5D5D5D] sm:text-[0.875rem]">
                    Designation: {person.designation}
                  </span>
                  <span className="rounded bg-[#FFD0D0] px-2.5 text-[0.8125rem] leading-[1.1875rem] font-medium text-[#5D5D5D] sm:text-[0.875rem]">
                    Department: {person.department}
                  </span>
                </span>
              </span>
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center"
              >
                {isChosen && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#7127EA] text-white">
                    <StepCheckIcon className="h-[0.6rem] w-[0.8rem]" />
                  </span>
                )}
              </span>
            </button>
          )
        })}
        {shown.length === 0 && (
          <p className="py-6 text-center text-base text-[#5D5D5D]">
            No employees match “{search}”.
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-center sm:mt-8">
        <button
          type="button"
          disabled={!multiple && chosen.length === 0}
          onClick={() => {
            onConfirm([...chosen])
            onClose()
          }}
          className={wz.addMember}
        >
          Add Member
        </button>
      </div>
    </div>
  )
}
