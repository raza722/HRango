import { useId, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { toast } from 'sonner'

import uploadFolder from '@/assets/attendance/upload-folder.svg'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { downloadText } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { PUNCH_TYPE_LABELS } from '../../constants'
import { useDeviceEnrolments, useImportDevicePunches } from '../../hooks/use-devices'
import { PUNCH_TYPES } from '../../types/attendance.types'
import type { BiometricDevice, DeviceImportResult } from '../../types/devices.types'
import { plural } from '../../utils/device-format'
import {
  MAX_PUNCH_LINES,
  previewPunches,
  type PunchPreviewLine,
  readPunchedAt,
  samplePunchesCsv,
} from '../../utils/device-punches'
import { compactTableClass, settingsDialogButtonClass } from '../../utils/settings-styles'

/** Lines shown in the preview table (all of them are sent). */
const PREVIEW_ROWS = 100

const greenButtonClass = 'bg-[#4CBB6C] text-white hover:bg-[#4CBB6C]/90'

type Mode = 'file' | 'paste'

interface Outcome {
  result: DeviceImportResult
  /** Lines the preview kept back (a blank or too long box). */
  notSent: PunchPreviewLine[]
  /** Days to open in Attendance Logs (at most 31). */
  logs: { from: string; to: string } | null
}

const typeLabel = (line: PunchPreviewLine) => {
  const type = PUNCH_TYPES.find((item) => item === line.payload?.punchType)
  if (type) return PUNCH_TYPE_LABELS[type]
  return line.punchTypeText || 'Not given'
}

function CheckCell({ line }: { line: PunchPreviewLine }) {
  if (!line.payload) {
    return <span className="text-destructive">Not sent: {line.problem}</span>
  }
  if (line.problem) {
    return (
      <span className="text-[#8A5A00] dark:text-amber-200">Will likely fail: {line.problem}</span>
    )
  }
  return <span className="text-[#2E8B4A] dark:text-green-400">Ready</span>
}

const previewColumns: DataTableColumn<PunchPreviewLine>[] = [
  { id: 'line', header: 'Line', className: 'w-14', cell: (row) => row.line },
  {
    id: 'number',
    header: 'Device User No',
    mobile: 'heading',
    cell: (row) => (
      <span className="tabular-nums">
        {row.deviceUserNo || '—'}
        {row.employeeName && (
          <span className="block text-[0.5625rem] text-grey">{row.employeeName}</span>
        )}
      </span>
    ),
  },
  { id: 'at', header: 'Punched At', cell: (row) => row.punchedAtText || '—' },
  { id: 'type', header: 'Punch Type', cell: typeLabel },
  {
    id: 'check',
    header: 'Check',
    className: 'min-w-40 whitespace-normal',
    cell: (row) => <CheckCell line={row} />,
  },
]

/** The days of the sent punches, as an Attendance Logs range (≤ 31 days, up to today). */
function logsRange(lines: readonly PunchPreviewLine[]): Outcome['logs'] {
  const today = format(new Date(), 'yyyy-MM-dd')
  // Only times that are real dates (a line's raw "2026-02-30 09:00" is not).
  const days = lines
    .map((line) => readPunchedAt(line.payload?.punchedAt ?? '')?.slice(0, 10) ?? '')
    .filter((day) => day !== '' && day <= today)
    .sort()
  const last = days.at(-1)
  const first = days[0]
  if (!first || !last) return null
  const from =
    differenceInCalendarDays(parseISO(last), parseISO(first)) > 30
      ? format(subDays(parseISO(last), 30), 'yyyy-MM-dd')
      : first
  return { from, to: last }
}

/**
 * Import punches the device handed over: a CSV file (dropped or chosen) or pasted lines of
 * Device User No, Punched At and Punch Type. The lines are previewed first, with what will
 * most likely fail; the API then answers created / skipped (already there) / failed, with
 * every failed line and why. Imported punches show in Attendance Logs as machine punches.
 */
export function ImportPunchesTab({ device }: { device: BiometricDevice }) {
  const baseId = useId()
  const enrolments = useDeviceEnrolments(device.id)
  const importPunches = useImportDevicePunches()
  const [mode, setMode] = useState<Mode>('file')
  const [source, setSource] = useState<{ name: string; text: string } | null>(null)
  const [pasted, setPasted] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const people = useMemo(
    () => new Map((enrolments.data ?? []).map((row) => [row.deviceUserNo, row.employeeName])),
    [enrolments.data],
  )
  const lines = useMemo(() => (source ? previewPunches(source.text, people) : []), [source, people])
  const sendable = lines.filter((line) => line.payload !== null)
  const likelyToFail = sendable.filter((line) => line.problem !== null).length
  const notSent = lines.length - sendable.length

  const read = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setOutcome(null)
    setSource({ name: file.name, text: await file.text() })
  }

  const clear = () => {
    setSource(null)
    setPasted('')
    setError(null)
  }

  const downloadSample = () => {
    const numbers = (enrolments.data ?? []).map((row) => row.deviceUserNo)
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    downloadText(samplePunchesCsv(numbers, yesterday), `${device.code}-punches-sample.csv`)
  }

  const submit = async () => {
    setError(null)
    if (sendable.length === 0) {
      setError('There is no line to import: every line needs a device user no and a punch time.')
      return
    }
    if (sendable.length > MAX_PUNCH_LINES) {
      setError(`Import at most ${MAX_PUNCH_LINES.toLocaleString()} lines at a time.`)
      return
    }
    try {
      const result = await importPunches.mutateAsync({
        deviceId: device.id,
        lines: sendable.flatMap((line) => (line.payload ? [line.payload] : [])),
      })
      toast.success(
        [
          `Imported ${plural(result.created, 'punch', 'punches')}`,
          result.skipped > 0 ? `${String(result.skipped)} skipped` : null,
          result.failed > 0 ? `${String(result.failed)} failed` : null,
        ]
          .filter(Boolean)
          .join(', '),
      )
      setOutcome({
        result,
        notSent: lines.filter((line) => line.payload === null),
        logs: logsRange(sendable),
      })
      clear()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not import the punches.')
    }
  }

  if (outcome) {
    const { result } = outcome
    const tiles = [
      { label: 'Created', value: result.created, className: 'text-[#2E8B4A] dark:text-green-400' },
      { label: 'Skipped', value: result.skipped, className: 'text-title' },
      { label: 'Failed', value: result.failed, className: 'text-destructive' },
    ]
    return (
      <section aria-labelledby={`${baseId}-result`} className="grid gap-4">
        <h2 id={`${baseId}-result`} className="text-base font-medium text-title">
          Import result
        </h2>
        <dl className="grid grid-cols-3 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="grid gap-1 rounded-md bg-muted/60 px-4 py-3">
              <dt className="text-xs text-muted-foreground">{tile.label}</dt>
              <dd className={cn('text-2xl font-medium tabular-nums', tile.className)}>
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          {result.created > 0
            ? `${plural(result.created, 'punch is', 'punches are')} now in Attendance Logs, from ${device.name} (${device.code}). `
            : ''}
          {result.skipped > 0
            ? `${plural(result.skipped, 'line was', 'lines were')} skipped: the punch was already there.`
            : ''}
        </p>
        {result.errors.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium text-title">
              {plural(result.errors.length, 'line', 'lines')} failed
            </h3>
            <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {result.errors.map((item) => (
                <li key={`${String(item.line)}-${item.message}`}>
                  Line {item.line}: {item.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {outcome.notSent.length > 0 && (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium text-title">
              {plural(outcome.notSent.length, 'line was', 'lines were')} not sent
            </h3>
            <ul className="grid max-h-40 gap-1 overflow-y-auto rounded-md bg-muted/60 px-3 py-2 text-xs text-title">
              {outcome.notSent.map((line) => (
                <li key={line.line}>
                  Line {line.line}: {line.problem}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          {outcome.logs && (
            <Button asChild variant="outline" size="lg" className={settingsDialogButtonClass}>
              <Link to="/attendance/logs" search={outcome.logs}>
                Open Attendance Logs
              </Link>
            </Button>
          )}
          <Button
            size="lg"
            onClick={() => {
              setOutcome(null)
            }}
            className={cn(settingsDialogButtonClass, greenButtonClass)}
          >
            Import more punches
          </Button>
        </div>
      </section>
    )
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Punches from" className="inline-flex rounded-md bg-muted p-1">
          {(
            [
              ['file', 'Upload a file'],
              ['paste', 'Paste lines'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value)
                clear()
              }}
              className={cn(
                'h-8 rounded-sm px-4 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                mode === value
                  ? 'bg-card font-medium text-heading shadow-xs'
                  : 'text-muted-foreground hover:text-field-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={downloadSample}
          className="w-fit rounded-sm text-sm text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Download a sample file
        </button>
      </div>

      <p id={`${baseId}-columns`} className="text-xs text-muted-foreground">
        Columns: Device User No, Punched At (yyyy-mm-dd hh:mm, seconds optional), Punch Type
        (check_in, check_out, break_out or break_in; when it is blank the day&apos;s first punch
        counts as the check in). A header line is optional.
      </p>

      {mode === 'file' ? (
        <>
          <label
            htmlFor={`${baseId}-file`}
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
              'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center text-sm text-[#A4A4A4] transition-colors dark:text-label',
              dragging && 'border-primary bg-primary/5',
            )}
          >
            <img src={uploadFolder} alt="" aria-hidden="true" className="size-12" />
            <span>
              Drag &amp; Drop the device&apos;s CSV file here
              <br />
              or <span className="font-medium text-title">Browse</span>
            </span>
            {source && (
              <span className="text-xs text-field-foreground">
                {source.name}: {plural(lines.length, 'line', 'lines')} read
              </span>
            )}
          </label>
          <input
            id={`${baseId}-file`}
            type="file"
            accept=".csv,text/csv,text/plain"
            aria-describedby={`${baseId}-columns`}
            className="sr-only"
            onChange={(event) => {
              void read(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </>
      ) : (
        <div className="grid gap-2">
          <label htmlFor={`${baseId}-paste`} className="text-sm font-medium text-heading">
            Punch lines
          </label>
          <Textarea
            id={`${baseId}-paste`}
            value={pasted}
            onChange={(event) => {
              setPasted(event.target.value)
            }}
            aria-describedby={`${baseId}-columns`}
            rows={6}
            placeholder={'1001,2026-10-28 09:02,check_in\n1001,2026-10-28 18:05,check_out'}
            className="font-mono text-xs sm:text-xs"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pasted.trim() === ''}
              onClick={() => {
                setOutcome(null)
                setError(null)
                setSource({ name: 'Pasted lines', text: pasted })
              }}
            >
              Preview
            </Button>
          </div>
        </div>
      )}

      {source && (
        <section aria-labelledby={`${baseId}-preview`} className="grid min-w-0 gap-3">
          <div className="grid gap-1">
            <h2 id={`${baseId}-preview`} className="text-base font-medium text-title">
              Preview
            </h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {lines.length === 0
                ? 'No lines were found.'
                : [
                    `${plural(lines.length, 'line', 'lines')} read`,
                    `${String(sendable.length - likelyToFail)} ready`,
                    likelyToFail > 0 ? `${String(likelyToFail)} likely to fail` : null,
                    notSent > 0 ? `${String(notSent)} not sent` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
              {enrolments.isPending && ' (reading who is enrolled…)'}
            </p>
          </div>
          {lines.length > 0 && (
            <DataTable
              columns={previewColumns}
              data={lines.slice(0, PREVIEW_ROWS)}
              getRowId={(row) => String(row.line)}
              caption={`Punch lines of ${source.name}`}
              className={compactTableClass}
            />
          )}
          {lines.length > PREVIEW_ROWS && (
            <p className="text-xs text-muted-foreground">
              The first {PREVIEW_ROWS} lines are shown; all{' '}
              {plural(sendable.length, 'line', 'lines')} that can be sent will be.
            </p>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {source && (
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={importPunches.isPending}
            onClick={clear}
            className={settingsDialogButtonClass}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={importPunches.isPending || sendable.length === 0}
            onClick={() => void submit()}
            className={cn(settingsDialogButtonClass, greenButtonClass)}
          >
            {importPunches.isPending
              ? 'Importing…'
              : `Import ${plural(sendable.length, 'line', 'lines')}`}
          </Button>
        </div>
      )}
    </div>
  )
}
