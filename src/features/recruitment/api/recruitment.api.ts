import { ApiError } from '@/lib/api-error'
import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import {
  type ApplicantFilters,
  type ApplicationFilters,
  type InterviewFilters,
  type NamedOption,
  type OfferFilters,
  type OpeningFilters,
  type PageQuery,
  type Stage,
  STAGES,
  type Versioned,
} from '../types/recruitment.types'
import type {
  ApplicantInDto,
  ApplicationInDto,
  ApplicationOutDto,
  CompleteInDto,
  DashboardOutDto,
  EvaluationInDto,
  HireInDto,
  InterviewInDto,
  OfferInDto,
  OpeningInDto,
  RejectInDto,
  RejectionReasonInDto,
  RejectionReasonOutDto,
  RespondInDto,
  StageInDto,
} from './recruitment.dto'
import {
  toApiId,
  toApplicant,
  toApplicantDetail,
  toApplication,
  toApplicationDetail,
  toDashboard,
  toInterview,
  toInterviewDetail,
  toOffer,
  toOpening,
  toRejectionReason,
} from './recruitment.mappers'

/** Query values: only what is set (ids as numbers), so keys and URLs stay short. */
export function compact(params: object): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params) as [string, unknown][]) {
    if (value === undefined || value === null || value === '' || value === false) continue
    if (typeof value === 'string' && key.endsWith('Id')) out[key] = toApiId(value)
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      out[key] = value
  }
  return out
}

const base = '/recruitment'
const one = (name: string, id: string, rest = '') =>
  `${base}/${name}/${encodeURIComponent(id)}${rest}`

/** A DTO → screen-type mapper; the answer is read as the DTO the mapper takes. */
type Mapper<T> = (dto: never) => T

async function getPage<T>(
  url: string,
  params: object,
  map: Mapper<T>,
  signal?: AbortSignal,
): Promise<Paginated<T>> {
  const { data } = await apiClient.get<Paginated<never>>(url, { params: compact(params), signal })
  return { data: data.data.map(map), meta: data.meta }
}

async function getItem<T>(url: string, map: Mapper<T>, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<never>>(url, { signal })
  return map(data.data)
}

async function send<T>(
  method: 'post' | 'put' | 'patch',
  url: string,
  body: unknown,
  map: Mapper<T>,
) {
  const { data } = await apiClient[method]<ApiItem<never>>(url, body)
  return map(data.data)
}

/** Deletes send the row version last read (`?rowVersion=`); the API answers 204. */
async function remove(url: string, rowVersion: string) {
  await apiClient.delete(url, { params: { rowVersion } })
}

/** Every page of a list (pickers): 100 a page, at most 10 pages. */
async function getAll<T>(url: string, params: object, map: Mapper<T>, signal?: AbortSignal) {
  const rows: T[] = []
  for (let page = 1; page <= 10; page += 1) {
    const result = await getPage(url, { ...params, page, pageSize: 100 }, map, signal)
    rows.push(...result.data)
    if (page >= result.meta.totalPages || result.data.length === 0) break
  }
  return rows
}

/** A picker list the user may not read is empty rather than failing the form. */
async function orEmptyIfForbidden<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return []
    throw error
  }
}

export type OpeningAction = 'publish' | 'hold' | 'close' | 'reopen'

/** How many applications each stage holds (one `pageSize=1` read per stage, run together). */
export type StageCounts = Record<Stage, number>

/** `GET /manpower/open-positions` rows the opening form links to (only what it shows). */
interface OpenPositionRow {
  id: string
  title: string
  totalPositions: number
  status: string
}

/** The REST calls of `/api/recruitment/…`, mapped to the screens' types. */
export const recruitmentApi = {
  dashboard: (params: { year: number; month?: number | undefined }, signal?: AbortSignal) =>
    apiClient
      .get<ApiItem<DashboardOutDto>>(`${base}/dashboard`, { params: compact(params), signal })
      .then((response) => toDashboard(response.data.data)),

  /** Applications per stage under the same filters (the dashboard, an opening's detail). */
  async stageCounts(filters: ApplicationFilters, signal?: AbortSignal): Promise<StageCounts> {
    const totals = await Promise.all(
      STAGES.map((stage) =>
        apiClient
          .get<Paginated<ApplicationOutDto>>(`${base}/applications`, {
            params: compact({ ...filters, stage, page: 1, pageSize: 1 }),
            signal,
          })
          .then((response) => response.data.meta.total),
      ),
    )
    return Object.fromEntries(
      STAGES.map((stage, index) => [stage, totals[index] ?? 0]),
    ) as StageCounts
  },

  // Openings
  openings: (params: OpeningFilters & PageQuery, signal?: AbortSignal) =>
    getPage(`${base}/openings`, params, toOpening, signal),
  allOpenings: (params: OpeningFilters, signal?: AbortSignal) =>
    getAll(`${base}/openings`, params, toOpening, signal),
  opening: (id: string, signal?: AbortSignal) => getItem(one('openings', id), toOpening, signal),
  createOpening: (input: OpeningInDto) => send('post', `${base}/openings`, input, toOpening),
  updateOpening: (id: string, input: OpeningInDto) =>
    send('put', one('openings', id), input, toOpening),
  deleteOpening: (record: Versioned) => remove(one('openings', record.id), record.rowVersion),
  openingAction: (record: Versioned, action: OpeningAction) =>
    send(
      'post',
      one('openings', record.id, `/${action}`),
      { rowVersion: record.rowVersion },
      toOpening,
    ),

  // Applicants (Candidates)
  applicants: (params: ApplicantFilters & PageQuery, signal?: AbortSignal) =>
    getPage(`${base}/applicants`, params, toApplicant, signal),
  applicant: (id: string, signal?: AbortSignal) =>
    getItem(one('applicants', id), toApplicantDetail, signal),
  createApplicant: (input: ApplicantInDto) =>
    send('post', `${base}/applicants`, input, toApplicant),
  updateApplicant: (id: string, input: ApplicantInDto) =>
    send('put', one('applicants', id), input, toApplicant),
  deleteApplicant: (record: Versioned) => remove(one('applicants', record.id), record.rowVersion),

  // Applications (the pipeline)
  applications: (params: ApplicationFilters & PageQuery, signal?: AbortSignal) =>
    getPage(`${base}/applications`, params, toApplication, signal),
  application: (id: string, signal?: AbortSignal) =>
    getItem(one('applications', id), toApplicationDetail, signal),
  createApplication: (input: ApplicationInDto) =>
    send('post', `${base}/applications`, input, toApplicationDetail),
  deleteApplication: (record: Versioned) =>
    remove(one('applications', record.id), record.rowVersion),
  moveApplication: (record: Versioned, body: Omit<StageInDto, 'rowVersion'>) =>
    send(
      'patch',
      one('applications', record.id, '/stage'),
      { ...body, rowVersion: record.rowVersion },
      toApplicationDetail,
    ),
  rejectApplication: (record: Versioned, body: Omit<RejectInDto, 'rowVersion'>) =>
    send(
      'post',
      one('applications', record.id, '/reject'),
      { ...body, rowVersion: record.rowVersion },
      toApplicationDetail,
    ),
  withdrawApplication: (record: Versioned, remarks: string | null) =>
    send(
      'post',
      one('applications', record.id, '/withdraw'),
      { remarks, rowVersion: record.rowVersion },
      toApplicationDetail,
    ),
  hireApplication: (record: Versioned, body: Omit<HireInDto, 'rowVersion'>) =>
    send(
      'post',
      one('applications', record.id, '/hire'),
      { ...body, rowVersion: record.rowVersion },
      toApplicationDetail,
    ),

  // Interviews
  interviews: (params: InterviewFilters & PageQuery, signal?: AbortSignal) =>
    getPage(`${base}/interviews`, params, toInterview, signal),
  interview: (id: string, signal?: AbortSignal) =>
    getItem(one('interviews', id), toInterviewDetail, signal),
  createInterview: (input: InterviewInDto) =>
    send('post', `${base}/interviews`, input, toInterviewDetail),
  updateInterview: (id: string, input: InterviewInDto) =>
    send('put', one('interviews', id), input, toInterviewDetail),
  cancelInterview: (record: Versioned, remarks: string | null) =>
    send(
      'post',
      one('interviews', record.id, '/cancel'),
      { remarks, rowVersion: record.rowVersion },
      toInterviewDetail,
    ),
  completeInterview: (record: Versioned, body: Omit<CompleteInDto, 'rowVersion'>) =>
    send(
      'post',
      one('interviews', record.id, '/complete'),
      { ...body, rowVersion: record.rowVersion },
      toInterviewDetail,
    ),
  evaluateInterview: (id: string, body: EvaluationInDto) =>
    send('post', one('interviews', id, '/evaluations'), body, toInterviewDetail),

  // Offers
  offers: (params: OfferFilters & PageQuery, signal?: AbortSignal) =>
    getPage(`${base}/offers`, params, toOffer, signal),
  offer: (id: string, signal?: AbortSignal) => getItem(one('offers', id), toOffer, signal),
  createOffer: (input: OfferInDto) => send('post', `${base}/offers`, input, toOffer),
  updateOffer: (id: string, input: OfferInDto) => send('put', one('offers', id), input, toOffer),
  deleteOffer: (record: Versioned) => remove(one('offers', record.id), record.rowVersion),
  sendOffer: (record: Versioned, remarks: string | null) =>
    send(
      'post',
      one('offers', record.id, '/send'),
      { remarks, rowVersion: record.rowVersion },
      toOffer,
    ),
  respondOffer: (record: Versioned, body: Omit<RespondInDto, 'rowVersion'>) =>
    send(
      'post',
      one('offers', record.id, '/respond'),
      { ...body, rowVersion: record.rowVersion },
      toOffer,
    ),
  withdrawOffer: (record: Versioned, remarks: string | null) =>
    send(
      'post',
      one('offers', record.id, '/withdraw'),
      { remarks, rowVersion: record.rowVersion },
      toOffer,
    ),

  // Settings → Rejection Reasons (`{data: [...]}`, not paged)
  rejectionReasons: (
    params: { q?: string | undefined; activeOnly?: boolean },
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<ApiItem<RejectionReasonOutDto[]>>(`${base}/settings/rejection-reasons`, {
        params: compact(params),
        signal,
      })
      .then((response) => response.data.data.map(toRejectionReason)),
  createRejectionReason: (input: RejectionReasonInDto) =>
    send('post', `${base}/settings/rejection-reasons`, input, toRejectionReason),
  updateRejectionReason: (id: string, input: RejectionReasonInDto) =>
    send('put', one('settings/rejection-reasons', id), input, toRejectionReason),
  deleteRejectionReason: (record: Versioned) =>
    remove(one('settings/rejection-reasons', record.id), record.rowVersion),

  // Pickers from other modules
  /** `GET /organisation/lookups/{kind}` → `{data: [{id, name}]}`. */
  orgLookup: (kind: string, signal?: AbortSignal) =>
    orEmptyIfForbidden(
      apiClient
        .get<ApiItem<NamedOption[]>>(`/organisation/lookups/${kind}`, { signal })
        .then((response) => response.data.data.map(({ id, name }) => ({ id, name }))),
    ),
  /** Manpower Planning's open positions still active (the opening form links one). */
  openPositions: (signal?: AbortSignal) =>
    orEmptyIfForbidden(
      getAll(
        '/manpower/open-positions',
        { status: 'active' },
        (row: OpenPositionRow) => row,
        signal,
      ),
    ),
}
