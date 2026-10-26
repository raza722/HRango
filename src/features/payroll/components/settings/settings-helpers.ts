import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { z } from 'zod'

import { ApiError } from '@/lib/api-error'

/** Open dialog: a new record, or one to edit or look at. */
export type DialogState<T> = { mode: 'create' } | { mode: 'edit' | 'view'; record: T } | null

/**
 * Puts an API error on the matching form fields; returns what is left to show
 * beside the buttons (or `null` when a field took it).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.'
  let placed = false
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    const target = fields.find((name) => name === field)
    if (target) {
      setError(target, { message })
      placed = true
    }
  }
  return placed ? null : error.message
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback

/** A required amount typed in a text box ("50,000"). */
export const amountText = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => Number.isFinite(Number(value.replace(/,/g, ''))), {
      message: 'Enter a number',
    })
    .refine((value) => Number(value.replace(/,/g, '')) >= 0, {
      message: 'The amount cannot be negative',
    })

/** An optional number typed in a text box. */
export const optionalNumberText = z
  .string()
  .trim()
  .refine((value) => value === '' || Number.isFinite(Number(value.replace(/,/g, ''))), {
    message: 'Enter a number',
  })

export const toAmount = (value: string) => Number(value.replace(/,/g, ''))
export const toOptionalNumber = (value: string) => (value.trim() === '' ? null : toAmount(value))
export const numberText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

/** Blank (or only spaces) becomes `null`, as the API stores it. */
export const orNull = (value: string | null | undefined) => {
  const text = value?.trim() ?? ''
  return text === '' ? null : text
}

export const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

/** A section heading inside a settings dialog (Conditions, Additional Information, Slabs): Poppins SemiBold 20 #202020. */
export const sectionHeading = 'text-lg font-semibold text-[#202020] sm:text-xl dark:text-heading'
