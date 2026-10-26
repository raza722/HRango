import { toDateValue } from '@/lib/date'

import type { RosterGroupFormValues } from '../schemas/roster-group-form.schema'
import {
  ROSTER_DAYS,
  rosterDayOf,
  type RosterGroupDetail,
  type RosterGroupInput,
  weekdayNumber,
} from '../types/roster.types'

/** A new group: active from today, Monday–Friday working, Saturday and Sunday off. */
export function createDefaultRosterValues(today = new Date()): RosterGroupFormValues {
  return {
    title: '',
    fromDate: toDateValue(today),
    toDate: '',
    description: '',
    isActive: true,
    defaultTimeSlotId: '',
    applyToAll: false,
    days: ROSTER_DAYS.map((day) => ({
      day,
      isDayOff: day === 'saturday' || day === 'sunday',
      timeSlotId: '',
    })),
  }
}

export function toRosterFormValues(group: RosterGroupDetail): RosterGroupFormValues {
  const byDay = new Map(group.days.map((day) => [rosterDayOf(day.weekday), day]))
  const days = ROSTER_DAYS.map((day) => {
    const saved = byDay.get(day)
    if (!saved || saved.isDayOff) return { day, isDayOff: true, timeSlotId: '' }
    return { day, isDayOff: false, timeSlotId: saved.timeSlotId ?? '' }
  })
  // Every working day on one slot reads back as that slot with "Apply For All".
  const slots = [...new Set(days.filter((day) => !day.isDayOff).map((day) => day.timeSlotId))]
  const shared = slots.length === 1 ? (slots[0] ?? '') : ''
  return {
    title: group.title,
    fromDate: group.fromDate,
    toDate: group.toDate ?? '',
    description: group.description ?? '',
    isActive: group.isActive,
    defaultTimeSlotId: shared,
    applyToAll: shared !== '',
    days,
  }
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())

/** The body of `POST` / `PUT /roster/groups`; edits pass the row version last read. */
export function toRosterInput(
  values: RosterGroupFormValues,
  rowVersion?: string,
): RosterGroupInput {
  return {
    title: values.title.trim(),
    fromDate: values.fromDate,
    toDate: orNull(values.toDate),
    description: orNull(values.description),
    isActive: values.isActive,
    days: values.days.map((day) =>
      // Days off never keep a stale slot.
      day.isDayOff
        ? { weekday: weekdayNumber(day.day), isDayOff: true, timeSlotId: null }
        : {
            weekday: weekdayNumber(day.day),
            isDayOff: false,
            timeSlotId: values.applyToAll ? values.defaultTimeSlotId : day.timeSlotId,
          },
    ),
    ...(rowVersion ? { rowVersion } : {}),
  }
}
