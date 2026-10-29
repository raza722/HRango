import { useId, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Search, Trash2, UserPlus } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { DataTable, type DataTableColumn, EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmployeeMultiSearchSelect } from '@/features/payroll'
import { type EmployeeLookupRow, useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { DEVICE_CODES, useDeviceEnrolments, useSaveEnrolments } from '../../hooks/use-devices'
import {
  type EnrolmentRow,
  enrolmentsFormSchema,
  type EnrolmentsFormValues,
  nextUserNo,
  toEnrolmentInputs,
} from '../../schemas/device.schema'
import type { BiometricDevice, DeviceEnrolment } from '../../types/devices.types'
import { plural } from '../../utils/device-format'
import {
  compactTableClass,
  navyButtonClass,
  personCodeClass,
  personNameClass,
  settingsDialogButtonClass,
} from '../../utils/settings-styles'
import { useLeaveGuard } from './use-leave-guard'

/** Whom the picker offers: the people this screen's enrol permission reaches. */
const PICKER_FILTERS = { permission: DEVICE_CODES.enrol }

const toRow = (row: DeviceEnrolment): EnrolmentRow => ({
  employeeId: row.employeeId,
  employeeCode: row.employeeCode,
  employeeName: row.employeeName,
  deviceUserNo: row.deviceUserNo,
  createdAt: row.createdAt,
})

/** Who is on the device: loads them, then the editor (or the list, without the permission). */
export function EnrolmentsTab({ device, canEdit }: { device: BiometricDevice; canEdit: boolean }) {
  const enrolments = useDeviceEnrolments(device.id)
  if (enrolments.isPending) {
    return (
      <div aria-busy="true" className="grid gap-3">
        <span className="sr-only">Loading the enrolments…</span>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }
  if (enrolments.isError) {
    return (
      <ErrorState
        title="Could not load the enrolments"
        message={enrolments.error.message}
        onRetry={() => void enrolments.refetch()}
        className="shadow-none"
      />
    )
  }
  return (
    <EnrolmentsEditor
      // A fresh read (after a save, or Reload) starts the form again from the server.
      key={enrolments.dataUpdatedAt}
      device={device}
      initial={enrolments.data}
      canEdit={canEdit}
      onReload={() => void enrolments.refetch()}
    />
  )
}

/**
 * Everyone on the device with the user number the device knows them by. People are added
 * (from the employee lookup) and removed here, numbers edited, then all of it is saved at once
 * (`PUT …/enrolments` with the device's rowVersion). Numbers are digits and unique on the
 * device; leaving with unsaved changes asks first.
 */
function EnrolmentsEditor({
  device,
  initial,
  canEdit,
  onReload,
}: {
  device: BiometricDevice
  initial: DeviceEnrolment[]
  canEdit: boolean
  onReload: () => void
}) {
  const baseId = useId()
  const save = useSaveEnrolments()
  const lookup = useEmployeeLookupSearch(PICKER_FILTERS, { enabled: canEdit })
  const form = useForm<EnrolmentsFormValues>({
    resolver: zodResolver(enrolmentsFormSchema),
    defaultValues: { rows: initial.map(toRow) },
  })
  const fields = useFieldArray({ control: form.control, name: 'rows', keyName: 'key' })
  const rows = useWatch({ control: form.control, name: 'rows' })
  const { errors, isDirty } = form.formState
  const guard = useLeaveGuard(isDirty)
  const [staged, setStaged] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [conflict, setConflict] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const enrolledIds = new Set(rows.map((row) => row.employeeId))
  const before = new Map(initial.map((row) => [row.employeeId, row.deviceUserNo]))
  const added = rows.filter((row) => !before.has(row.employeeId)).length
  const removed = initial.filter((row) => !enrolledIds.has(row.employeeId)).length
  const changed = rows.filter(
    (row) => before.has(row.employeeId) && before.get(row.employeeId) !== row.deviceUserNo.trim(),
  ).length
  const changes = [
    added > 0 ? `${String(added)} added` : null,
    removed > 0 ? `${String(removed)} removed` : null,
    changed > 0 ? `${String(changed)} renumbered` : null,
  ].filter(Boolean)

  const rowErrors = Array.isArray(errors.rows) ? errors.rows.filter(Boolean).length : 0
  const text = filter.trim().toLowerCase()
  const visible = fields.fields
    .map((field, index) => ({ field, index }))
    .filter(({ index }) => {
      const row = rows[index]
      return (
        !text ||
        (row !== undefined &&
          `${row.employeeName} ${row.employeeCode} ${row.deviceUserNo}`
            .toLowerCase()
            .includes(text))
      )
    })

  const addStaged = () => {
    let number = Number(nextUserNo(form.getValues('rows')))
    const people = staged.map((id): EnrolmentRow => {
      const person: EmployeeLookupRow | undefined = lookup.find(id)
      const row = {
        employeeId: id,
        employeeCode: person?.code ?? '',
        employeeName: person?.name ?? `Employee ${id}`,
        deviceUserNo: String(number),
        createdAt: null,
      }
      number += 1
      return row
    })
    fields.prepend(people, { shouldFocus: false })
    setStaged([])
    setFilter('')
    setAnnouncement(
      `${plural(people.length, 'person', 'people')} added at the top with the next free numbers. Save to enrol them.`,
    )
  }

  const submit = form.handleSubmit(async (values) => {
    setConflict(null)
    form.clearErrors('root')
    try {
      await save.mutateAsync({ device, rows: toEnrolmentInputs(values.rows) })
      form.reset(values)
    } catch (error) {
      if (!(error instanceof ApiError)) {
        form.setError('root', { message: 'Could not save the enrolments. Try again.' })
        return
      }
      if (error.status === 409) {
        setConflict(error.message)
        return
      }
      let placed = 0
      for (const [key, message] of Object.entries(error.fieldErrors)) {
        const match = /^enrolments\.(\d+)\.(deviceUserNo|employeeId)$/.exec(key)
        const field = match?.[2] === 'employeeId' ? 'employeeId' : 'deviceUserNo'
        if (match) {
          form.setError(`rows.${Number(match[1])}.${field}`, { message })
          placed += 1
        }
      }
      if (placed === 0) form.setError('root', { message: error.message })
    }
  })

  const columns: DataTableColumn<{ field: (typeof fields.fields)[number]; index: number }>[] = [
    {
      id: 'employee',
      header: 'Employee',
      mobile: 'heading',
      cell: ({ index }) => {
        const row = rows[index]
        const problem = errors.rows?.[index]?.employeeId?.message
        return (
          <span className="flex items-center gap-2.5">
            <EmployeeAvatar name={row?.employeeName ?? ''} className="size-7" />
            <span className="min-w-0">
              <span className={personNameClass}>{row?.employeeName}</span>
              <span className={personCodeClass}>{row?.employeeCode}</span>
              {problem && <span className="block text-xs text-destructive">{problem}</span>}
            </span>
          </span>
        )
      },
    },
    {
      id: 'number',
      header: 'Device User No',
      cell: ({ index }) => {
        const row = rows[index]
        if (!canEdit) return <span className="tabular-nums">{row?.deviceUserNo}</span>
        const problem = errors.rows?.[index]?.deviceUserNo?.message
        const errorId = `${baseId}-number-${String(index)}`
        return (
          <span className="grid gap-1">
            <Input
              {...form.register(`rows.${index}.deviceUserNo`)}
              aria-label={`Device user no of ${row?.employeeName ?? 'this person'}`}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? errorId : undefined}
              inputMode="numeric"
              autoComplete="off"
              maxLength={30}
              className="h-8 w-28 text-xs tabular-nums sm:text-xs"
            />
            {problem && (
              <span id={errorId} className="max-w-56 text-xs whitespace-normal text-destructive">
                {problem}
              </span>
            )}
          </span>
        )
      },
    },
    {
      id: 'since',
      header: 'Enrolled',
      cell: ({ index }) => {
        const createdAt = rows[index]?.createdAt
        return createdAt ? (
          format(new Date(createdAt), 'd MMM yyyy')
        ) : (
          <span className="rounded-sm bg-[#E6EEFF] px-1.5 py-0.5 text-[0.625rem] font-medium text-[#2F6FED] dark:bg-primary/20 dark:text-primary-foreground">
            New, not saved
          </span>
        )
      },
    },
  ]

  return (
    <>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid min-w-0 gap-4">
        {canEdit && (
          <div className="@container grid gap-3 rounded-md bg-muted/50 p-3">
            <div className="grid grid-cols-1 items-end gap-3 @xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid min-w-0 gap-1.5">
                <label htmlFor={`${baseId}-add`} className="text-sm font-medium text-heading">
                  Add people
                </label>
                <EmployeeMultiSearchSelect
                  id={`${baseId}-add`}
                  value={staged}
                  onChange={setStaged}
                  filters={PICKER_FILTERS}
                  include={(person) => person.status === 'active' && !enrolledIds.has(person.id)}
                  hint={(person) =>
                    person.branchName ? `${person.code} · ${person.branchName}` : person.code
                  }
                  placeholder="Select employees"
                  className="bg-card"
                />
              </div>
              <Button
                type="button"
                disabled={staged.length === 0}
                onClick={addStaged}
                className={cn(settingsDialogButtonClass, 'h-10', navyButtonClass)}
              >
                <UserPlus aria-hidden="true" />
                {staged.length === 0 ? 'Add' : `Add ${plural(staged.length, 'person', 'people')}`}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-title" aria-live="polite">
            {plural(rows.length, 'person', 'people')} on {device.name}
            {changes.length > 0 && (
              <span className="text-muted-foreground"> · unsaved: {changes.join(', ')}</span>
            )}
          </p>
          {fields.fields.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
              />
              <Input
                type="search"
                aria-label="Search enrolled people"
                placeholder="Name, code or user no"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value)
                }}
                className="h-9 pl-9 sm:pl-9"
              />
            </div>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        {conflict && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span>{conflict} Reloading drops the changes made here.</span>
            <Button type="button" variant="outline" size="sm" onClick={onReload}>
              Reload
            </Button>
          </div>
        )}
        {(rowErrors > 0 || errors.root) && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errors.root?.message ??
              `${plural(rowErrors, 'row needs', 'rows need')} attention before saving.`}
            {rowErrors > 0 && text && ' Clear the search to see every row.'}
          </p>
        )}

        <DataTable
          columns={columns}
          data={visible}
          getRowId={({ field }) => field.key}
          caption={`People enrolled on ${device.name}`}
          isFetching={save.isPending}
          className={compactTableClass}
          emptyState={
            <p className="py-8 text-center text-sm text-muted-foreground">
              {fields.fields.length > 0
                ? 'Nobody here matches the search.'
                : canEdit
                  ? 'No one is enrolled on this device yet. Add people above, then Save.'
                  : 'No one is enrolled on this device yet.'}
            </p>
          }
          {...(canEdit
            ? {
                rowActions: ({ index }: { index: number }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${rows[index]?.employeeName ?? 'this person'}`}
                    onClick={() => {
                      fields.remove(index)
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                ),
              }
            : {})}
        />

        {canEdit && (
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={!isDirty || save.isPending}
              onClick={() => {
                setConflict(null)
                form.reset()
              }}
              className={settingsDialogButtonClass}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={!isDirty || save.isPending}
              className={cn(
                settingsDialogButtonClass,
                'bg-[#4CBB6C] text-white hover:bg-[#4CBB6C]/90',
              )}
            >
              {save.isPending ? 'Saving…' : 'Save Enrolments'}
            </Button>
          </div>
        )}
      </form>
      <UnsavedChangesDialog guard={guard} />
    </>
  )
}
