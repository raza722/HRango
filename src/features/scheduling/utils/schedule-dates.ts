import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  getWeekOfMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'

import type { RepeatRule, ScheduleView, Weekday } from '../types/scheduling.types'

export const DAY_FORMAT = 'yyyy-MM-dd'

/** The board's weeks start on Sunday, as drawn (Sun 11 … Sat 17). */
const WEEK_STARTS_ON = 0

export const toDate = (value: string): Date => parseISO(value)
export const toDay = (date: Date): string => format(date, DAY_FORMAT)

export function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

/** Every date from `from` to `to`, inclusive; empty when the range is reversed. */
export function eachDay(from: string, to: string): string[] {
  if (!isDay(from) || !isDay(to) || to < from) return []
  return eachDayOfInterval({ start: toDate(from), end: toDate(to) }).map(toDay)
}

const WEEKDAY_BY_INDEX: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function weekdayOf(day: string): Weekday {
  return WEEKDAY_BY_INDEX[toDate(day).getDay()] ?? 'mon'
}

/**
 * Dates a repeat rule covers: the chosen weekdays between `from` and `to`, in
 * weeks that fall inside each cycle. "Every 2 Week" with Step 1 is one week on,
 * one week off; "Every 3 Week" with Step 2 is two on, one off.
 */
export function repeatDates(rule: RepeatRule): string[] {
  const firstWeek = startOfWeek(toDate(rule.from), { weekStartsOn: 1 })
  const step = Math.min(Math.max(1, rule.step), rule.everyWeeks)
  return eachDay(rule.from, rule.to).filter((day) => {
    if (!rule.weekdays.includes(weekdayOf(day))) return false
    const week = differenceInCalendarWeeks(toDate(day), firstWeek, { weekStartsOn: 1 })
    return week % rule.everyWeeks < step
  })
}

/** Dates a new schedule fills: the whole range, or only what the repeat rule picks inside it. */
export function scheduleDates(
  startDate: string,
  endDate: string,
  repeat: RepeatRule | null,
): string[] {
  if (!repeat) return eachDay(startDate, endDate)
  return repeatDates(repeat).filter((day) => day >= startDate && day <= endDate)
}

/** The period the board shows around `anchor`. */
export function periodRange(view: ScheduleView, anchor: string): { from: string; to: string } {
  const date = toDate(anchor)
  if (view === 'week') {
    return {
      from: toDay(startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })),
      to: toDay(endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })),
    }
  }
  if (view === 'year') return { from: toDay(startOfYear(date)), to: toDay(endOfYear(date)) }
  return { from: toDay(startOfMonth(date)), to: toDay(endOfMonth(date)) }
}

/** The anchor one period earlier (`-1`) or later (`1`). */
export function shiftAnchor(view: ScheduleView, anchor: string, direction: -1 | 1): string {
  const date = toDate(anchor)
  if (view === 'week') return toDay(addWeeks(date, direction))
  if (view === 'year') return toDay(addYears(date, direction))
  return toDay(addMonths(date, direction))
}

/** "Aug 1, 2024 - Aug 31, 2024", as on the purple period header. */
export function formatRange(from: string, to: string): string {
  const label = (day: string) => format(toDate(day), 'MMM d, yyyy')
  return `${label(from)} - ${label(to)}`
}

/** Week bands above the days: "Aug- Week 3" spanning the days of that week. */
export function weekBands(days: readonly string[]): { label: string; span: number; key: string }[] {
  const bands: { label: string; span: number; key: string }[] = []
  for (const day of days) {
    const date = toDate(day)
    const label = `${format(date, 'MMM')}- Week ${getWeekOfMonth(date, { weekStartsOn: WEEK_STARTS_ON })}`
    const last = bands.at(-1)
    if (last?.label === label) last.span += 1
    else bands.push({ label, span: 1, key: day })
  }
  return bands
}

export const nextDay = (day: string, amount = 1) => toDay(addDays(toDate(day), amount))

/** The API numbers weekdays 1 (Monday) … 7 (Sunday). */
export const weekdayNumber = (day: Weekday): number =>
  ({ mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 })[day]

/**
 * Dates a batch or rest-day rule covers, as the API counts them: the chosen weekdays (all
 * when none) between the dates; with `everyWeeks` > 0, cycles of that many weeks counted
 * from the Monday of the start date, of which the first `step` weeks are on.
 */
export function patternDates(
  startDate: string,
  endDate: string,
  weekdays: readonly Weekday[],
  everyWeeks: number,
  step: number,
): string[] {
  if (!isDay(startDate)) return []
  const firstWeek = startOfWeek(toDate(startDate), { weekStartsOn: 1 })
  const on = Math.min(Math.max(1, step), Math.max(1, everyWeeks))
  return eachDay(startDate, endDate).filter((day) => {
    if (weekdays.length > 0 && !weekdays.includes(weekdayOf(day))) return false
    if (everyWeeks <= 0) return true
    const week = differenceInCalendarWeeks(toDate(day), firstWeek, { weekStartsOn: 1 })
    return week % everyWeeks < on
  })
}
