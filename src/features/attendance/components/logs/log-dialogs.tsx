import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { differenceInCalendarDays } from 'date-fns'
import { z } from 'zod'

import uploadFolder from '@/assets/attendance/upload-folder.svg'
import { AppDialog } from '@/components/feedback/app-dialog'
import {
  DatePickerField,
  FieldLayoutContext,
  SelectField,
  TextareaField,
  TimePickerField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { EmployeeSearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { logsApi } from '../../api/logs.api'
import { PUNCH_SOURCE_LABELS, PUNCH_TYPE_LABELS } from '../../constants'
import { useImportFile, useSaveLog } from '../../hooks/use-attendance-logs'
import { useBreakTypes } from '../../hooks/use-attendance-settings'
import { PUNCH_TYPES } from '../../types/attendance.types'
import type { AttendanceLogRow, FileImportRow } from '../../types/logs.types'
import { punchDescription } from '../../utils/day'
import { formatPunchTime, splitLocal, toLocal } from '../../utils/local-time'
import { downloadText, LOGS_TEMPLATE, parseLogsCsv } from '../../utils/logs-csv'
import {
  logDialogButtonClass,
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
} from '../../utils/settings-styles'
import { ReadOnlyField } from '../shared/attendance-dialog'
import { DateBox } from '../shared/date-box'

const TYPE_OPTIONS = PUNCH_TYPES.map((type) => ({ value: type, label: PUNCH_TYPE_LABELS[type] }))
const greenButtonClass = 'bg-[#4CBB6C] text-white hover:bg-[#4CBB6C]/90'

const logSchema = z.object({
  employeeId: z.string().min(1, 'Choose the employee'),
  type: z.string().min(1, 'Choose the punch type'),
  time: z.string().min(1, 'Enter the punch time'),
  date: z.string().min(1, 'Choose the punch date'),
  breakTypeId: z.string(),
  description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
})
type LogValues = z.infer<typeof logSchema>

/** API field → form field, for 422 answers. */
const FIELD_OF: Record<string, keyof LogValues> = {
  employeeId: 'employeeId',
  punchedAt: 'date',
  punchType: 'type',
  breakTypeId: 'breakTypeId',
  remarks: 'description',
}

/**
 * "Create Attendance Log" (and Edit): Employee Name, Punch Type, Punch Time, Punch Date, the
 * Break Type of a break punch, and Description. Nobody enters their own punches (the API
 * refuses: they raise a punch request).
 */
export function LogFormDialog({
  log,
  onClose,
}: {
  log: AttendanceLogRow | null
  onClose: () => void
}) {
  const save = useSaveLog()
  const breakTypes = useBreakTypes()
  const at = log ? splitLocal(log.punchedAt) : null
  const form = useForm<LogValues>({
    resolver: zodResolver(logSchema),
    defaultValues: {
      employeeId: log?.employeeId ?? '',
      type: log?.punchType ?? '',
      time: at?.time ?? '',
      date: at?.date ?? '',
      breakTypeId: log?.breakTypeId ?? '',
      description: log?.remarks ?? '',
    },
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const isBreak = type === 'break_out' || type === 'break_in'

  const submit = form.handleSubmit(async (values) => {
    const punchType = PUNCH_TYPES.find((item) => item === values.type)
    if (!punchType) return
    const remarks = values.description.trim()
    try {
      await save.mutateAsync({
        id: log?.id,
        input: {
          employeeId: values.employeeId,
          punchedAt: toLocal(values.date, values.time),
          punchType,
          breakTypeId: isBreak && values.breakTypeId ? values.breakTypeId : null,
          remarks: remarks === '' ? null : remarks,
          rowVersion: log?.rowVersion ?? null,
        },
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = Object.entries(error.fieldErrors).filter(([field]) => FIELD_OF[field])
        for (const [field, message] of fields) {
          const name = FIELD_OF[field]
          if (name) form.setError(name, { message })
        }
        if (fields.length === 0) form.setError('root', { message: error.message })
      }
      return
    }
    onClose()
  })

  return (
    <AppDialog
      title={log ? 'Edit Attendance Log' : 'Create Attendance Log'}
      onRequestClose={onClose}
      className={cn('max-w-2xl', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          {form.formState.errors.root && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={logDialogButtonClass}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="attendance-log-form"
            size="lg"
            disabled={save.isPending}
            className={cn(logDialogButtonClass, navyButtonClass)}
          >
            {log ? 'Save Changes' : 'Create'}
          </Button>
        </>
      }
    >
      <FieldLayoutContext value="vertical">
        <form
          id="attendance-log-form"
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4 @lg:grid-cols-2"
        >
          <EmployeeSearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee Name"
            placeholder="Select"
            // Active people the form's code reaches, searched on the server and paged.
            filters={{ permission: log ? 'attendance.logs.edit' : 'attendance.logs.create' }}
            include={(employee) => employee.status === 'active'}
            known={
              log
                ? [{ value: log.employeeId, label: log.employeeName, hint: log.employeeCode }]
                : undefined
            }
            required
          />
          <SelectField
            control={form.control}
            name="type"
            label="Punch Type"
            placeholder="Select"
            options={TYPE_OPTIONS}
            required
          />
          <TimePickerField control={form.control} name="time" label="Punch Time" required />
          <DatePickerField
            control={form.control}
            name="date"
            label="Punch Date"
            maxDate={new Date()}
            required
          />
          {isBreak && (
            <SelectField
              control={form.control}
              name="breakTypeId"
              label="Break Type"
              placeholder="Select"
              options={breakTypes.list.map((item) => ({ value: item.id, label: item.name }))}
            />
          )}
          <TextareaField
            control={form.control}
            name="description"
            label="Description"
            className="@lg:col-span-2"
            textareaClassName="min-h-20"
          />
        </form>
      </FieldLayoutContext>
    </AppDialog>
  )
}

/** One punch, read-only (with the clock-in photo and location when it has them). */
export function LogViewDialog({ log, onClose }: { log: AttendanceLogRow; onClose: () => void }) {
  return (
    <AppDialog
      title="Attendance Log"
      onRequestClose={onClose}
      className={cn('max-w-2xl', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <Button
          variant="outline"
          size="lg"
          onClick={onClose}
          className={cn(logDialogButtonClass, 'text-sidebar dark:text-heading')}
        >
          Close
        </Button>
      }
    >
      <div className="grid gap-4 @lg:grid-cols-2">
        <ReadOnlyField label="Employee" value={`${log.employeeName} (${log.employeeCode})`} />
        <ReadOnlyField
          label="Punch Type"
          value={`${PUNCH_TYPE_LABELS[log.punchType]}${log.isIgnored ? ' (ignored)' : ''}`}
        />
        <ReadOnlyField label="Punch Time" value={formatPunchTime(log.punchedAt)} />
        <ReadOnlyField label="Source" value={PUNCH_SOURCE_LABELS[log.source]} />
        <ReadOnlyField
          label="Machine"
          value={log.deviceId ? `${log.deviceName ?? 'Machine'} (${log.deviceCode ?? ''})` : '—'}
        />
        <ReadOnlyField label="Manually Updated" value={log.isManuallyUpdated ? 'Yes' : 'No'} />
        {log.breakTypeName && <ReadOnlyField label="Break Type" value={log.breakTypeName} />}
        {log.ipAddress && <ReadOnlyField label="IP Address" value={log.ipAddress} />}
        {log.latitude !== null && log.longitude !== null && (
          <ReadOnlyField label="Location" value={`${log.latitude}, ${log.longitude}`} />
        )}
        <ReadOnlyField
          label="Description"
          value={punchDescription(log)}
          className="@lg:col-span-2"
        />
        {log.photo && (
          <figure className="grid gap-2 @lg:col-span-2">
            <figcaption className="text-sm text-title">Picture</figcaption>
            <img
              src={log.photo.url}
              alt={`Picture taken at ${formatPunchTime(log.punchedAt)}`}
              className="max-h-64 w-fit rounded-md border object-contain"
            />
          </figure>
        )}
      </div>
    </AppDialog>
  )
}

/**
 * "Import Attendance Log" from a file (Employee Code, Date, Time, Punch Type). The file is read
 * here to point out bad lines early; the API checks every line again and reports the ones it
 * refused. Importing straight from a biometric machine is not possible yet: a device connector
 * posts its punches to the API.
 */
export function ImportLogDialog({ onClose }: { onClose: () => void }) {
  const inputId = useId()
  const [file, setFile] = useState<{
    name: string
    rows: FileImportRow[]
    errors: string[]
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const importFile = useImportFile()

  const read = async (picked: File | undefined) => {
    if (!picked) return
    setError(null)
    const text = await picked.text()
    setFile({ name: picked.name, ...parseLogsCsv(text) })
  }

  const submit = async () => {
    setError(null)
    if (!file || file.rows.length === 0) {
      setError('Choose a file with at least one good line.')
      return
    }
    try {
      const outcome = await importFile.mutateAsync(file.rows)
      if (outcome.errors.length > 0) {
        setFile({
          ...file,
          rows: [],
          errors: outcome.errors.map((item) => `Line ${item.line}: ${item.message}`),
        })
        return
      }
      onClose()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not import.')
    }
  }

  return (
    <AppDialog
      title="Import Attendance Log"
      onRequestClose={onClose}
      className={cn('max-w-xl', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={cn(logDialogButtonClass, 'flex-1')}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            disabled={importFile.isPending}
            onClick={() => void submit()}
            className={cn(logDialogButtonClass, greenButtonClass, 'flex-1')}
          >
            Import
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <span className="text-sm text-title">Upload Attachment</span>
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => {
            setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void read(event.dataTransfer.files[0])
          }}
          className={cn(
            'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border px-4 py-6 text-center text-sm text-[#A4A4A4] transition-colors dark:text-label',
            dragging && 'border-primary bg-primary/5',
          )}
        >
          <img src={uploadFolder} alt="" aria-hidden="true" className="size-12" />
          <span>
            Drag &amp; Drop files Here
            <br />
            or <span className="font-medium text-title">Browse</span>
          </span>
          {file && (
            <span className="text-xs text-field-foreground">
              {file.name}: {file.rows.length} line{file.rows.length === 1 ? '' : 's'} ready
            </span>
          )}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => void read(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => {
            downloadText(LOGS_TEMPLATE, 'attendance-log-template.csv')
          }}
          className="w-fit text-xs text-primary underline-offset-2 hover:underline"
        >
          Download a template (Employee Code, Date, Time, Punch Type)
        </button>
        {file && file.errors.length > 0 && (
          <ul
            role="alert"
            className="grid max-h-32 gap-1 overflow-y-auto rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {file.errors.slice(0, 20).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}

/** "Download Attendance Log": the API's CSV of every punch between two dates (up to 31 days). */
export function DownloadLogDialog({
  initialFrom,
  initialTo,
  onClose,
}: {
  initialFrom?: string
  initialTo?: string
  onClose: () => void
}) {
  const [from, setFrom] = useState(() => initialFrom ?? toDateValue(new Date()))
  const [to, setTo] = useState(() => initialTo ?? initialFrom ?? toDateValue(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = parseDateValue(from)
  const end = parseDateValue(to)
  const rangeError =
    !start || !end
      ? 'Choose both dates'
      : end < start
        ? 'To must be on or after From'
        : differenceInCalendarDays(end, start) + 1 > 31
          ? 'Choose at most 31 days'
          : null
  const download = async () => {
    if (rangeError) return
    setBusy(true)
    setError(null)
    try {
      await logsApi.download({ from, to })
      onClose()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not download the log.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AppDialog
      title="Download Attendance Log"
      onRequestClose={onClose}
      className={cn('max-w-md', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={cn(logDialogButtonClass, 'flex-1')}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            disabled={busy || rangeError !== null}
            onClick={() => void download()}
            className={cn(logDialogButtonClass, navyButtonClass, 'flex-1')}
          >
            Download
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <DateBox label="From" variant="form" value={from} maxDate={new Date()} onChange={setFrom} />
        <DateBox
          label="To"
          variant="form"
          value={to}
          minDate={start}
          maxDate={new Date()}
          onChange={setTo}
        />
        {(rangeError ?? error) && (
          <p role="alert" className="text-sm text-destructive">
            {rangeError ?? error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}
