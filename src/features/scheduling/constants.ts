import type {
  BreakType,
  EmploymentType,
  Gender,
  ScheduleScope,
  ScheduleView,
  Weekday,
} from './types/scheduling.types'

export const SCOPE_LABELS: Record<ScheduleScope, string> = {
  my: 'My',
  all: 'All',
  subordinates: 'Subordinates',
}

export const VIEW_LABELS: Record<ScheduleView, string> = {
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export const BREAK_TYPE_LABELS: Record<BreakType, string> = {
  lunch: 'Lunch Break',
  rest: 'Rest Break',
  personal: 'Personal',
  prayer: 'Prayer Break',
}

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  permanent: 'Permanent',
  probation: 'Probation',
  contract: 'Contract',
  intern: 'Intern',
}

export const GENDER_LABELS: Record<Gender, string> = { female: 'Female', male: 'Male' }

/** "Repeat" options, as drawn: None, Every Week, Every 2 Week … Every 8 Week. */
export const REPEAT_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Every Week' },
  ...[2, 3, 4, 5, 6, 7, 8].map((weeks) => ({ value: String(weeks), label: `Every ${weeks} Week` })),
]

/** Employees per board page. */
export const BOARD_PAGE_SIZE = 10

/** Legend dot colours (Work from Home, Rest Day, Geo Fence). */
export const LEGEND = {
  workFromHome: { label: 'Work from Home', dot: 'bg-indigo-500' },
  restDay: { label: 'Rest Day', dot: 'bg-blue-500' },
  geoFence: { label: 'Geo Fence', dot: 'bg-green-400' },
} as const

/**
 * Shift cell colours, one per time roster (pastel cell, stronger side bars),
 * taken from the board frames: pink, peach, lime, taupe, lilac, then sky and mint.
 */
export interface ShiftTone {
  cell: string
  bar: string
}

export const SHIFT_TONES: readonly ShiftTone[] = [
  { cell: 'bg-rose-100 dark:bg-rose-400/20', bar: 'bg-rose-300 dark:bg-rose-400/60' },
  { cell: 'bg-orange-100 dark:bg-orange-400/20', bar: 'bg-orange-300 dark:bg-orange-400/60' },
  { cell: 'bg-lime-50 dark:bg-lime-400/15', bar: 'bg-lime-300 dark:bg-lime-400/50' },
  { cell: 'bg-stone-200 dark:bg-stone-400/25', bar: 'bg-stone-400 dark:bg-stone-400/60' },
  { cell: 'bg-fuchsia-100 dark:bg-fuchsia-400/20', bar: 'bg-fuchsia-300 dark:bg-fuchsia-400/60' },
  { cell: 'bg-sky-100 dark:bg-sky-400/20', bar: 'bg-sky-300 dark:bg-sky-400/60' },
  { cell: 'bg-emerald-100 dark:bg-emerald-400/20', bar: 'bg-emerald-300 dark:bg-emerald-400/60' },
]

/** Imported shifts and anything without a time roster. */
export const NEUTRAL_TONE: ShiftTone = {
  cell: 'bg-slate-100 dark:bg-slate-400/20',
  bar: 'bg-slate-300 dark:bg-slate-400/50',
}
