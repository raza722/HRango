/** Official Visit needs no look-ups of its own (the day's time slot is read when a date is picked). */
export function loadOfficialVisitsLookups(): Promise<object> {
  return Promise.resolve({})
}
