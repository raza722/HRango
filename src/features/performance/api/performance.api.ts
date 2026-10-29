import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AppraisalListParams,
  CheckInInput,
  CycleInput,
  CycleListParams,
  FinaliseInput,
  GoalInput,
  GoalListParams,
  KpiInput,
  KpiListParams,
  OrgItem,
  ReviewInput,
} from '../types/performance.types'
import type {
  AppraisalDetailDto,
  AppraisalDto,
  AppraisalFormDto,
  CycleDto,
  GoalDetailDto,
  GoalDto,
  KpiDto,
  OrgLookupDto,
  OverviewDto,
  ParticipantsOutDto,
} from './performance.dto'
import {
  toApiId,
  toAppraisal,
  toAppraisalDetail,
  toAppraisalForm,
  toCheckInIn,
  toCycle,
  toCycleIn,
  toFinaliseIn,
  toGoal,
  toGoalDetail,
  toGoalIn,
  toKpi,
  toKpiIn,
  toOverview,
  toReviewIn,
} from './performance.mappers'

/** Query values: only what is set, so keys and URLs stay short. */
export function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Partial<T>
}

/** Ids in a query string go as the API reads them (numbers when numeric). */
const withIds = <T extends object>(params: T, keys: readonly (keyof T)[]) => {
  const out: Record<string, unknown> = { ...compact(params) }
  for (const key of keys) {
    const value = out[key as string]
    if (typeof value === 'string') out[key as string] = toApiId(value)
  }
  return out
}

const BASE = '/performance'
const at = (resource: string, id: string, rest = '') =>
  `${BASE}/${resource}/${encodeURIComponent(id)}${rest}`

async function getPage<TDto>(url: string, params: Record<string, unknown>, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<TDto>>(url, { params, signal })
  return data
}

const mapPage = <TDto, T>(page: Paginated<TDto>, map: (dto: TDto) => T): Paginated<T> => ({
  data: page.data.map(map),
  meta: page.meta,
})

async function getItem<TDto>(url: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<ApiItem<TDto>>(url, { signal })
  return data.data
}

async function send<TDto>(method: 'post' | 'put', url: string, body: unknown): Promise<TDto> {
  const { data } = await apiClient[method]<ApiItem<TDto>>(url, body)
  return data.data
}

/** Deletes send the row version last read (`?rowVersion=`). */
async function remove(url: string, rowVersion: string): Promise<void> {
  await apiClient.delete(url, { params: { rowVersion } })
}

/** REST calls of `/api/performance/…`. */
export const performanceApi = {
  /** `GET /performance/overview?employeeId`: the caller's, or (managers) a chosen person's. */
  overview: async (employeeId: string | undefined, signal?: AbortSignal) =>
    toOverview(
      (
        await apiClient.get<ApiItem<OverviewDto>>(`${BASE}/overview`, {
          params: employeeId ? { employeeId: toApiId(employeeId) } : {},
          signal,
        })
      ).data.data,
    ),

  // --- goals --------------------------------------------------------------------------------
  /** `GET /performance/goals?tab&employeeId&status&cycleId&overdue&dueFrom&dueTo&q&page&pageSize`. */
  goals: async (params: GoalListParams, signal?: AbortSignal) =>
    mapPage(
      await getPage<GoalDto>(`${BASE}/goals`, withIds(params, ['employeeId', 'cycleId']), signal),
      toGoal,
    ),
  goal: async (id: string, signal?: AbortSignal) =>
    toGoalDetail(await getItem<GoalDetailDto>(at('goals', id), signal)),
  createGoal: async (input: GoalInput) =>
    toGoalDetail(await send<GoalDetailDto>('post', `${BASE}/goals`, toGoalIn(input))),
  updateGoal: async (id: string, input: GoalInput) =>
    toGoalDetail(await send<GoalDetailDto>('put', at('goals', id), toGoalIn(input))),
  deleteGoal: (id: string, rowVersion: string) => remove(at('goals', id), rowVersion),
  /** `POST /performance/goals/{id}/check-ins`: progress, actual value, status, comments. */
  checkIn: async (id: string, input: CheckInInput) =>
    toGoalDetail(
      await send<GoalDetailDto>('post', at('goals', id, '/check-ins'), toCheckInIn(input)),
    ),

  // --- KPIs ---------------------------------------------------------------------------------
  /** `GET /performance/kpis?q&keyResultArea&departmentId&isActive&page&pageSize`. */
  kpis: async (params: KpiListParams, signal?: AbortSignal) =>
    mapPage(
      await getPage<KpiDto>(`${BASE}/kpis`, withIds(params, ['departmentId']), signal),
      toKpi,
    ),
  kpi: async (id: string, signal?: AbortSignal) =>
    toKpi(await getItem<KpiDto>(at('kpis', id), signal)),
  createKpi: async (input: KpiInput) =>
    toKpi(await send<KpiDto>('post', `${BASE}/kpis`, toKpiIn(input))),
  updateKpi: async (id: string, input: KpiInput) =>
    toKpi(await send<KpiDto>('put', at('kpis', id), toKpiIn(input))),
  deleteKpi: (id: string, rowVersion: string) => remove(at('kpis', id), rowVersion),

  // --- cycles -------------------------------------------------------------------------------
  /** `GET /performance/cycles?status&q&page&pageSize`. */
  cycles: async (params: CycleListParams, signal?: AbortSignal) =>
    mapPage(await getPage<CycleDto>(`${BASE}/cycles`, compact(params), signal), toCycle),
  cycle: async (id: string, signal?: AbortSignal) =>
    toCycle(await getItem<CycleDto>(at('cycles', id), signal)),
  createCycle: async (input: CycleInput) =>
    toCycle(await send<CycleDto>('post', `${BASE}/cycles`, toCycleIn(input))),
  updateCycle: async (id: string, input: CycleInput) =>
    toCycle(await send<CycleDto>('put', at('cycles', id), toCycleIn(input))),
  deleteCycle: (id: string, rowVersion: string) => remove(at('cycles', id), rowVersion),
  /** `POST …/participants {employeeIds, departmentId}` → the cycle and how many were added. */
  addParticipants: async (
    id: string,
    { employeeIds, departmentId }: { employeeIds: string[]; departmentId: string | null },
  ) => {
    const result = await send<ParticipantsOutDto>('post', at('cycles', id, '/participants'), {
      employeeIds: employeeIds.map(toApiId),
      departmentId: departmentId ? toApiId(departmentId) : null,
    })
    return { cycle: toCycle(result.cycle), added: result.added }
  },
  launchCycle: async (id: string, rowVersion: string) =>
    toCycle(await send<CycleDto>('post', at('cycles', id, '/launch'), { rowVersion })),
  closeCycle: async (id: string, rowVersion: string) =>
    toCycle(await send<CycleDto>('post', at('cycles', id, '/close'), { rowVersion })),

  /** `GET /performance/forms?isActive`: the appraisal forms a cycle can use. */
  forms: async (signal?: AbortSignal) => {
    const page = await getPage<AppraisalFormDto>(`${BASE}/forms`, { pageSize: 100 }, signal)
    return page.data.map(toAppraisalForm)
  },

  // --- appraisals and reviews -----------------------------------------------------------------
  /** `GET /performance/appraisals?tab&cycleId&status&employeeId&q&page&pageSize`. */
  appraisals: async (params: AppraisalListParams, signal?: AbortSignal) =>
    mapPage(
      await getPage<AppraisalDto>(
        `${BASE}/appraisals`,
        withIds(params, ['cycleId', 'employeeId']),
        signal,
      ),
      toAppraisal,
    ),
  appraisal: async (id: string, signal?: AbortSignal) =>
    toAppraisalDetail(await getItem<AppraisalDetailDto>(at('appraisals', id), signal)),
  /** Removes a participant from a cycle (their appraisal). */
  deleteAppraisal: (id: string, rowVersion: string) => remove(at('appraisals', id), rowVersion),
  finalise: async (id: string, input: FinaliseInput) =>
    toAppraisalDetail(
      await send<AppraisalDetailDto>(
        'post',
        at('appraisals', id, '/finalise'),
        toFinaliseIn(input),
      ),
    ),

  /** `GET /performance/reviews?tab&cycleId&status&employeeId&q&page&pageSize` (default tab my). */
  reviews: async (params: AppraisalListParams, signal?: AbortSignal) =>
    mapPage(
      await getPage<AppraisalDto>(
        `${BASE}/reviews`,
        withIds(params, ['cycleId', 'employeeId']),
        signal,
      ),
      toAppraisal,
    ),
  review: async (id: string, signal?: AbortSignal) =>
    toAppraisalDetail(await getItem<AppraisalDetailDto>(at('reviews', id), signal)),
  /** `PUT /performance/reviews/{id}/self|manager`: `submit: false` saves a draft. */
  saveReview: async (id: string, part: 'self' | 'manager', input: ReviewInput) =>
    toAppraisalDetail(
      await send<AppraisalDetailDto>('put', at('reviews', id, `/${part}`), toReviewIn(input)),
    ),

  /** `GET /organisation/lookups/{kind}` (departments, job titles). */
  orgLookup: async (kind: 'departments' | 'job-titles', signal?: AbortSignal): Promise<OrgItem[]> =>
    (await getItem<OrgLookupDto[]>(`/organisation/lookups/${kind}`, signal)).map((row) => ({
      id: row.id,
      name: row.name,
    })),
}
