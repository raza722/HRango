import { z } from 'zod'

import type { FileRef } from '@/lib/files'

import { LIMITS, RATING_DEFAULT_SCALE } from '../constants'
import type { AnswerInput, FormFieldDef } from '../types/custom-forms.types'

/*
 * The fill form's validation, made from the form's own field definitions: one zod schema per
 * question (its type, required, options and min / max), put together into one object schema.
 * The same schema drives the builder's live preview and My Forms, so what HR builds is exactly
 * what people fill.
 */

/** What the fill form holds per question, by type. */
export type AnswerFormValue = string | string[] | boolean | number | FileRef | null

/** The fill form's values: one entry per question, under `answerKey(field.id)`. */
export type AnswerValues = Record<string, unknown>

/**
 * The form-state name of a question. Prefixed and without dots, so an id like `12` or `a.b` is
 * never read as an array index or a nested path.
 */
export const answerKey = (fieldId: string) => `q_${fieldId.replace(/[^A-Za-z0-9_-]/g, '_')}`

const REQUIRED = 'This question needs an answer.'

const asText = (value: unknown) => (typeof value === 'string' ? value : '')
const asList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const isFile = (value: unknown): value is FileRef =>
  typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'

/** "Enter a number." for "abc"; the number for "12.5"; `null` for blank. */
export function readNumber(text: string): number | null | 'invalid' {
  const trimmed = text.trim().replace(/,/g, '')
  if (trimmed === '') return null
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : 'invalid'
}

const plural = (count: number, noun: string) => `${String(count)} ${noun}${count === 1 ? '' : 's'}`

/** The zod schema of one question's answer. */
export function answerSchema(field: FormFieldDef): z.ZodType {
  const { required, min, max, options } = field
  switch (field.type) {
    case 'short_text':
    case 'long_text':
      return z.unknown().superRefine((raw, ctx) => {
        const text = asText(raw).trim()
        if (text === '') {
          if (required) ctx.addIssue({ code: 'custom', message: REQUIRED })
          return
        }
        if (min !== null && text.length < min) {
          ctx.addIssue({ code: 'custom', message: `Enter at least ${plural(min, 'character')}.` })
        } else if (text.length > (max ?? LIMITS.text)) {
          ctx.addIssue({
            code: 'custom',
            message: `Keep it to ${plural(max ?? LIMITS.text, 'character')}.`,
          })
        }
      })
    case 'number':
      return z.unknown().superRefine((raw, ctx) => {
        const number = readNumber(asText(raw))
        if (number === null) {
          if (required) ctx.addIssue({ code: 'custom', message: REQUIRED })
        } else if (number === 'invalid') {
          ctx.addIssue({ code: 'custom', message: 'Enter a number.' })
        } else if (min !== null && number < min) {
          ctx.addIssue({ code: 'custom', message: `Enter ${String(min)} or more.` })
        } else if (max !== null && number > max) {
          ctx.addIssue({ code: 'custom', message: `Enter ${String(max)} or less.` })
        }
      })
    case 'date':
      return z.unknown().superRefine((raw, ctx) => {
        const value = asText(raw)
        if (value === '') {
          if (required) ctx.addIssue({ code: 'custom', message: REQUIRED })
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          ctx.addIssue({ code: 'custom', message: 'Pick a date.' })
        }
      })
    case 'single_choice':
    case 'dropdown':
      return z.unknown().superRefine((raw, ctx) => {
        const value = asText(raw)
        if (value === '') {
          if (required) ctx.addIssue({ code: 'custom', message: 'Choose one of the options.' })
        } else if (!options.some((option) => option.id === value)) {
          ctx.addIssue({ code: 'custom', message: 'Choose one of the options.' })
        }
      })
    case 'multiple_choice':
      return z.unknown().superRefine((raw, ctx) => {
        const picked = asList(raw).filter((id) => options.some((option) => option.id === id))
        if (picked.length === 0) {
          if (required) ctx.addIssue({ code: 'custom', message: 'Choose at least one option.' })
          return
        }
        if (min !== null && picked.length < min) {
          ctx.addIssue({ code: 'custom', message: `Choose at least ${plural(min, 'option')}.` })
        } else if (max !== null && picked.length > max) {
          ctx.addIssue({ code: 'custom', message: `Choose at most ${plural(max, 'option')}.` })
        }
      })
    case 'checkbox':
      return z.unknown().superRefine((raw, ctx) => {
        if (required && raw !== true)
          ctx.addIssue({ code: 'custom', message: 'Tick this to go on.' })
      })
    case 'file':
      return z.unknown().superRefine((raw, ctx) => {
        if (required && !isFile(raw)) ctx.addIssue({ code: 'custom', message: 'Attach a file.' })
      })
    case 'rating':
      return z.unknown().superRefine((raw, ctx) => {
        const scale = max ?? RATING_DEFAULT_SCALE
        const value = typeof raw === 'number' ? raw : 0
        if (value === 0) {
          if (required) ctx.addIssue({ code: 'custom', message: 'Choose a rating.' })
        } else if (!Number.isInteger(value) || value < 1 || value > scale) {
          ctx.addIssue({ code: 'custom', message: `Choose 1 to ${String(scale)}.` })
        }
      })
  }
}

/** The whole fill form's schema: one entry per question. */
export function buildAnswersSchema(fields: readonly FormFieldDef[]) {
  return z.object(
    Object.fromEntries(fields.map((field) => [answerKey(field.id), answerSchema(field)])),
  )
}

/** An empty answer of the question's type. */
export function emptyAnswer(field: FormFieldDef): AnswerFormValue {
  switch (field.type) {
    case 'multiple_choice':
      return []
    case 'checkbox':
      return false
    case 'rating':
      return 0
    case 'file':
      return null
    default:
      return ''
  }
}

export const emptyAnswers = (fields: readonly FormFieldDef[]): AnswerValues =>
  Object.fromEntries(fields.map((field) => [answerKey(field.id), emptyAnswer(field)]))

/** The fill form's values as the API takes them (`null` for anything left blank). */
export function toAnswerInputs(
  fields: readonly FormFieldDef[],
  values: AnswerValues,
): AnswerInput[] {
  return fields.map((field) => {
    const raw = values[answerKey(field.id)]
    switch (field.type) {
      case 'short_text':
      case 'long_text':
      case 'date':
      case 'single_choice':
      case 'dropdown':
        return { fieldId: field.id, value: asText(raw).trim() || null }
      case 'number': {
        const number = readNumber(asText(raw))
        return { fieldId: field.id, value: typeof number === 'number' ? number : null }
      }
      case 'multiple_choice': {
        const picked = asList(raw)
        // In the options' order, whatever order they were ticked in.
        const ordered = field.options.map((option) => option.id).filter((id) => picked.includes(id))
        return { fieldId: field.id, value: ordered.length > 0 ? ordered : null }
      }
      case 'checkbox':
        return { fieldId: field.id, value: raw === true }
      case 'file':
        return { fieldId: field.id, value: isFile(raw) ? raw.id : null }
      case 'rating':
        return { fieldId: field.id, value: typeof raw === 'number' && raw > 0 ? raw : null }
    }
  })
}

/** Where an API field error (`answers.<fieldId>`) goes in the fill form, if anywhere. */
export function answerErrorKey(
  apiField: string,
  fields: readonly FormFieldDef[],
): string | undefined {
  const match = /^answers\.(.+)$/.exec(apiField)
  if (!match) return undefined
  const field = fields.find((item) => item.id === match[1])
  return field ? answerKey(field.id) : undefined
}
