import { PUNCH_SOURCE_LABELS, PUNCH_TYPE_LABELS } from '../constants'
import { PUNCH_TYPES, type PunchType } from '../types/attendance.types'
import type { AttendanceLogRow, FileImportRow } from '../types/settings.types'

const HEADER = ['Employee Code', 'Date', 'Time', 'Punch Type']

/** A file to start from: the columns Import expects, with two sample lines. */
export const LOGS_TEMPLATE = `${HEADER.join(',')}\nId-003,2026-10-19,09:02,check-in\nId-003,2026-10-19,17:05,check-out\n`

function splitLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index)
    if (char === '"') {
      if (quoted && line.charAt(index + 1) === '"') {
        current += '"'
        index += 1
      } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else current += char
  }
  cells.push(current.trim())
  return cells
}

/** "Check In" / "check-in" → `check-in`. */
function punchType(value: string): PunchType | undefined {
  const key = value.trim().toLowerCase().replace(/\s+/g, '-')
  return PUNCH_TYPES.find((type) => type === key)
}

/**
 * Reads an attendance log file (Employee Code, Date, Time, Punch Type).
 * Good lines become rows; bad ones are explained by line number.
 */
export function parseLogsCsv(text: string): { rows: FileImportRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  const rows: FileImportRow[] = []
  const errors: string[] = []
  const [first, ...rest] = lines
  if (!first) return { rows, errors: ['The file is empty.'] }
  const hasHeader = first.toLowerCase().includes('employee')
  const body = hasHeader ? rest : lines
  body.forEach((line, index) => {
    const number = index + (hasHeader ? 2 : 1)
    const [code = '', date = '', time = '', type = ''] = splitLine(line)
    const kind = punchType(type)
    const clock = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : ''
    if (!code) errors.push(`Line ${number}: the employee code is missing`)
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      errors.push(`Line ${number}: the date must be yyyy-mm-dd`)
    else if (!clock) errors.push(`Line ${number}: the time must be HH:mm`)
    else if (!kind)
      errors.push(
        `Line ${number}: the punch type must be check-in, check-out, break-out or break-in`,
      )
    else rows.push({ employeeCode: code, date, time: clock, type: kind })
  })
  return { rows, errors }
}

const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

export function logsToCsv(rows: readonly AttendanceLogRow[]): string {
  const header = [
    'Employee',
    'Employee Code',
    'Punch Type',
    'Punch Time',
    'Source',
    'Machine',
    'Description',
  ]
  const lines = rows.map((row) =>
    [
      row.employee.name,
      row.employee.code,
      PUNCH_TYPE_LABELS[row.type],
      row.at.replace('T', ' '),
      PUNCH_SOURCE_LABELS[row.source],
      row.machineId ? `Machine (${row.machineId})` : '',
      row.description,
    ]
      .map(quote)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n') + '\n'
}

export function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
