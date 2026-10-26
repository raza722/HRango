import { useId, useState } from 'react'
import { type Control, useController } from 'react-hook-form'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
}

/** "Designation · Department · Code", leaving out what the record lacks. */
function describe(candidate: EnrollmentCandidate): string {
  return [candidate.designationName, candidate.departmentName, candidate.code]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Searchable checklist of employees for "Enroll New Employee" (`GET /employees/lookup`,
 * the people the user may enrol). Typing searches the server (`q`); the list shows a page
 * at a time and "Load more" reads the next, so any number of people can be reached. One
 * roster per person at a time is checked by the API on save; the lookup does not say who
 * is on a roster already.
 */
export function EmployeePicker({ control }: EmployeePickerProps) {
  const labelId = useId()
  const errorId = useId()
  const [text, setText] = useState('')
  const search = useDebouncedValue(text.trim(), 250)
  const candidates = useEnrollmentCandidates(search)
  const {
    field: { value, onChange },
    fieldState,
  } = useController({ control, name: 'employeeIds' })
  const selected = new Set(value)

  const available = candidates.rows
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
          placeholder="Search name or code"
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
                  Select all {available.length} {candidates.hasMore ? 'shown' : 'available'}
                </label>
              </li>
            )}
            {available.map((candidate) => {
              const id = `${labelId}-${candidate.id}`
              return (
                <li key={candidate.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    id={id}
                    checked={selected.has(candidate.id)}
                    onCheckedChange={(checked) => {
                      toggle(candidate.id, checked === true)
                    }}
                  />
                  <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block truncate text-sm text-heading">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {describe(candidate)}
                    </span>
                  </label>
                </li>
              )
            })}
            {available.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {candidates.isError
                  ? 'Employees could not be loaded.'
                  : 'No employees match that search.'}
              </li>
            )}
            {candidates.hasMore && (
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Showing {available.length} of {candidates.total}
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  disabled={candidates.isFetchingMore}
                  onClick={candidates.loadMore}
                  className="h-auto p-0"
                >
                  {candidates.isFetchingMore ? 'Loading…' : 'Load more'}
                </Button>
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
