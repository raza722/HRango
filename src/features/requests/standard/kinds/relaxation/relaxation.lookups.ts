/**
 * Relaxation needs no look-ups of its own: the day's time slot is read from
 * the schedule when a date is picked (`fetchDaySlot`).
 */
export function loadRelaxationLookups(): Promise<object> {
  return Promise.resolve({})
}
