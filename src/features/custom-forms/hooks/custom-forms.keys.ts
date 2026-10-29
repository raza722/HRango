import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { customFormsApi } from '../api/custom-forms.api'
import type { FormListParams, PageParams } from '../types/custom-forms.types'

/** Query values without the unset ones, so keys stay short and stable. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

/** Every Custom Form query sits under `all`, so a change refreshes the whole module. */
export const customFormKeys = {
  all: ['custom-forms'] as const,
  forms: () => [...customFormKeys.all, 'forms'] as const,
  formList: (params: FormListParams) =>
    [...customFormKeys.forms(), 'list', compact(params)] as const,
  form: (id: string) => [...customFormKeys.forms(), 'detail', id] as const,
  assigned: (params: PageParams) => [...customFormKeys.all, 'assigned', compact(params)] as const,
  assignedForm: (id: string) => [...customFormKeys.all, 'assigned-form', id] as const,
  myResponses: (params: PageParams) =>
    [...customFormKeys.all, 'my-responses', compact(params)] as const,
  responses: (formId: string, params: PageParams) =>
    [...customFormKeys.all, 'responses', formId, compact(params)] as const,
  summary: (formId: string) => [...customFormKeys.all, 'summary', formId] as const,
  response: (id: string) => [...customFormKeys.all, 'response', id] as const,
}

export const formListQueryOptions = (params: FormListParams) =>
  queryOptions({
    queryKey: customFormKeys.formList(params),
    queryFn: ({ signal }) => customFormsApi.listForms(params, signal),
    placeholderData: keepPreviousData,
  })

export const formQueryOptions = (id: string) =>
  queryOptions({
    queryKey: customFormKeys.form(id),
    queryFn: ({ signal }) => customFormsApi.getForm(id, signal),
  })

export const assignedFormsQueryOptions = (params: PageParams) =>
  queryOptions({
    queryKey: customFormKeys.assigned(params),
    queryFn: ({ signal }) => customFormsApi.assignedForms(params, signal),
    placeholderData: keepPreviousData,
  })

export const assignedFormQueryOptions = (id: string) =>
  queryOptions({
    queryKey: customFormKeys.assignedForm(id),
    queryFn: ({ signal }) => customFormsApi.assignedForm(id, signal),
  })

export const myResponsesQueryOptions = (params: PageParams) =>
  queryOptions({
    queryKey: customFormKeys.myResponses(params),
    queryFn: ({ signal }) => customFormsApi.myResponses(params, signal),
    placeholderData: keepPreviousData,
  })

export const responsesQueryOptions = (formId: string, params: PageParams) =>
  queryOptions({
    queryKey: customFormKeys.responses(formId, params),
    queryFn: ({ signal }) => customFormsApi.listResponses(formId, params, signal),
    // The last page stays up while the next one loads, but never another form's answers.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === formId ? previous : undefined,
  })

export const summaryQueryOptions = (formId: string) =>
  queryOptions({
    queryKey: customFormKeys.summary(formId),
    queryFn: ({ signal }) => customFormsApi.responseSummary(formId, signal),
  })

export const responseQueryOptions = (id: string) =>
  queryOptions({
    queryKey: customFormKeys.response(id),
    queryFn: ({ signal }) => customFormsApi.getResponse(id, signal),
  })
