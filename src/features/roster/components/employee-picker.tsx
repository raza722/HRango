import { useId, useState } from 'react'
import { type Control, useController } from 'react-hook-form'
import { Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

import { useEnrollmentCandidates } from '../hooks/use-roster-enrollments'
import type { EnrollmentFormValues } from '../schemas/enrollment-form.schema'
import type { EnrollmentCandidate } from '../types/roster.types'

interface EmployeePickerProps {
  control: Control<EnrollmentFormValues>
  groupId: string
}

/** Why a person cannot be picked, if they cannot. */
function blockedReason(candidate: EnrollmentCandidate, groupId: string): string | null {
  if (!candidate.currentRoster) return null
  return candidate.currentRoster.id === groupId
    ? 'Already on this roster'
    : `On ${candidate.currentRoster.title}`
}

/**
 * Searchable checklist of employees for "Enroll New Employee". People already
 * on a roster are shown but cannot be ticked (one roster per person at a time).
 */
export function EmployeePicker({ control, groupId }: EmployeePickerProps) {
  const labelId = useId()
  const errorId = useId()
  const [text, setText] = useState('')
  const search = useDebouncedValue(text.trim(), 250)
  const candidates = useEnrollmentCandidates(groupId, search)
  const {
    field: { value, onChange },
    fieldState,
  } = useController({ control, name: 'employeeIds' })
  const selected = new Set(value)

  const available = (candidates.data ?? []).filter(
    (candidate) => blockedReason(candidate, groupId) === null,
  )
  // People who can be picked first; those already on a roster after them.
  const ordered = [
    ...available,
    ...(candidates.data ?? []).filter((candidate) => blockedReason(candidate, groupId) !== null),
  ]
  const allShownSelected = available.length > 0 && available.every((c) => selected.has(c.id))

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    onChange([...next])
  }

  return (
    <div role="group" aria-labelledby={labelId} className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p id={labelId} className="flex items-center gap-1 text-sm text-label">
          Employees
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </p>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {selected.size === 0 ? 'None selected' : `${selected.size} selected`}
        </p>
      </div>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
        />
        <Input
          type="search"
          aria-label="Search employees"
          placeholder="Search name, department or designation"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
          className="pl-9 placeholder:text-field-value sm:pl-9"
        />
      </div>

      <div
        aria-describedby={fieldState.error ? errorId : undefined}
        className={cn(
          'max-h-72 overflow-y-auto rounded-md border',
          fieldState.error && 'border-destructive',
        )}
      >
        {candidates.isPending ? (
          <div aria-busy="true" className="grid gap-2 p-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y">
            {available.length > 1 && (
              <li className="flex items-center gap-3 bg-muted/50 px-3 py-2.5">
                <Checkbox
                  id={`${labelId}-all`}
                  checked={allShownSelected}
                  onCheckedChange={(checked) => {
                    const next = new Set(selected)
                    available.forEach((candidate) => {
                      if (checked === true) next.add(candidate.id)
                      else next.delete(candidate.id)
                    })
                    onChange([...next])
                  }}
                />
                <label htmlFor={`${labelId}-all`} className="cursor-pointer text-sm text-heading">
                  Select all {available.length} available
                </label>
              </li>
            )}
            {ordered.map((candidate) => {
              const reason = blockedReason(candidate, groupId)
              const id = `${labelId}-${candidate.id}`
              return (
                <li
                  key={candidate.id}
                  className={cn('flex items-center gap-3 px-3 py-2.5', reason && 'opacity-60')}
                >
                  <Checkbox
                    id={id}
                    checked={selected.has(candidate.id)}
                    disabled={reason !== null}
                    onCheckedChange={(checked) => {
                      toggle(candidate.id, checked === true)
                    }}
                  />
                  <label
                    htmlFor={id}
                    className={cn('min-w-0 flex-1', reason === null && 'cursor-pointer')}
                  >
                    <span className="block truncate text-sm text-heading">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {candidate.designation} · {candidate.department}
                    </span>
                  </label>
                  {reason && (
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {reason}
                    </Badge>
                  )}
                </li>
              )
            })}
            {candidates.data?.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No employees match that search.
              </li>
            )}
          </ul>
        )}
      </div>
      {fieldState.error && (
        <p id={errorId} role="alert" className="-mt-1 text-xs text-destructive">
          {fieldState.error.message}
        </p>
      )}
    </div>
  )
}
