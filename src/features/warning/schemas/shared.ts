import { z } from 'zod'

import { WEEKDAYS } from '../types/warning-policy.types'

export const weekdaySchema = z.enum(WEEKDAYS)

/** "Title of Warning Policy" (the API takes up to 200 characters). */
export const titleField = z
  .string()
  .trim()
  .min(2, 'Enter at least 2 characters')
  .max(200, 'Keep the title under 200 characters')

/** Whole number typed into a text box, kept as a string while editing. */
export const wholeNumberField = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d{1,6}$/, `${label} must be a whole number`)
    .refine((value) => Number(value) >= min && Number(value) <= max, {
      message: `${label} must be between ${min} and ${max}`,
    })

/** Optional whole number: an empty box means "not set". */
export const optionalWholeNumberField = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{1,6}$/.test(value), {
      message: `${label} must be a whole number`,
    })
    .refine((value) => value === '' || (Number(value) >= min && Number(value) <= max), {
      message: `${label} must be between ${min} and ${max}`,
    })
