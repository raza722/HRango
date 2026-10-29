import type {
  AnswerInput,
  AssignedForm,
  AssignedFormDetail,
  CustomForm,
  FormFieldDef,
  FormInput,
  FormResponse,
  FormSection,
  FormSummary,
  MyResponse,
  ResponseDetail,
  ResponseSummary,
} from '../types/custom-forms.types'
import type {
  ApiId,
  AssignedFormDetailDto,
  AssignedFormDto,
  FormDto,
  FormFieldDto,
  FormInDto,
  FormSectionDto,
  FormSummaryDto,
  MyResponseDto,
  ResponseDetailDto,
  ResponseDto,
  ResponseInDto,
  ResponseSummaryDto,
} from './custom-forms.dto'

/** An id for a request: digits become the integer the API expects; the mock's ids stay text. */
export const toApiId = (id: string): ApiId => (/^\d+$/.test(id) ? Number(id) : id)

const sectionsFromApi = (sections: readonly FormSectionDto[]): FormSection[] =>
  sections
    .toSorted((a, b) => a.position - b.position)
    .map(({ id, title, description }) => ({ id, title, description }))

/** Fields in reading order: those before the first section, then each section's in turn. */
function fieldsFromApi(
  fields: readonly FormFieldDto[],
  sections: readonly FormSection[],
): FormFieldDef[] {
  const order = new Map<string | null, number>([[null, -1]])
  sections.forEach((section, index) => order.set(section.id, index))
  return fields
    .toSorted(
      (a, b) =>
        (order.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER) || a.position - b.position,
    )
    .map((dto) => ({
      id: dto.id,
      // A field naming a section the form does not have is shown before the sections.
      sectionId: dto.sectionId !== null && order.has(dto.sectionId) ? dto.sectionId : null,
      type: dto.type,
      label: dto.label,
      helpText: dto.helpText,
      required: dto.required,
      options: dto.options.map((option) => ({ id: option.id, label: option.label })),
      min: dto.min,
      max: dto.max,
    }))
}

function definitionFromApi(dto: {
  sections: readonly FormSectionDto[]
  fields: readonly FormFieldDto[]
}) {
  const sections = sectionsFromApi(dto.sections)
  return { sections, fields: fieldsFromApi(dto.fields, sections) }
}

export const formSummaryFromApi = (dto: FormSummaryDto): FormSummary => ({ ...dto })

export const formFromApi = (dto: FormDto): CustomForm => ({
  ...dto,
  ...definitionFromApi(dto),
})

export function formToApi(input: FormInput, rowVersion?: string): FormInDto {
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    closesOn: input.closesOn,
    audience: { kind: input.audience.kind, ids: input.audience.ids.map(toApiId) },
    oneResponsePerPerson: input.oneResponsePerPerson,
    anonymous: input.anonymous,
    sections: input.sections.map((section) => ({
      key: section.key,
      id: section.id === null ? null : toApiId(section.id),
      title: section.title,
      description: section.description,
    })),
    fields: input.fields.map((field) => ({
      id: field.id === null ? null : toApiId(field.id),
      sectionKey: field.sectionKey,
      type: field.type,
      label: field.label,
      helpText: field.helpText,
      required: field.required,
      options: field.options.map((option) => ({
        id: option.id === null ? null : toApiId(option.id),
        label: option.label,
      })),
      min: field.min,
      max: field.max,
    })),
    ...(rowVersion === undefined ? {} : { rowVersion }),
  }
}

export const assignedFromApi = (dto: AssignedFormDto): AssignedForm => ({
  id: dto.id,
  title: dto.title,
  description: dto.description,
  category: dto.category,
  status: dto.status,
  closesOn: dto.closesOn,
  fieldCount: dto.fieldCount,
  oneResponsePerPerson: dto.oneResponsePerPerson,
  anonymous: dto.anonymous,
  myResponseCount: dto.myResponseCount,
  lastResponseId: dto.lastResponseId,
  lastSubmittedAt: dto.lastSubmittedAt,
  canRespond: dto.canRespond,
})

export const assignedDetailFromApi = (dto: AssignedFormDetailDto): AssignedFormDetail => ({
  ...assignedFromApi(dto),
  ...definitionFromApi(dto),
})

export const responseFromApi = (dto: ResponseDto): FormResponse => ({
  id: dto.id,
  formId: dto.formId,
  respondent: dto.respondent,
  submittedAt: dto.submittedAt,
  answers: dto.answers.map((answer) => ({
    fieldId: answer.fieldId,
    value: answer.value,
    file: answer.file,
  })),
})

export const responseDetailFromApi = (dto: ResponseDetailDto): ResponseDetail => ({
  ...responseFromApi(dto),
  form: {
    id: dto.form.id,
    title: dto.form.title,
    description: dto.form.description,
    anonymous: dto.form.anonymous,
    ...definitionFromApi(dto.form),
  },
})

export const myResponseFromApi = (dto: MyResponseDto): MyResponse => ({ ...dto })

export const summaryFromApi = (dto: ResponseSummaryDto): ResponseSummary => ({
  total: dto.total,
  fields: dto.fields.map((field) => ({
    fieldId: field.fieldId,
    answered: field.answered,
    counts: field.counts.map((count) => ({ value: count.value, count: count.count })),
  })),
})

/** Field types whose answer is an id (an option or an upload). */
const ID_ANSWERS = new Set<FormFieldDef['type']>(['single_choice', 'dropdown', 'file'])

/** Answers as the API takes them: field, option and file ids as integers where they are. */
export function answersToApi(
  answers: readonly AnswerInput[],
  fields: readonly FormFieldDef[],
): ResponseInDto {
  const typeOf = new Map(fields.map((field) => [field.id, field.type]))
  return {
    answers: answers.map(({ fieldId, value }) => {
      const type = typeOf.get(fieldId)
      return {
        fieldId: toApiId(fieldId),
        value: Array.isArray(value)
          ? value.map(toApiId)
          : typeof value === 'string' && type !== undefined && ID_ANSWERS.has(type)
            ? toApiId(value)
            : value,
      }
    }),
  }
}
