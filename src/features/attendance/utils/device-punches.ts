import { parseCsv, toCsv } from '@/features/payroll'

import type { PunchType } from '../types/attendance.types'
import type { DevicePunchLine } from '../types/devices.types'

/** The columns of a device punch file. */
export const DEVICE_PUNCH_HEADER = ['Device User No', 'Punched At', 'Punch Type'] as const

/** Most lines one import takes (the API's limit). */
export const MAX_PUNCH_LINES = 20000

/** Words devices and people use for the punch types (ZKTeco states 0–3 included). */
const TYPE_WORDS: Record<string, PunchType> = {
  check_in: 'check_in',
  checkin: 'check_in',
  in: 'check_in',
  i: 'check_in',
  '0': 'check_in',
  check_out: 'check_out',
  checkout: 'check_out',
  out: 'check_out',
  o: 'check_out',
  '1': 'check_out',
  break_out: 'break_out',
  breakout: 'break_out',
  '2': 'break_out',
  break_in: 'break_in',
  breakin: 'break_in',
  '3': 'break_in',
}

/** "Check In" / "check-in" / "0" → `check_in`; blank → null; anything else as typed (`known: false`). */
export function readPunchType(text: string): { type: string | null; known: boolean } {
  const key = text
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  if (key === '') return { type: null, known: true }
  const type = TYPE_WORDS[key]
  return type ? { type, known: true } : { type: text.trim(), known: false }
}

/**
 * `2026-10-28 09:02`, `2026-10-28T09:02:11` → `2026-10-28T09:02:11`; null when it is not a real
 * date and time (`2026-02-30 09:00`, `noon`).
 */
export function readPunchedAt(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim())
  if (!match) return null
  const [, year = '', month = '', day = '', hour = '', minute = '', second = '00'] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  const realDay =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  if (!realDay || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null
  return `${year}-${month}-${day}T${hour.padStart(2, '0')}:${minute}:${second}`
}

/** One line of the file as the preview shows it. */
export interface PunchPreviewLine {
  line: number
  deviceUserNo: string
  punchedAtText: string
  punchTypeText: string
  /** The person with this user number on the device, if any. */
  employeeName: string | null
  /** The line as it goes to the API; null when it cannot be sent (a blank or too long box). */
  payload: DevicePunchLine | null
  /** Why it is not sent, or what the API will most likely refuse it for. */
  problem: string | null
}

/** A pasted spreadsheet row has tabs between its cells. */
const tabsToCommas = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => (line.includes('\t') && !line.includes(',') ? line.replace(/\t/g, ',') : line))
    .join('\n')

/**
 * Reads a device punch file or pasted lines (Device User No, Punched At, Punch Type; the header
 * line is optional). Every line with its user number and time goes to the API, which decides;
 * the preview points out what will most likely fail, using who is enrolled (`people`: user
 * number → name).
 */
export function previewPunches(
  text: string,
  people: ReadonlyMap<string, string>,
): PunchPreviewLine[] {
  const prepared = tabsToCommas(text)
  const first = prepared.split('\n').find((line) => line.trim() !== '') ?? ''
  // `parseCsv` drops the header when its first line names the device column.
  const offset = first.toLowerCase().includes('device') ? 2 : 1
  return parseCsv(prepared, 'device').map((cells, index) => {
    const [deviceUserNo = '', punchedAtText = '', punchTypeText = ''] = cells
    const line = index + offset
    const employeeName = people.get(deviceUserNo) ?? null
    const base = { line, deviceUserNo, punchedAtText, punchTypeText, employeeName }
    const blocked =
      deviceUserNo === ''
        ? 'The device user no is missing'
        : deviceUserNo.length > 30
          ? 'The device user no is longer than 30 characters'
          : punchedAtText === ''
            ? 'The punch time is missing'
            : punchedAtText.length > 40
              ? 'The punch time is longer than 40 characters'
              : punchTypeText.length > 100
                ? 'The punch type is longer than 100 characters'
                : null
    if (blocked) return { ...base, payload: null, problem: blocked }
    const punchedAt = readPunchedAt(punchedAtText)
    const type = readPunchType(punchTypeText)
    const problem = !employeeName
      ? 'No one on this device has this user no'
      : !punchedAt
        ? 'Not a date and time (yyyy-mm-dd hh:mm)'
        : !type.known
          ? 'Not a punch type (check_in, check_out, break_out, break_in)'
          : null
    return {
      ...base,
      problem,
      payload: { line, deviceUserNo, punchedAt: punchedAt ?? punchedAtText, punchType: type.type },
    }
  })
}

/** A file to start from: the three columns and a day of punches for one or two people. */
export function samplePunchesCsv(userNumbers: readonly string[], day: string): string {
  const [first = '1001', second = first] = userNumbers
  return toCsv(
    [...DEVICE_PUNCH_HEADER],
    [
      [first, `${day} 09:02:15`, 'check_in'],
      [second, `${day} 09:07:40`, 'check_in'],
      [first, `${day} 13:01:02`, 'break_out'],
      [first, `${day} 13:44:51`, 'break_in'],
      [second, `${day} 17:58:09`, 'check_out'],
      [first, `${day} 18:05:33`, 'check_out'],
    ],
  )
}
