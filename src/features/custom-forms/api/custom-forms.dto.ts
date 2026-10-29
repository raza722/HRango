// The wire shapes of `/api/forms…` (Custom Form). The backend has no such endpoints yet
// (docs/backend-dependencies.md, "Custom Form"): these are the shapes the screens are built
// against, following the API's conventions — JSON bodies, string ids in responses and integer
// ids in requests (`ApiId`), `{ data }` for one record and `{ data, meta }` for a page,
// `rowVersion` on every edit, errors as `{ message, code?, fieldErrors? }`. The development
// mock (src/mocks/custom-forms) answers with the same shapes.

import type { FileRef } from '@/lib/files'

import type { AudienceKind, FieldType, FormStatus } from '../types/custom-forms.types'

/** An id in a request: an integer on the real API (the mock's ids are strings). */
export type ApiId = number | string

export interface NamedRefDto {
  id: string
  name: string
}

export interface AudienceDto {
  kind: AudienceKind
  /** Departments, branches or employees with their names; `[]` for everyone. */
  targets: NamedRefDto[]
}

export interface FieldOptionDto {
  id: string
  label: string
}

export interface FormSectionDto {
  id: string
  title: string
  description: string | null
  /** 0-based order. */
  position: number
}

export interface FormFieldDto {
  id: string
  sectionId: string | null
  /** 0-based order inside its section (or before the first section). */
  position: number
  type: FieldType
  label: string
  helpText: string | null
  required: boolean
  /** Choice types only; `[]` otherwise. */
  options: FieldOptionDto[]
  min: number | null
  max: number | null
}

/** `GET /forms` row. */
export interface FormSummaryDto {
  id: string
  title: string
  description: string | null
  category: string | null
  status: FormStatus
  closesOn: string | null
  audience: AudienceDto
  fieldCount: number
  responseCount: number
  anonymous: boolean
  updatedAt: string
  publishedAt: string | null
  rowVersion: string
}

/** `GET /forms/{id}` and every write's answer. */
export interface FormDto {
  id: string
  title: string
  description: string | null
  category: string | null
  status: FormStatus
  closesOn: string | null
  audience: AudienceDto
  oneResponsePerPerson: boolean
  anonymous: boolean
  sections: FormSectionDto[]
  fields: FormFieldDto[]
  responseCount: number
  createdBy: NamedRefDto | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  closedAt: string | null
  rowVersion: string
}

/** `POST /forms` and `PUT /forms/{id}` (with `rowVersion`). */
export interface FormInDto {
  title: string
  description: string | null
  category: string | null
  closesOn: string | null
  audience: { kind: AudienceKind; ids: ApiId[] }
  oneResponsePerPerson: boolean
  anonymous: boolean
  /** In order. `key` is unique in the request: the id when the section has one, else any text. */
  sections: { key: string; id: ApiId | null; title: string; description: string | null }[]
  /** In order. A field with `id` keeps its answers; one without is new. */
  fields: {
    id: ApiId | null
    sectionKey: string | null
    type: FieldType
    label: string
    helpText: string | null
    required: boolean
    options: { id: ApiId | null; label: string }[]
    min: number | null
    max: number | null
  }[]
  /** Edits only. */
  rowVersion?: string
}

/** `POST /forms/{id}/publish` and `/close`; `DELETE /forms/{id}?rowVersion=`. */
export interface RowVersionInDto {
  rowVersion: string
}

/** `GET /forms/assigned` row. */
export interface AssignedFormDto {
  id: string
  title: string
  description: string | null
  category: string | null
  status: FormStatus
  closesOn: string | null
  fieldCount: number
  oneResponsePerPerson: boolean
  anonymous: boolean
  myResponseCount: number
  /** The caller's latest response to it. */
  lastResponseId: string | null
  lastSubmittedAt: string | null
  canRespond: boolean
}

/** `GET /forms/assigned/{id}`: the row plus the questions. */
export interface AssignedFormDetailDto extends AssignedFormDto {
  sections: FormSectionDto[]
  fields: FormFieldDto[]
}

/**
 * One answer. `value` by field type: text / date → string (`yyyy-MM-dd`); number / rating →
 * number; single choice / dropdown → option id; multiple choice → option ids; checkbox →
 * boolean; file → the upload's id (`POST /files` first). In requests the ids are integers.
 */
export interface AnswerDto {
  fieldId: string
  value: string | number | boolean | string[] | null
  /** File fields: the stored file with a signed link. */
  file: FileRef | null
}

/** `POST /forms/{id}/responses`. */
export interface ResponseInDto {
  answers: { fieldId: ApiId; value: string | number | boolean | ApiId[] | null }[]
}

export interface RespondentDto {
  id: string
  name: string
  code: string | null
  departmentName: string | null
}

/** `GET /forms/{id}/responses` row and `POST /forms/{id}/responses`' answer. */
export interface ResponseDto {
  id: string
  formId: string
  /** `null` when the form is anonymous. */
  respondent: RespondentDto | null
  submittedAt: string
  answers: AnswerDto[]
}

/** `GET /forms/responses/{id}`: the response with its form's questions. */
export interface ResponseDetailDto extends ResponseDto {
  form: {
    id: string
    title: string
    description: string | null
    anonymous: boolean
    sections: FormSectionDto[]
    fields: FormFieldDto[]
  }
}

/** `GET /forms/my-responses` row. */
export interface MyResponseDto {
  id: string
  formId: string
  formTitle: string
  category: string | null
  anonymous: boolean
  submittedAt: string
}

/** `GET /forms/{id}/responses/summary`. */
export interface ResponseSummaryDto {
  total: number
  fields: { fieldId: string; answered: number; counts: { value: string; count: number }[] }[]
}
