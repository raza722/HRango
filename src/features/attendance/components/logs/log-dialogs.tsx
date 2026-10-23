import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api-error'
import { toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { logsApi } from '../../api/settings.api'
import { PUNCH_SOURCE_LABELS, PUNCH_TYPE_LABELS } from '../../constants'
import { useAttendanceLookups } from '../../hooks/use-attendance'
import {
  useImportFile,
  useImportMachines,
  useMachines,
  useSaveLog,
} from '../../hooks/use-attendance-settings'
import { PUNCH_TYPES } from '../../types/attendance.types'
import type {
  AttendanceLogRow,
  FileImportRow,
  MachineImportResult,
} from '../../types/settings.types'
import { formatPunchTime, splitLocal } from '../../utils/local-time'
import { downloadText, LOGS_TEMPLATE, logsToCsv, parseLogsCsv } from '../../utils/logs-csv'
import {
  logDialogButtonClass,
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  switchOnClass,
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
  description: z.string().trim().max(200, 'Keep it under 200 characters'),
})
type LogValues = z.infer<typeof logSchema>

/** "Create Attendance Log" (and Edit): Employee Name, Punch Type, Punch Time, Punch Date, Description. */
export function LogFormDialog({
  log,
  onClose,
}: {
  log: AttendanceLogRow | null
  onClose: () => void
}) {
  const save = useSaveLog()
  const lookups = useAttendanceLookups()
  const at = log ? splitLocal(log.at) : null
  const form = useForm<LogValues>({
    resolver: zodResolver(logSchema),
    defaultValues: {
      employeeId: log?.employee.id ?? '',
      type: log?.type ?? '',
      time: at?.time ?? '',
      date: log?.date ?? '',
      description: log?.description ?? '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    const type = PUNCH_TYPES.find((item) => item === values.type)
    if (!type) return
    try {
      await save.mutateAsync({
        id: log?.id,
        input: {
          employeeId: values.employeeId,
          date: values.date,
          time: values.time,
          type,
          description: values.description.trim(),
        },
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors.date) form.setError('date', { message: error.fieldErrors.date })
        else form.setError('root', { message: error.message })
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
          <SelectField
            control={form.control}
            name="employeeId"
            label="Employee Name"
            placeholder="Select"
            options={(lookups.data?.employees ?? [])
              .filter((employee) => employee.status === 'active')
              .map((employee) => ({
                value: employee.id,
                label: `${employee.code} | ${employee.name}`,
              }))}
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

/** One punch, read-only. */
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
        <ReadOnlyField label="Employee" value={`${log.employee.name} (${log.employee.code})`} />
        <ReadOnlyField label="Punch Type" value={PUNCH_TYPE_LABELS[log.type]} />
        <ReadOnlyField label="Punch Time" value={formatPunchTime(log.at)} />
        <ReadOnlyField label="Source" value={PUNCH_SOURCE_LABELS[log.source]} />
        <ReadOnlyField label="Machine" value={log.machineId ? `Machine (${log.machineId})` : '—'} />
        <ReadOnlyField label="Manually Updated" value={log.manuallyUpdated ? 'Yes' : 'No'} />
        <ReadOnlyField
          label="Description"
          value={log.description || '—'}
          className="@lg:col-span-2"
        />
      </div>
    </AppDialog>
  )
}

/** "Import Attendance Log": from a file (Computer) or from the biometric machines. */
export function ImportLogDialog({ onClose }: { onClose: () => void }) {
  const inputId = useId()
  const [mode, setMode] = useState<'computer' | 'machine'>('computer')
  const [file, setFile] = useState<{
    name: string
    rows: FileImportRow[]
    errors: string[]
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [result, setResult] = useState<MachineImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const machines = useMachines()
  const importFile = useImportFile()
  const importMachines = useImportMachines()
  const pending = importFile.isPending || importMachines.isPending

  const read = async (picked: File | undefined) => {
    if (!picked) return
    setError(null)
    const text = await picked.text()
    setFile({ name: picked.name, ...parseLogsCsv(text) })
  }

  const submit = async () => {
    setError(null)
    try {
      if (mode === 'computer') {
        if (!file || file.rows.length === 0) {
          setError('Choose a file with at least one good line.')
          return
        }
        const outcome = await importFile.mutateAsync(file.rows)
        if (outcome.errors.length > 0) {
          setFile({ ...file, rows: [], errors: outcome.errors })
          return
        }
        onClose()
      } else {
        if (selected.size === 0) {
          setError('Select at least one machine.')
          return
        }
        setResult(await importMachines.mutateAsync([...selected]))
      }
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
            {result ? 'Close' : 'Cancel'}
          </Button>
          <Button
            size="lg"
            disabled={pending}
            onClick={() => void submit()}
            className={cn(logDialogButtonClass, greenButtonClass, 'flex-1')}
          >
            Import
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="flex w-fit items-center gap-2.5 text-xs font-medium text-grey">
          <span className={cn(mode === 'computer' && switchOnClass)}>Computer</span>
          <Switch
            checked={mode === 'machine'}
            aria-label="Import from the machines"
            onCheckedChange={(checked) => {
              setMode(checked ? 'machine' : 'computer')
              setError(null)
            }}
            className="data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary"
          />
          <span className={cn(mode === 'machine' && switchOnClass)}>Machine</span>
        </label>

        {mode === 'computer' ? (
          <>
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
          </>
        ) : result ? (
          <ul aria-label="Import results" className="grid gap-2 text-sm">
            {result.machines.map((machine) => (
              <li key={machine.id} className="rounded-md bg-muted px-3 py-2">
                <span className="font-medium text-heading">{machine.label}</span>
                <span className="block text-xs text-field-foreground">
                  Checking In … {machine.checkIns} · Checking Out … {machine.checkOuts}
                </span>
              </li>
            ))}
            <li className="text-xs text-muted-foreground">
              {result.imported} new punch{result.imported === 1 ? '' : 'es'} imported.
            </li>
          </ul>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm text-title">Select Machines</legend>
            <div className="grid gap-x-6 gap-y-2 @sm:grid-cols-2">
              {(machines.data ?? []).map((machine) => (
                <label
                  key={machine.id}
                  className="flex items-start gap-2 text-xs text-field-foreground"
                >
                  <Checkbox
                    checked={selected.has(machine.id)}
                    onCheckedChange={(checked) => {
                      setSelected((current) => {
                        const next = new Set(current)
                        if (checked === true) next.add(machine.id)
                        else next.delete(machine.id)
                        return next
                      })
                    }}
                  />
                  <span>
                    {machine.label}
                    <span className="block text-[0.6875rem] text-muted-foreground">
                      {machine.branch ?? 'Spare'}
                      {machine.lastSyncedAt
                        ? ` · read ${formatPunchTime(machine.lastSyncedAt)}`
                        : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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

/** "Download Attendance Log": every punch of a chosen date as a CSV file. */
export function DownloadLogDialog({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(() => toDateValue(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const rows: AttendanceLogRow[] = []
      for (let page = 1; ; page += 1) {
        const result = await logsApi.list({ from: date, to: date, page, pageSize: 100 })
        rows.push(...result.data)
        if (page >= result.meta.totalPages) break
      }
      downloadText(logsToCsv(rows), `attendance-log-${date}.csv`)
      onClose()
    } catch {
      setError('Could not download the log. Try again.')
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
            disabled={busy || !date}
            onClick={() => void download()}
            className={cn(logDialogButtonClass, navyButtonClass, 'flex-1')}
          >
            Download
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <DateBox
          label="Select Date"
          variant="form"
          value={date}
          maxDate={new Date()}
          onChange={setDate}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}
