import type { FileRef } from '@/lib/files'

// The Custom Form module as the screens use it. The wire shapes are in `api/custom-forms.dto.ts`;
// `api/custom-forms.mappers.ts` converts between the two.

/** Draft (being built), Published (people can answer), Closed (no more answers). */
export const FORM_STATUSES = ['draft', 'published', 'closed'] as const
export type FormStatus = (typeof FORM_STATUSES)[number]

export const FIELD_TYPES = [
  'short_text',
  'long_text',
  'number',
  'date',
  'single_choice',
  'multiple_choice',
  'dropdown',
  'checkbox',
  'file',
  'rating',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

/** Field types answered by picking from the field's options. */
export const CHOICE_TYPES = ['single_choice', 'multiple_choice', 'dropdown'] as const
export type ChoiceType = (typeof CHOICE_TYPES)[number]

export const isChoiceType = (type: FieldType): type is ChoiceType =>
  (CHOICE_TYPES as readonly string[]).includes(type)

/** Who a form is for. */
export const AUDIENCE_KINDS = ['everyone', 'departments', 'branches', 'people'] as const
export type AudienceKind = (typeof AUDIENCE_KINDS)[number]

export interface NamedRef {
  id: string
  name: string
}

export interface FormAudience {
  kind: AudienceKind
  /** The departments, branches or people named (empty for everyone). */
  targets: NamedRef[]
}

export interface FieldOption {
  id: string
  label: string
}

/**
 * One question. `min` / `max` mean, by type: text — length in characters; number — the value;
 * multiple choice — how many picks; rating — `max` is the scale (3–10). Others ignore them.
 */
export interface FormFieldDef {
  id: string
  /** The section it sits in; `null` before the first section. */
  sectionId: string | null
  type: FieldType
  label: string
  helpText: string | null
  required: boolean
  options: FieldOption[]
  min: number | null
  max: number | null
}

export interface FormSection {
  id: string
  title: string
  description: string | null
}

/** What the fill form, the builder's preview and the response views render. */
export interface FormDefinition {
  title: string
  description: string | null
  anonymous: boolean
  /** In order. */
  sections: FormSection[]
  /** In order: the fields before the first section, then each section's. */
  fields: FormFieldDef[]
}

/** A row of the Forms list. */
export interface FormSummary {
  id: string
  title: string
  description: string | null
  category: string | null
  status: FormStatus
  /** `yyyy-MM-dd`: the last day people can answer. */
  closesOn: string | null
  audience: FormAudience
  fieldCount: number
  responseCount: number
  anonymous: boolean
  updatedAt: string
  publishedAt: string | null
  rowVersion: string
}

/** A whole form, as the builder edits it. */
export interface CustomForm extends FormDefinition {
  id: string
  category: string | null
  status: FormStatus
  closesOn: string | null
  audience: FormAudience
  oneResponsePerPerson: boolean
  responseCount: number
  createdBy: NamedRef | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  closedAt: string | null
  rowVersion: string
}

/** What the builder sends (create and edit). */
export interface FormInput {
  title: string
  description: string | null
  category: string | null
  closesOn: string | null
  audience: { kind: AudienceKind; ids: string[] }
  oneResponsePerPerson: boolean
  anonymous: boolean
  sections: SectionInput[]
  fields: FieldInput[]
}

export interface SectionInput {
  /** Unique in the request: the section's id when it has one, else a key made in the browser. */
  key: string
  id: string | null
  title: string
  description: string | null
}

export interface FieldInput {
  id: string | null
  /** The `key` of its section, or `null` before the first section. */
  sectionKey: string | null
  type: FieldType
  label: string
  helpText: string | null
  required: boolean
  options: { id: string | null; label: string }[]
  min: number | null
  max: number | null
}

/** A form the caller is asked to fill (My Forms). */
export interface AssignedForm {
  id: string
  title: string
  description: string | null
  category: string | null
  status: FormStatus
  closesOn: string | null
  fieldCount: number
  oneResponsePerPerson: boolean
  anonymous: boolean
  /** How many times the caller has answered it. */
  myResponseCount: number
  /** The caller's latest response to it. */
  lastResponseId: string | null
  lastSubmittedAt: string | null
  /** Open, and (when one response per person) not answered yet. */
  canRespond: boolean
}

/** An assigned form with its questions, for filling. */
export interface AssignedFormDetail extends AssignedForm, FormDefinition {}

/**
 * An answer's value, by type: text and date — a string (`yyyy-MM-dd` for dates); number and
 * rating — a number; single choice and dropdown — the option's id; multiple choice — option ids;
 * checkbox — a boolean; file — the upload's id. `null` when not answered.
 */
export type AnswerValue = string | number | boolean | string[] | null

export interface Answer {
  fieldId: string
  value: AnswerValue
  /** The uploaded file of a file field. */
  file: FileRef | null
}

/** What a submission sends per field. */
export interface AnswerInput {
  fieldId: string
  value: AnswerValue
}

export interface Respondent {
  id: string
  name: string
  code: string | null
  departmentName: string | null
}

export interface FormResponse {
  id: string
  formId: string
  /** `null` on an anonymous form. */
  respondent: Respondent | null
  submittedAt: string
  answers: Answer[]
}

/** One response with its form's questions (the view dialogs). */
export interface ResponseDetail extends FormResponse {
  form: FormDefinition & { id: string }
}

/** A row of the caller's own submissions. */
export interface MyResponse {
  id: string
  formId: string
  formTitle: string
  category: string | null
  anonymous: boolean
  submittedAt: string
}

/** Counts per answer of one choice-like field (choices, dropdown, checkbox, rating). */
export interface FieldSummary {
  fieldId: string
  /** Responses that answered the field. */
  answered: number
  /** Per option id, `true` / `false` (checkbox) or `1`…`n` (rating). */
  counts: { value: string; count: number }[]
}

export interface ResponseSummary {
  total: number
  fields: FieldSummary[]
}

/** A pending endpoint's answer: its data, or "the backend does not have it yet". */
export type Pending<T> = { available: true; data: T } | { available: false }

export interface FormListParams {
  q?: string | undefined
  status?: FormStatus | undefined
  page: number
  pageSize: number
}

export interface PageParams {
  q?: string | undefined
  page: number
  pageSize: number
}
