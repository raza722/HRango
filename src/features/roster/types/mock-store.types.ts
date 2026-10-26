import type { RosterDay } from './roster.types'

/*
 * Records of the in-browser mock database (`src/mocks/roster/`). The mock APIs of other
 * modules (attendance, requests, payroll, leaves) read roster groups in this shape, so it
 * stays as it was. The real API's shapes are `RosterGroupDetail` / `RosterGroupRow`.
 */

/** Mock store: one weekday as clock times (derived from its time slot). */
export interface RosterDaySchedule {
  day: RosterDay
  /** A day off: no clock in / clock out. */
  isWeekend: boolean
  /** `HH:mm` (24h); `null` on a day off. */
  clockIn: string | null
  /** `HH:mm`; earlier than `clockIn` means the shift ends the next day. */
  clockOut: string | null
}

/** Mock store record of a roster group (not an API shape; see `RosterGroupDetail`). */
export interface RosterGroup {
  id: string
  title: string
  isActive: boolean
  /** Default times of the old form (kept for the other mocks). */
  clockIn: string | null
  clockOut: string | null
  applyToAll: boolean
  /** Always seven entries, Monday first. */
  days: RosterDaySchedule[]
  createdAt: string
  updatedAt: string
}
