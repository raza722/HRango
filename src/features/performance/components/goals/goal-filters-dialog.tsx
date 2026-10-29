import { useId, useState } from 'react'

import { FormField } from '@/components/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { DateInput, EmployeeSearchSelect, SearchSelect } from '@/features/payroll'

import { GOAL_STATUS_META, PERF_CODES } from '../../constants'
import { useCycleOptions } from '../../hooks/use-performance'
import type { GoalsSearch } from '../../routing'
import { GOAL_STATUSES } from '../../types/performance.types'
import { FiltersDialog } from '../shared/dialogs'

/** The filter popup's part of the Goals URL. */
export type GoalFilters = Pick<
  GoalsSearch,
  'status' | 'cycleId' | 'overdue' | 'dueFrom' | 'dueTo' | 'employeeId'
>

const NO_GOAL_FILTERS: GoalFilters = {
  status: undefined,
  cycleId: undefined,
  overdue: undefined,
  dueFrom: undefined,
  dueTo: undefined,
  employeeId: undefined,
}

/** Status, Review Cycle, Employee (Team and All), due dates and Overdue only. */
export function GoalFiltersDialog({
  value,
  showEmployee,
  onApply,
  onClose,
}: {
  value: GoalFilters
  showEmployee: boolean
  onApply: (filters: GoalFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<GoalFilters>(value)
  const overdueId = useId()
  const cycles = useCycleOptions()
  const set = (patch: Partial<GoalFilters>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }
  return (
    <FiltersDialog
      onApply={() => {
        onApply(draft)
      }}
      onReset={() => {
        onApply(NO_GOAL_FILTERS)
      }}
      onClose={onClose}
    >
      <FormField label="Status">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.status ?? null}
            onChange={(next) => {
              set({ status: GOAL_STATUSES.find((status) => status === next) })
            }}
            options={GOAL_STATUSES.map((status) => ({
              value: status,
              label: GOAL_STATUS_META[status].label,
            }))}
            placeholder="All Statuses"
            clearable
          />
        )}
      </FormField>
      <FormField label="Review Cycle">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.cycleId ?? null}
            onChange={(next) => {
              set({ cycleId: next ?? undefined })
            }}
            options={(cycles.data?.data ?? []).map((cycle) => ({
              value: cycle.id,
              label: cycle.name,
            }))}
            placeholder="All Cycles"
            clearable
          />
        )}
      </FormField>
      {showEmployee && (
        <FormField label="Employee" className="sm:col-span-2">
          {(a11y) => (
            <EmployeeSearchSelect
              {...a11y}
              value={draft.employeeId ?? null}
              onChange={(next) => {
                set({ employeeId: next ?? undefined })
              }}
              filters={{ permission: PERF_CODES.goalsView, includeInactive: true }}
              placeholder="All Employees"
              clearable
            />
          )}
        </FormField>
      )}
      <FormField label="Due From">
        {(a11y) => (
          <DateInput
            {...a11y}
            value={draft.dueFrom ?? ''}
            onChange={(next) => {
              set({ dueFrom: next || undefined })
            }}
            placeholder="Any date"
          />
        )}
      </FormField>
      <FormField label="Due To">
        {(a11y) => (
          <DateInput
            {...a11y}
            value={draft.dueTo ?? ''}
            onChange={(next) => {
              set({ dueTo: next || undefined })
            }}
            placeholder="Any date"
          />
        )}
      </FormField>
      <div className="flex items-center gap-2.5 sm:col-span-2">
        <Checkbox
          id={overdueId}
          tone="navy"
          checked={draft.overdue === true}
          onCheckedChange={(checked) => {
            set({ overdue: checked === true ? true : undefined })
          }}
        />
        <Label htmlFor={overdueId}>Overdue goals only</Label>
      </div>
    </FiltersDialog>
  )
}
