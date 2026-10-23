import type { RosterGroupFormValues } from '../schemas/roster-group-form.schema'
import { ROSTER_DAYS, type RosterGroup, type RosterGroupInput } from '../types/roster.types'

/** A new group: active, Monday–Friday working, Saturday and Sunday off. */
export function createDefaultRosterValues(): RosterGroupFormValues {
  return {
    title: '',
    isActive: true,
    clockIn: '',
    clockOut: '',
    applyToAll: false,
    days: ROSTER_DAYS.map((day) => ({
      day,
      isWeekend: day === 'saturday' || day === 'sunday',
      clockIn: '',
      clockOut: '',
    })),
  }
}

export function toRosterFormValues(group: RosterGroup): RosterGroupFormValues {
  return {
    title: group.title,
    isActive: group.isActive,
    clockIn: group.clockIn ?? '',
    clockOut: group.clockOut ?? '',
    applyToAll: group.applyToAll,
    days: group.days.map((day) => ({
      day: day.day,
      isWeekend: day.isWeekend,
      clockIn: day.clockIn ?? '',
      clockOut: day.clockOut ?? '',
    })),
  }
}

const orNull = (value: string) => (value === '' ? null : value)

export function toRosterInput(values: RosterGroupFormValues): RosterGroupInput {
  return {
    title: values.title.trim(),
    isActive: values.isActive,
    clockIn: orNull(values.clockIn),
    clockOut: orNull(values.clockOut),
    applyToAll: values.applyToAll,
    days: values.days.map((day) =>
      // Weekend days never keep stale times.
      day.isWeekend
        ? { day: day.day, isWeekend: true, clockIn: null, clockOut: null }
        : {
            day: day.day,
            isWeekend: false,
            clockIn: values.applyToAll ? orNull(values.clockIn) : orNull(day.clockIn),
            clockOut: values.applyToAll ? orNull(values.clockOut) : orNull(day.clockOut),
          },
    ),
  }
}
