import { z } from 'zod'

export const NAME_MAX_LENGTH = 80
export const PREFIX_MAX_LENGTH = 12
export const DESCRIPTION_MAX_LENGTH = 500

/** Required display name, e.g. "Enter the branch name". */
export function nameSchema(entity: string) {
  return z
    .string()
    .trim()
    .min(1, `Enter the ${entity} name`)
    .max(NAME_MAX_LENGTH, `Use at most ${NAME_MAX_LENGTH} characters`)
}

/** Optional prefix for employee ids issued here, e.g. "LHR" → LHR-0001. */
export const employeePrefixSchema = z
  .string()
  .trim()
  .max(PREFIX_MAX_LENGTH, `Use at most ${PREFIX_MAX_LENGTH} characters`)
  .regex(/^[A-Za-z0-9-]*$/, 'Use letters, numbers and dashes only')

export const descriptionSchema = z
  .string()
  .max(DESCRIPTION_MAX_LENGTH, `Use at most ${DESCRIPTION_MAX_LENGTH} characters`)

/** Required id from a select. */
export function requiredIdSchema(message: string) {
  return z.string().min(1, message)
}

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/

/** Coordinate typed as text: empty, or a decimal within ±`limit`. */
function coordinateSchema(label: string, limit: number) {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === '' || (NUMBER_PATTERN.test(value) && Math.abs(Number(value)) <= limit),
      `${label} must be a number from -${limit} to ${limit}`,
    )
}

export const latitudeSchema = coordinateSchema('Latitude', 90)
export const longitudeSchema = coordinateSchema('Longitude', 180)

/** Text coordinates → number, or `null` when empty. */
export function toCoordinate(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

export function fromCoordinate(value: number | null): string {
  return value === null ? '' : String(value)
}

/** Latitude and longitude only make sense together. */
export function refineCoordinatePair(
  values: { latitude: string; longitude: string },
  ctx: z.RefinementCtx,
): void {
  const hasLatitude = values.latitude.trim() !== ''
  const hasLongitude = values.longitude.trim() !== ''
  if (hasLatitude && !hasLongitude) {
    ctx.addIssue({ code: 'custom', path: ['longitude'], message: 'Enter the longitude too' })
  }
  if (hasLongitude && !hasLatitude) {
    ctx.addIssue({ code: 'custom', path: ['latitude'], message: 'Enter the latitude too' })
  }
}

/** Empty select → `null` for optional references. */
export function toOptionalId(value: string): string | null {
  return value === '' ? null : value
}
