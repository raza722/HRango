import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import {
  DatePickerField,
  FieldLayoutContext,
  SelectField,
  TextareaField,
  TextField,
  TimePickerField,
} from '@/components/form'
import { EmployeeMultiSearchSelectField } from '@/features/payroll'
import { useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'
import { ApiError } from '@/lib/api-error'

import { overtimeApi } from '../../api/overtime.api'
import { useOrgLookup } from '../../hooks/use-attendance-settings'
import { useOvertimeBatch } from '../../hooks/use-overtime'
import {
  BULK_OVERTIME_DEFAULTS,
  bulkOvertimeSchema,
  type BulkOvertimeValues,
  toOvertimeBody,
} from '../../schemas/overtime.schema'
import { apiField } from '../../utils/overtime-format'
import { OvertimeDialog } from './overtime-parts'

/** The server's field names → this form's (a refusal everyone got lands on the field). */
const FIELD_OF: Record<string, keyof BulkOvertimeValues> = {
  departmentId: 'departmentId',
  locationId: 'locationId',
  branchId: 'branchId',
  overtimeDate: 'date',
  fromDate: 'date',
  startTime: 'startTime',
  endTime: 'endTime',
  appliedMinutes: 'overtimeHours',
  reason: 'reason',
}

/** Whom the picker offers: the people the caller may file overtime for. */
const PICKER_FILTERS = { permission: 'requests.overtime.create' }

interface Refusal {
  employeeId: string
  name: string
  message: string
}

/**
 * "Create Bulk Overtime Request" (frame 2823:12585): Select Employees *, Department *,
 * Location, Branch, Date *, Start Time *, End Time *, Overtime Hours *, Reason for
 * Overtime *, with Create and Cancel at the bottom left. The API has no bulk request: Create
 * files one `POST /requests/overtime` per person, on their behalf, and lists whom it refused
 * (and why); those stay chosen to fix and try again. `onCreated` runs once all went through.
 */
export function BulkRequestDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated?: () => void
}) {
  const formId = useId()
  const batch = useOvertimeBatch()
  const departments = useOrgLookup('departments')
  const locations = useOrgLookup('locations')
  const branches = useOrgLookup('branches')
  // Names of the people picked, from any page the picker read.
  const people = useEmployeeLookupSearch(PICKER_FILTERS, { enabled: false })
  const [busy, setBusy] = useState(false)
  const [refusals, setRefusals] = useState<Refusal[]>([])
  const form = useForm<BulkOvertimeValues>({
    resolver: zodResolver(bulkOvertimeSchema),
    defaultValues: BULK_OVERTIME_DEFAULTS,
  })
  const options = (rows: { id: string; name: string }[] | undefined) =>
    (rows ?? []).map((row) => ({ value: row.id, label: row.name }))

  const submit = form.handleSubmit(async (values) => {
    setBusy(true)
    setRefusals([])
    const refused: Refusal[] = []
    let created = 0
    const fieldHits = new Map<keyof BulkOvertimeValues, string>()
    await batch(async () => {
      for (const employeeId of values.employeeIds) {
        try {
          await overtimeApi.create(toOvertimeBody(values, [], employeeId))
          created += 1
        } catch (failure) {
          const fields =
            failure instanceof ApiError
              ? Object.entries(failure.fieldErrors).map(([key, message]) => [
                  apiField(key),
                  message,
                ])
              : []
          for (const [key, message] of fields) {
            const target = key ? FIELD_OF[key] : undefined
            if (target && message) fieldHits.set(target, message)
          }
          refused.push({
            employeeId,
            name: people.find(employeeId)?.name ?? `Employee ${employeeId}`,
            message:
              fields.find(([key]) => key === 'overtimeDate' || key === 'employeeId')?.[1] ??
              (failure instanceof Error ? failure.message : 'Not filed.'),
          })
        }
      }
    })
    setBusy(false)
    if (created > 0) {
      toast.success(
        `Filed ${String(created)} overtime request${created === 1 ? '' : 's'}${refused.length ? `; ${String(refused.length)} refused` : ''}`,
      )
    }
    if (refused.length === 0) {
      onCreated?.()
      onClose()
      return
    }
    // Everyone refused for the same field: show it there too.
    if (created === 0) {
      for (const [target, message] of fieldHits) form.setError(target, { message })
    }
    form.setValue(
      'employeeIds',
      refused.map((item) => item.employeeId),
    )
    setRefusals(refused)
  })

  return (
    <OvertimeDialog
      title="Create Bulk Overtime Request"
      onClose={onClose}
      formId={formId}
      submitLabel="Create"
      pending={busy}
      error={form.formState.errors.root?.message}
      className="max-w-[27.75rem]"
    >
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
        >
          {refusals.length > 0 && (
            <div role="alert" className="grid gap-1 rounded-md bg-destructive/10 px-3 py-2">
              <p className="text-sm font-medium text-destructive">
                Not filed for{' '}
                {refusals.length === 1 ? 'one person' : `${String(refusals.length)} people`}:
              </p>
              <ul className="grid gap-0.5 text-xs text-destructive">
                {refusals.map((item) => (
                  <li key={item.employeeId}>
                    {item.name}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <EmployeeMultiSearchSelectField
            control={form.control}
            name="employeeIds"
            label="Select Employees"
            placeholder="Select Employee"
            required
            // Active people the screen's code reaches, searched on the server and paged.
            filters={PICKER_FILTERS}
            include={(person) => person.status === 'active'}
            hint={(person) => [person.code, person.departmentName].filter(Boolean).join(' · ')}
          />
          <SelectField
            control={form.control}
            name="departmentId"
            label="Department"
            placeholder="Select"
            options={options(departments.data)}
            required
          />
          <SelectField
            control={form.control}
            name="locationId"
            label="Location"
            placeholder="Select Location"
            options={options(locations.data)}
            clearable="No location"
          />
          <SelectField
            control={form.control}
            name="branchId"
            label="Branch"
            placeholder="Select Branch"
            options={options(branches.data)}
            clearable="No branch"
          />
          <DatePickerField
            control={form.control}
            name="date"
            label="Date"
            placeholder="Select Date"
            required
          />
          <TimePickerField control={form.control} name="startTime" label="Start Time" required />
          <TimePickerField control={form.control} name="endTime" label="End Time" required />
          <TextField
            control={form.control}
            name="overtimeHours"
            label="Overtime Hours"
            placeholder="Enter hours, e.g. 1.5"
            inputMode="decimal"
            required
          />
          <TextareaField
            control={form.control}
            name="reason"
            label="Reason for Overtime"
            placeholder="Write here"
            required
            textareaClassName="min-h-[9.0625rem]"
          />
        </form>
      </FieldLayoutContext>
    </OvertimeDialog>
  )
}
