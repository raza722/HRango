import { useState } from 'react'

import { FormField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SearchSelect } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { EMPLOYEE_STATUS_META } from '../../constants'
import { useOrgLookups } from '../../hooks/use-employees'
import type { EmployeeListSearch } from '../../routing'
import { EMPLOYEE_STATUSES } from '../../types/employees.types'
import {
  cancelButtonClass,
  dialogClass,
  dialogFieldsClass,
  dialogTitleClass,
  saveButtonClass,
} from '../../utils/styles'

/** The filter panel's part of the URL. */
export type EmployeeFilters = Pick<
  EmployeeListSearch,
  'status' | 'branchId' | 'departmentId' | 'designationId' | 'includeInactive'
>

/** The Status choice for everyone, those who left and inactive records too (`includeInactive`). */
const ALL_STATUSES = 'all'

/**
 * Filter (the frame's filter_alt icon; no panel is drawn): Status, Branch, Department and
 * Designation (`GET /organisation/lookups/{kind}`). Status left empty means current employees
 * (the API leaves out Left and Inactive); "All statuses" asks for everyone. Apply puts them in the
 * URL; Reset clears them.
 */
export function EmployeeFiltersDialog({
  value,
  onApply,
  onClose,
}: {
  value: EmployeeFilters
  onApply: (filters: EmployeeFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<EmployeeFilters>(value)
  const { lists } = useOrgLookups(['branches', 'departments', 'designations'] as const)
  const options = (rows: readonly { id: string; name: string }[]) =>
    rows.map((row) => ({ value: row.id, label: row.name }))

  const select = (
    label: string,
    placeholder: string,
    key: 'branchId' | 'departmentId' | 'designationId',
    rows: readonly { id: string; name: string }[],
  ) => (
    <FormField label={label}>
      {(a11y) => (
        <SearchSelect
          {...a11y}
          value={draft[key] ?? null}
          onChange={(next) => {
            setDraft((current) => ({ ...current, [key]: next ?? undefined }))
          }}
          options={options(rows)}
          placeholder={placeholder}
          clearable
        />
      )}
    </FormField>
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showClose={false} className={cn(dialogClass, dialogFieldsClass)}>
        <DialogTitle className={dialogTitleClass}>Filters</DialogTitle>
        <DialogDescription className="sr-only">
          Choose which employees the list shows.
        </DialogDescription>
        <div className="grid min-h-0 gap-4 overflow-y-auto pt-6 sm:grid-cols-2">
          <FormField label="Status">
            {(a11y) => (
              <SearchSelect
                {...a11y}
                value={draft.status ?? (draft.includeInactive ? ALL_STATUSES : null)}
                onChange={(next) => {
                  setDraft((current) => ({
                    ...current,
                    status: EMPLOYEE_STATUSES.find((status) => status === next),
                    includeInactive: next === ALL_STATUSES ? true : undefined,
                  }))
                }}
                options={[
                  { value: ALL_STATUSES, label: 'All statuses' },
                  ...EMPLOYEE_STATUSES.map((status) => ({
                    value: status,
                    label: EMPLOYEE_STATUS_META[status].label,
                  })),
                ]}
                placeholder="Current employees"
                clearable
              />
            )}
          </FormField>
          {select('Branch', 'All Branches', 'branchId', lists.branches)}
          {select('Department', 'All Departments', 'departmentId', lists.departments)}
          {select('Designation', 'All Designations', 'designationId', lists.designations)}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Current employees are those Active, On Probation or On Notice. All statuses adds the
            people who left and inactive records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-6">
          <Button type="button" onClick={onClose} className={cancelButtonClass}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
            className={saveButtonClass}
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const cleared: EmployeeFilters = {
                status: undefined,
                branchId: undefined,
                departmentId: undefined,
                designationId: undefined,
                includeInactive: undefined,
              }
              setDraft(cleared)
              onApply(cleared)
              onClose()
            }}
            className="h-12 rounded-lg px-7 text-[0.9375rem] font-medium"
          >
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
