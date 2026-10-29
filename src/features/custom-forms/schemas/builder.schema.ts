import { z } from 'zod'

import { ApiError } from '@/lib/api-error'

import { LIMITS, RATING_DEFAULT_SCALE, RATING_MAX_SCALE, RATING_MIN_SCALE } from '../constants'
import {
  AUDIENCE_KINDS,
  type CustomForm,
  FIELD_TYPES,
  type FieldType,
  type FormDefinition,
  type FormFieldDef,
  type FormInput,
  isChoiceType,
} from '../types/custom-forms.types'
import { readNumber } from './answers.schema'

/*
 * The builder's form. Questions and section breaks are one ordered list (`items`), so up / down
 * and drag move either; a question belongs to the section break above it. Saving turns the list
 * into the API's `sections` and `fields`.
 */

export interface BuilderOption {
  /** Unique in the form (React key, preview id until saved). */
  key: string
  id: string | null
  label: string
  /** An option of a form with responses: it cannot be removed. */
  locked: boolean
}

export interface BuilderItem {
  key: string
  id: string | null
  kind: 'section' | 'field'
  /** Questions only (sections keep `short_text`). */
  type: FieldType
  /** The question, or the section's title. */
  label: string
  /** Help text, or the section's description. */
  helpText: string
  required: boolean
  options: BuilderOption[]
  /** As typed; see `FormFieldDef` for what they mean per type. */
  min: string
  max: string
  /** A question of a form with responses: its type stays and it cannot be removed. */
  locked: boolean
}

const optionSchema = z.object({
  key: z.string(),
  id: z.string().nullable(),
  label: z.string(),
  locked: z.boolean(),
})

const itemSchema = z.object({
  key: z.string(),
  id: z.string().nullable(),
  kind: z.enum(['section', 'field']),
  type: z.enum(FIELD_TYPES),
  label: z.string(),
  helpText: z.string(),
  required: z.boolean(),
  options: z.array(optionSchema),
  min: z.string(),
  max: z.string(),
  locked: z.boolean(),
})

const max = (limit: number, what: string) =>
  z
    .string()
    .trim()
    .max(limit, `${what} may be at most ${String(limit)} characters.`)

/** Whole numbers for lengths, picks and scales; any number for a number question's limits. */
function readLimit(text: string, integer: boolean): number | null | 'invalid' {
  const value = readNumber(text)
  if (typeof value === 'number' && integer && !Number.isInteger(value)) return 'invalid'
  return value
}

const usesMinMax = (type: FieldType) =>
  type === 'short_text' || type === 'long_text' || type === 'number' || type === 'multiple_choice'

export const builderSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Give the form a title.')
      .max(LIMITS.title, `Keep the title to ${String(LIMITS.title)} characters.`),
    description: max(LIMITS.description, 'The description'),
    category: max(LIMITS.category, 'The category'),
    closesOn: z.string(),
    audienceKind: z.enum(AUDIENCE_KINDS),
    departmentIds: z.array(z.string()),
    branchIds: z.array(z.string()),
    employeeIds: z.array(z.string()),
    oneResponsePerPerson: z.boolean(),
    anonymous: z.boolean(),
    items: z.array(itemSchema).max(LIMITS.fields + 30),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    if (values.audienceKind === 'departments' && values.departmentIds.length === 0) {
      issue(['departmentIds'], 'Choose at least one department.')
    }
    if (values.audienceKind === 'branches' && values.branchIds.length === 0) {
      issue(['branchIds'], 'Choose at least one branch.')
    }
    if (values.audienceKind === 'people' && values.employeeIds.length === 0) {
      issue(['employeeIds'], 'Choose at least one person.')
    }
    const fieldCount = values.items.filter((item) => item.kind === 'field').length
    if (fieldCount > LIMITS.fields) {
      issue(['items'], `A form takes at most ${String(LIMITS.fields)} questions.`)
    }
    values.items.forEach((item, index) => {
      const at = (name: string) => ['items', index, name]
      const label = item.label.trim()
      if (item.kind === 'section') {
        if (!label) issue(at('label'), 'Give the section a title.')
        else if (label.length > LIMITS.sectionTitle) issue(at('label'), 'Keep the title shorter.')
        return
      }
      if (!label) issue(at('label'), 'Enter the question.')
      else if (label.length > LIMITS.label) {
        issue(at('label'), `Keep the question to ${String(LIMITS.label)} characters.`)
      }
      if (item.helpText.trim().length > LIMITS.helpText) {
        issue(at('helpText'), `Keep the help text to ${String(LIMITS.helpText)} characters.`)
      }
      if (isChoiceType(item.type)) {
        const labels = item.options.map((option) => option.label.trim().toLowerCase())
        if (item.options.length < 2) issue(at('options'), 'Add at least two options.')
        else if (labels.some((text) => text === '')) issue(at('options'), 'Fill in every option.')
        else if (new Set(labels).size !== labels.length)
          issue(at('options'), 'Each option must differ.')
        else if (item.options.length > LIMITS.options) {
          issue(at('options'), `At most ${String(LIMITS.options)} options.`)
        }
      }
      if (item.type === 'rating') {
        const scale = readLimit(item.max, true)
        if (typeof scale !== 'number' || scale < RATING_MIN_SCALE || scale > RATING_MAX_SCALE) {
          issue(at('max'), `Use ${String(RATING_MIN_SCALE)} to ${String(RATING_MAX_SCALE)}.`)
        }
      }
      if (!usesMinMax(item.type)) return
      const integer = item.type !== 'number'
      const low = readLimit(item.min, integer)
      const high = readLimit(item.max, integer)
      const whole = integer ? 'Use a whole number.' : 'Use a number.'
      if (low === 'invalid') issue(at('min'), whole)
      else if (integer && low !== null && low < 0) issue(at('min'), 'Use 0 or more.')
      if (high === 'invalid') issue(at('max'), whole)
      else if (integer && high !== null && high < 1) issue(at('max'), 'Use 1 or more.')
      else if (typeof low === 'number' && typeof high === 'number' && low > high) {
        issue(at('max'), 'The max must not be below the min.')
      } else if (
        item.type === 'multiple_choice' &&
        typeof high === 'number' &&
        high > item.options.length
      ) {
        issue(at('max'), 'More picks than options.')
      }
    })
  })

export type BuilderValues = z.infer<typeof builderSchema>

/** A key for a new item or option. */
export const newKey = () => `k${Math.random().toString(36).slice(2, 10)}`

const newOption = (label: string): BuilderOption => ({
  key: newKey(),
  id: null,
  label,
  locked: false,
})

/** A new question of a type (choice types start with two options, ratings with five stars). */
export function newField(type: FieldType): BuilderItem {
  return {
    key: newKey(),
    id: null,
    kind: 'field',
    type,
    label: '',
    helpText: '',
    required: false,
    // Empty, with "Option 1" as the placeholder: a label left blank is refused, not saved.
    options: isChoiceType(type) ? [newOption(''), newOption('')] : [],
    min: '',
    max: type === 'rating' ? String(RATING_DEFAULT_SCALE) : '',
    locked: false,
  }
}

export function newSection(): BuilderItem {
  return { ...newField('short_text'), kind: 'section' }
}

/** A question turned into another type: choices keep their options; limits start again. */
export function withType(item: BuilderItem, type: FieldType): BuilderItem {
  if (item.type === type) return item
  const keepOptions = isChoiceType(item.type) && isChoiceType(type)
  return {
    ...item,
    type,
    options: keepOptions ? item.options : isChoiceType(type) ? newField(type).options : [],
    min: '',
    max: type === 'rating' ? String(RATING_DEFAULT_SCALE) : '',
  }
}

/** A copy of a question or section, as new. */
export function copyOf(item: BuilderItem): BuilderItem {
  return {
    ...item,
    key: newKey(),
    id: null,
    locked: false,
    label: item.label ? `${item.label} (copy)`.slice(0, LIMITS.label) : '',
    options: item.options.map((option) => ({ ...option, key: newKey(), id: null, locked: false })),
  }
}

export const emptyBuilder = (): BuilderValues => ({
  title: '',
  description: '',
  category: '',
  closesOn: '',
  audienceKind: 'everyone',
  departmentIds: [],
  branchIds: [],
  employeeIds: [],
  oneResponsePerPerson: true,
  anonymous: false,
  items: [],
})

const text = (value: number | null) => (value === null ? '' : String(value))

/** A saved form as the builder edits it. Once it has responses its questions are locked. */
export function formToBuilder(form: CustomForm): BuilderValues {
  const locked = form.responseCount > 0
  const fieldItem = (field: FormFieldDef): BuilderItem => ({
    key: field.id,
    id: field.id,
    kind: 'field',
    type: field.type,
    label: field.label,
    helpText: field.helpText ?? '',
    required: field.required,
    options: field.options.map((option) => ({
      key: option.id,
      id: option.id,
      label: option.label,
      locked,
    })),
    min: text(field.min),
    max: text(field.max),
    locked,
  })
  const items: BuilderItem[] = form.fields
    .filter((field) => field.sectionId === null)
    .map(fieldItem)
  for (const section of form.sections) {
    items.push({
      ...newSection(),
      key: section.id,
      id: section.id,
      label: section.title,
      helpText: section.description ?? '',
    })
    items.push(...form.fields.filter((field) => field.sectionId === section.id).map(fieldItem))
  }
  const ids = form.audience.targets.map((target) => target.id)
  return {
    title: form.title,
    description: form.description ?? '',
    category: form.category ?? '',
    closesOn: form.closesOn ?? '',
    audienceKind: form.audience.kind,
    departmentIds: form.audience.kind === 'departments' ? ids : [],
    branchIds: form.audience.kind === 'branches' ? ids : [],
    employeeIds: form.audience.kind === 'people' ? ids : [],
    oneResponsePerPerson: form.oneResponsePerPerson,
    anonymous: form.anonymous,
    items,
  }
}

const orNull = (value: string) => value.trim() || null
const limitOf = (value: string) => {
  const number = readNumber(value)
  return typeof number === 'number' ? number : null
}

/** A question of the builder as the fill form renders it (also before it is saved). */
function fieldDef(item: BuilderItem, sectionId: string | null): FormFieldDef {
  const choice = isChoiceType(item.type)
  return {
    id: item.id ?? item.key,
    sectionId,
    type: item.type,
    label: item.label.trim(),
    helpText: orNull(item.helpText),
    required: item.required,
    options: choice
      ? item.options.map((option) => ({ id: option.id ?? option.key, label: option.label.trim() }))
      : [],
    min: usesMinMax(item.type) ? limitOf(item.min) : null,
    max: usesMinMax(item.type) || item.type === 'rating' ? limitOf(item.max) : null,
  }
}

/** The builder's values as the live preview renders them. */
export function builderToDefinition(
  values: Pick<BuilderValues, 'title' | 'description' | 'anonymous' | 'items'>,
): FormDefinition {
  const sections: FormDefinition['sections'] = []
  const fields: FormFieldDef[] = []
  let sectionId: string | null = null
  for (const item of values.items) {
    if (item.kind === 'section') {
      sectionId = item.id ?? item.key
      sections.push({ id: sectionId, title: item.label.trim(), description: orNull(item.helpText) })
    } else {
      fields.push(fieldDef(item, sectionId))
    }
  }
  return {
    title: values.title.trim(),
    description: orNull(values.description),
    anonymous: values.anonymous,
    sections,
    fields,
  }
}

/** The builder's values as the API takes them. */
export function builderToInput(values: BuilderValues): FormInput {
  let sectionKey: string | null = null
  const input: FormInput = {
    title: values.title.trim(),
    description: orNull(values.description),
    category: orNull(values.category),
    closesOn: values.closesOn || null,
    audience: {
      kind: values.audienceKind,
      ids:
        values.audienceKind === 'departments'
          ? values.departmentIds
          : values.audienceKind === 'branches'
            ? values.branchIds
            : values.audienceKind === 'people'
              ? values.employeeIds
              : [],
    },
    oneResponsePerPerson: values.oneResponsePerPerson,
    anonymous: values.anonymous,
    sections: [],
    fields: [],
  }
  for (const item of values.items) {
    if (item.kind === 'section') {
      sectionKey = item.id ?? item.key
      input.sections.push({
        key: sectionKey,
        id: item.id,
        title: item.label.trim(),
        description: orNull(item.helpText),
      })
      continue
    }
    const def = fieldDef(item, null)
    input.fields.push({
      id: item.id,
      sectionKey,
      type: def.type,
      label: def.label,
      helpText: def.helpText,
      required: def.required,
      options: isChoiceType(item.type)
        ? item.options.map((option) => ({ id: option.id, label: option.label.trim() }))
        : [],
      min: def.min,
      max: def.max,
    })
  }
  return input
}

/** Builder names for the API's field paths (`fields.2.label` → `items.5.label`). */
const TOP_LEVEL: Record<string, string> = {
  title: 'title',
  description: 'description',
  category: 'category',
  closesOn: 'closesOn',
  anonymous: 'anonymous',
  oneResponsePerPerson: 'oneResponsePerPerson',
  'audience.kind': 'audienceKind',
}

function builderPath(apiPath: string, values: BuilderValues): string | undefined {
  if (apiPath in TOP_LEVEL) return TOP_LEVEL[apiPath]
  if (apiPath === 'audience.ids') {
    return values.audienceKind === 'departments'
      ? 'departmentIds'
      : values.audienceKind === 'branches'
        ? 'branchIds'
        : 'employeeIds'
  }
  if (apiPath === 'fields') return 'items'
  const match = /^(fields|sections)\.(\d+)(?:\.(\w+))?/.exec(apiPath)
  if (!match) return undefined
  const kind = match[1] === 'fields' ? 'field' : 'section'
  const wanted = Number(match[2])
  const name = match[3] === 'title' ? 'label' : match[3] === 'description' ? 'helpText' : match[3]
  let seen = -1
  const index = values.items.findIndex((item) => item.kind === kind && ++seen === wanted)
  if (index === -1) return undefined
  const known = ['label', 'helpText', 'options', 'min', 'max', 'type']
  return `items.${String(index)}.${name && known.includes(name) ? name : 'label'}`
}

/**
 * A failed save's field errors as builder paths and messages; what names no builder field
 * (or an error without fields) comes back as `root`.
 */
export function builderErrors(
  error: unknown,
  values: BuilderValues,
): { fields: { name: string; message: string }[]; root: string | null } {
  if (!(error instanceof ApiError)) {
    return { fields: [], root: 'Something went wrong. Please try again.' }
  }
  const fields: { name: string; message: string }[] = []
  for (const [apiPath, message] of Object.entries(error.fieldErrors)) {
    const name = builderPath(apiPath, values)
    if (name) fields.push({ name, message })
  }
  return { fields, root: fields.length > 0 ? null : error.message }
}
