import { ApiError } from '@/lib/api-error'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AnswerInput,
  AssignedForm,
  AssignedFormDetail,
  CustomForm,
  FormDefinition,
  FormInput,
  FormListParams,
  FormResponse,
  FormSummary,
  MyResponse,
  PageParams,
  Pending,
  ResponseDetail,
  ResponseSummary,
} from '../types/custom-forms.types'
import type {
  AssignedFormDetailDto,
  AssignedFormDto,
  FormDto,
  FormSummaryDto,
  MyResponseDto,
  ResponseDetailDto,
  ResponseDto,
  ResponseSummaryDto,
  RowVersionInDto,
} from './custom-forms.dto'
import {
  answersToApi,
  assignedDetailFromApi,
  assignedFromApi,
  formFromApi,
  formSummaryFromApi,
  formToApi,
  myResponseFromApi,
  responseDetailFromApi,
  responseFromApi,
  summaryFromApi,
} from './custom-forms.mappers'

// Custom Form has no backend endpoints yet (docs/backend-dependencies.md, "Custom Form"). Every
// call below is a typed pending call: the MSW mock answers it in development; against the real
// API the list calls report "not available" (404 / 405 / 501) instead of failing, and the screens
// say they are waiting for the server.

/** Answers that mean "the backend does not have this endpoint". */
const MISSING_STATUSES = new Set([404, 405, 501])

async function pending<T>(request: () => Promise<T>): Promise<Pending<T>> {
  try {
    return { available: true, data: await request() }
  } catch (error) {
    if (error instanceof ApiError && MISSING_STATUSES.has(error.status)) return { available: false }
    throw error
  }
}

/** Query values: only what is set. */
function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

const form = (id: string, rest = '') => `/forms/${encodeURIComponent(id)}${rest}`
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {})

async function getItem<T>(url: string, signal?: AbortSignal): Promise<T> {
  const { data } = await apiClient.get<ApiItem<T>>(url, withSignal(signal))
  return data.data
}

async function getPage<T>(url: string, params: object, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<T>>(url, {
    params: compact(params),
    ...withSignal(signal),
  })
  return data
}

async function send<T>(method: 'post' | 'put', url: string, body: unknown): Promise<T> {
  const { data } = await apiClient[method]<ApiItem<T>>(url, body)
  return data.data
}

const mapPage = <D, T>(page: Paginated<D>, map: (dto: D) => T): Paginated<T> => ({
  data: page.data.map(map),
  meta: page.meta,
})

/** Responses read per request when the whole list is needed (CSV export). */
const EXPORT_PAGE_SIZE = 100
/** At most this many pages (10,000 responses) go into one export. */
const EXPORT_MAX_PAGES = 100

export const customFormsApi = {
  // TODO(backend): endpoint not available
  /** `GET /forms?q&status&page&pageSize`: the forms HR manages, newest change first. */
  listForms: (
    params: FormListParams,
    signal?: AbortSignal,
  ): Promise<Pending<Paginated<FormSummary>>> =>
    pending(async () =>
      mapPage(await getPage<FormSummaryDto>('/forms', params, signal), formSummaryFromApi),
    ),

  // TODO(backend): endpoint not available
  /** `GET /forms/{id}`: one form with its sections and fields. */
  getForm: async (id: string, signal?: AbortSignal): Promise<CustomForm> =>
    formFromApi(await getItem<FormDto>(form(id), signal)),

  // TODO(backend): endpoint not available
  /** `POST /forms`: a new draft. */
  createForm: async (input: FormInput): Promise<CustomForm> =>
    formFromApi(await send<FormDto>('post', '/forms', formToApi(input))),

  // TODO(backend): endpoint not available
  /** `PUT /forms/{id}`: the whole form. Once it has responses, its fields' types are locked. */
  updateForm: async (id: string, input: FormInput, rowVersion: string): Promise<CustomForm> =>
    formFromApi(await send<FormDto>('put', form(id), formToApi(input, rowVersion))),

  // TODO(backend): endpoint not available
  /** `DELETE /forms/{id}?rowVersion=`: a draft, a form with no responses, or a closed one. */
  deleteForm: async (id: string, rowVersion: string): Promise<void> => {
    await apiClient.delete(form(id), { params: { rowVersion } })
  },

  // TODO(backend): endpoint not available
  /** `POST /forms/{id}/publish`: a draft (or a closed form, to reopen it) goes to its audience. */
  publishForm: async (id: string, rowVersion: string): Promise<CustomForm> =>
    formFromApi(
      await send<FormDto>('post', form(id, '/publish'), { rowVersion } satisfies RowVersionInDto),
    ),

  // TODO(backend): endpoint not available
  /** `POST /forms/{id}/close`: no more answers; the responses stay. */
  closeForm: async (id: string, rowVersion: string): Promise<CustomForm> =>
    formFromApi(
      await send<FormDto>('post', form(id, '/close'), { rowVersion } satisfies RowVersionInDto),
    ),

  // TODO(backend): endpoint not available
  /** `POST /forms/{id}/duplicate`: a draft copy with the same questions and no responses. */
  duplicateForm: async (id: string): Promise<CustomForm> =>
    formFromApi(await send<FormDto>('post', form(id, '/duplicate'), {})),

  // TODO(backend): endpoint not available
  /** `GET /forms/assigned?q&page&pageSize`: the published and closed forms meant for the caller. */
  assignedForms: (
    params: PageParams,
    signal?: AbortSignal,
  ): Promise<Pending<Paginated<AssignedForm>>> =>
    pending(async () =>
      mapPage(await getPage<AssignedFormDto>('/forms/assigned', params, signal), assignedFromApi),
    ),

  // TODO(backend): endpoint not available
  /** `GET /forms/assigned/{id}`: one of them with its questions, to fill. */
  assignedForm: async (id: string, signal?: AbortSignal): Promise<AssignedFormDetail> =>
    assignedDetailFromApi(
      await getItem<AssignedFormDetailDto>(`/forms/assigned/${encodeURIComponent(id)}`, signal),
    ),

  // TODO(backend): endpoint not available
  /** `POST /forms/{id}/responses`: the caller's answers. */
  submitResponse: async (
    formId: string,
    answers: readonly AnswerInput[],
    definition: Pick<FormDefinition, 'fields'>,
  ): Promise<FormResponse> =>
    responseFromApi(
      await send<ResponseDto>(
        'post',
        form(formId, '/responses'),
        answersToApi(answers, definition.fields),
      ),
    ),

  // TODO(backend): endpoint not available
  /** `GET /forms/{id}/responses?q&page&pageSize`: newest first; `q` matches the respondent. */
  listResponses: async (
    formId: string,
    params: PageParams,
    signal?: AbortSignal,
  ): Promise<Paginated<FormResponse>> =>
    mapPage(
      await getPage<ResponseDto>(form(formId, '/responses'), params, signal),
      responseFromApi,
    ),

  // TODO(backend): endpoint not available
  /** Every response of a form (all pages of the call above, 100 at a time), for the CSV export. */
  allResponses: async (formId: string, q?: string): Promise<FormResponse[]> => {
    const rows: FormResponse[] = []
    for (let page = 1; page <= EXPORT_MAX_PAGES; page += 1) {
      const result = await customFormsApi.listResponses(formId, {
        q,
        page,
        pageSize: EXPORT_PAGE_SIZE,
      })
      rows.push(...result.data)
      if (result.meta.page >= result.meta.totalPages || result.data.length === 0) break
    }
    return rows
  },

  // TODO(backend): endpoint not available
  /** `GET /forms/{id}/responses/summary`: counts per answer of the choice-like fields. */
  responseSummary: async (formId: string, signal?: AbortSignal): Promise<ResponseSummary> =>
    summaryFromApi(await getItem<ResponseSummaryDto>(form(formId, '/responses/summary'), signal)),

  // TODO(backend): endpoint not available
  /** `GET /forms/responses/{id}`: one response with its form's questions (HR, or its author). */
  getResponse: async (id: string, signal?: AbortSignal): Promise<ResponseDetail> =>
    responseDetailFromApi(
      await getItem<ResponseDetailDto>(`/forms/responses/${encodeURIComponent(id)}`, signal),
    ),

  // TODO(backend): endpoint not available
  /** `GET /forms/my-responses?page&pageSize`: what the caller has submitted, newest first. */
  myResponses: (
    params: PageParams,
    signal?: AbortSignal,
  ): Promise<Pending<Paginated<MyResponse>>> =>
    pending(async () =>
      mapPage(
        await getPage<MyResponseDto>('/forms/my-responses', params, signal),
        myResponseFromApi,
      ),
    ),
}
