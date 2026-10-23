import type { BoardRow, ImportRow } from '../types/scheduling.types'
import { isDay } from './schedule-dates'
import { formatHours, plannedMinutes } from './shift-hours'

const HEADER = [
  'Employee Code',
  'Employee Name',
  'Date',
  'Type',
  'Clock In',
  'Clock Out',
  'Time Roster',
  'Planned',
]

function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** The board as CSV: one line per scheduled day. */
export function scheduleToCsv(
  rows: readonly BoardRow[],
  titleOf: (id: string | null) => string | null,
): string {
  const lines = [HEADER.join(',')]
  for (const row of rows) {
    for (const entry of row.entries) {
      lines.push(
        [
          row.employee.code,
          row.employee.name,
          entry.date,
          entry.kind === 'shift' ? 'Shift' : 'Rest Day',
          entry.clockIn ?? '',
          entry.clockOut ?? '',
          titleOf(entry.rosterGroupId) ?? entry.slot.name,
          formatHours(plannedMinutes(entry)),
        ]
          .map(cell)
          .join(','),
      )
    }
  }
  return lines.join('\n')
}

/** Saves the CSV through the browser's download. */
export function downloadScheduleCsv(
  rows: readonly BoardRow[],
  fileName: string,
  titleOf: (id: string | null) => string | null,
): void {
  const blob = new Blob([scheduleToCsv(rows, titleOf)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** A downloadable example for Import. */
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
