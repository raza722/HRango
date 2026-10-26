import type { BoardRow } from '../types/scheduling.types'
import { isDay } from './schedule-dates'
import { clockOf, formatHours } from './shift-hours'

/** One row of an import file (Import is not in the API's first build; kept for later). */
export interface ImportRow {
  employeeCode: string
  date: string
  clockIn: string | null
  clockOut: string | null
  restDay: boolean
}

const HEADER = [
  'Employee Code',
  'Employee Name',
  'Date',
  'Type',
  'Clock In',
  'Clock Out',
  'Time Slot',
  'Planned',
]

function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * A board page as CSV, one line per shift or rest day. The Export button uses the API's
 * own CSV (`GET /scheduling/schedules/export`); this is for pages already loaded.
 */
export function scheduleToCsv(rows: readonly BoardRow[]): string {
  const lines = [HEADER.join(',')]
  for (const row of rows) {
    const shiftLines = row.shifts.map((shift) => ({
      date: shift.workDate,
      values: [
        'Shift',
        clockOf(shift.startAt) ?? '',
        clockOf(shift.endAt) ?? '',
        shift.timeSlotName,
        formatHours(shift.plannedMinutes),
      ],
    }))
    const restLines = row.restDays.map((rest) => ({
      date: rest.restDate,
      values: ['Rest Day', '', '', '', formatHours(0)],
    }))
    for (const line of [...shiftLines, ...restLines].sort((a, b) => a.date.localeCompare(b.date))) {
      lines.push(
        [row.employee.code, row.employee.name, line.date, ...line.values].map(cell).join(','),
      )
    }
  }
  return lines.join('\n')
}

/** A downloadable example for a future Import. */
export const IMPORT_TEMPLATE = [
  'Employee Code,Date,Clock In,Clock Out,Rest Day',
  'Id-001,2026-11-02,09:00,17:00,no',
  'Id-001,2026-11-08,,,yes',
].join('\n')

function splitLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index)
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else if (char === '"') quoted = false
      else current += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      cells.push(current)
      current = ''
    } else current += char
  }
  cells.push(current)
  return cells.map((value) => value.trim())
}

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/
const pad = (time: string) => (time.length === 4 ? `0${time}` : time)

/**
 * Reads an import file: Employee Code, Date (yyyy-MM-dd), Clock In, Clock Out,
 * Rest Day (yes/no). Returns the good rows and a message per bad line.
 */
export function parseScheduleCsv(text: string): { rows: ImportRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const rows: ImportRow[] = []
  const errors: string[] = []
  lines.forEach((line, index) => {
    const [code = '', date = '', clockIn = '', clockOut = '', rest = ''] = splitLine(line)
    if (index === 0 && code.toLowerCase().includes('code')) return
    const lineNo = index + 1
    const restDay = /^(y|yes|true|1)$/i.test(rest)
    if (!code) errors.push(`Line ${lineNo}: the employee code is missing.`)
    else if (!isDay(date)) errors.push(`Line ${lineNo}: "${date}" is not a yyyy-MM-dd date.`)
    else if (!restDay && (!TIME.test(clockIn) || !TIME.test(clockOut))) {
      errors.push(`Line ${lineNo}: clock in and clock out must be HH:mm times.`)
    } else {
      rows.push({
        employeeCode: code,
        date,
        clockIn: restDay ? null : pad(clockIn),
        clockOut: restDay ? null : pad(clockOut),
        restDay,
      })
    }
  })
  return { rows, errors }
}
