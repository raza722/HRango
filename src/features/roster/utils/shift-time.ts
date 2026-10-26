const MINUTES_PER_DAY = 24 * 60
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

/** `"16:15"` or `"16:15:00"` → 975; `null` for empty or malformed values. */
export function toMinutes(time: string | null | undefined): number | null {
  const match = time ? TIME_PATTERN.exec(time) : null
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** `"09:00:00"` (API) → `"09:00"`; empty stays `null`. */
export function toHhMm(time: string | null | undefined): string | null {
  return time ? time.slice(0, 5) : null
}

/**
 * Length of a shift in minutes. A clock out earlier than the clock in is the next day
 * (22:00 → 06:00 is 480). `null` when either time is missing.
 */
export function shiftMinutes(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
): number | null {
  const start = toMinutes(clockIn)
  const end = toMinutes(clockOut)
  if (start === null || end === null) return null
  return (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY
}

/** The shift ends on the following day. */
export function isOvernight(
  clockIn: string | null | undefined,
  clockOut: string | null | undefined,
): boolean {
  const start = toMinutes(clockIn)
  const end = toMinutes(clockOut)
  return start !== null && end !== null && end < start
}

/** 120 → "120 minutes", 1 → "1 minute". */
export function formatMinutes(minutes: number): string {
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

/** 480 → "8h", 65 → "1h 5m", 45 → "45m" (for compact summaries). */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}
