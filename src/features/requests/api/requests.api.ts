import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  ApprovalListParams,
  ColleagueOption,
  DayShift,
  DecisionInput,
  RequestDetail,
  RequestKind,
  RequestKindMap,
  RequestListParams,
  RequestPage,
  SwapColleague,
  TimeSlotOption,
  TransferLookups,
} from '../types/requests.types'
import { compactQuery, type RequestBody } from './backend'
import { asDetails, type DetailSource, engineApi } from './engine.api'
import { lookupsApi } from './lookups.api'

/*
 * Punch, Shift and Transfer on the API's request engine: `/requests/punch`,
 * `/requests/shift-swap`, `/requests/transfer` and the shared Approvals
 * (`/requests/approvals?box=&type=`). The screens read each type's `details`
 * as the API sends them. The day's shift and the time slots come from
 * Scheduling (`/scheduling/schedules`, `/scheduling/options/time-slots`).
 */

type Payload<K extends RequestKind> = RequestKindMap[K]['payload']

const mapper = <K extends RequestKind>() => asDetails<Payload<K>>()

/** `GET /scheduling/schedules` (the schedule board) as far as the forms read it. */
interface BoardShift {
  workDate: string
  startAt: string
  endAt: string
  timeSlotId: string | null
  timeSlotName: string | null
}
interface BoardRow {
  employee: { id: string; code: string; name: string }
  shifts: BoardShift[]
  restDays: { restDate: string }[]
}

const hhmm = (iso: string | null | undefined) => (iso ? iso.slice(11, 16) : null)

/** "RS Morning (09:00 – 17:00)". */
const shiftLabel = (shift: BoardShift) =>
  `${shift.timeSlotName ?? 'Shift'} (${hhmm(shift.startAt) ?? ''} – ${hhmm(shift.endAt) ?? ''})`

async function board(params: Record<string, string | number>, signal?: AbortSignal) {
  const { data } = await apiClient.get<Paginated<BoardRow>>('/scheduling/schedules', {
    params: { pageSize: 100, ...params },
    signal,
  })
  return data.data
}

/** A colleague as the Swap To list shows them: name, code and their shift that day if known. */
export const toSwapColleague = (
  colleague: ColleagueOption,
  shifts: Record<string, string>,
): SwapColleague => ({
  person: { id: colleague.id, name: colleague.name ?? '—', code: colleague.code ?? '' },
  shift: shifts[colleague.id] ?? null,
})

/** REST calls of Punch, Shift and Transfer. */
export const requestsApi = {
  list: async <K extends RequestKind>(kind: K, params: RequestListParams, signal?: AbortSignal) =>
    (await engineApi.list(
      kind,
      {
        view: params.scope,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
        filters: params.filters,
      },
      mapper<K>(),
      signal,
    )) as unknown as RequestPage<RequestKindMap[K]>,

  approvals: async <K extends RequestKind>(
    kind: K,
    params: ApprovalListParams,
    signal?: AbortSignal,
  ) =>
    (await engineApi.approvals(
      kind,
      {
        box: params.view,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
        filters: params.filters,
      },
      mapper<K>(),
      signal,
    )) as unknown as RequestPage<RequestKindMap[K]>,

  detail: async <K extends RequestKind>(
    kind: K,
    id: string,
    via: DetailSource = 'request',
    signal?: AbortSignal,
  ) =>
    (await engineApi.detail(kind, id, mapper<K>(), via, signal)) as unknown as RequestDetail<
      RequestKindMap[K]
    >,

  create: async <K extends RequestKind>(kind: K, body: RequestBody) =>
    (await engineApi.create(kind, body, mapper<K>())) as unknown as RequestKindMap[K],

  update: async <K extends RequestKind>(kind: K, id: string, body: RequestBody) =>
    (await engineApi.update(kind, id, body, mapper<K>())) as unknown as RequestKindMap[K],

  remove: (kind: RequestKind, id: string, rowVersion: string) =>
    engineApi.remove(kind, id, rowVersion),

  /** Withdraws a pending request, or asks to cancel an approved one. */
  cancel: (kind: RequestKind, id: string, reason: string, rowVersion: string) =>
    engineApi.cancel(kind, id, reason, rowVersion),

  decide: (id: string, input: DecisionInput) =>
    engineApi.decide(id, input.decision, {
      remarks: input.remarks || null,
      rowVersion: input.rowVersion,
    }),

  /** A Can Disagree step (the colleague of a shift swap): agree or disagree. */
  consent: (id: string, input: DecisionInput) =>
    engineApi.consent(id, input.decision === 'approve', input.remarks || null, input.rowVersion),

  /**
   * The person's shift on a date. Empty `employeeId`: the signed-in person (the
   * API scopes the board to what `scheduling.schedules.view` reaches).
   */
  async dayShift(
    employeeId: string | undefined,
    date: string,
    signal?: AbortSignal,
  ): Promise<DayShift> {
    const rows = await board(
      { from: date, to: date, ...(employeeId ? { employeeId } : {}) },
      signal,
    )
    const row = employeeId ? rows.find((item) => item.employee.id === employeeId) : rows[0]
    const shift = row?.shifts.find((item) => item.workDate === date)
    return {
      date,
      slotName: shift?.timeSlotName ?? null,
      timeSlotId: shift?.timeSlotId ?? null,
      clockIn: hhmm(shift?.startAt),
      clockOut: hhmm(shift?.endAt),
      restDay: Boolean(row?.restDays.some((rest) => rest.restDate === date)),
    }
  },

  /** People with a different shift that day ("Swap To"), from the schedule board. */
  /**
   * Colleagues the requester (`employeeId`, default the caller) may swap with, searched on
   * the server (`GET /requests/options/colleagues?q&employeeId&page&pageSize`).
   */
  async colleagues(
    params: {
      employeeId?: string | undefined
      q?: string | undefined
      page?: number
      pageSize?: number
    },
    signal?: AbortSignal,
  ): Promise<Paginated<ColleagueOption>> {
    const query = Object.fromEntries(
      Object.entries({ pageSize: 50, ...params }).filter(([, value]) => Boolean(value)),
    )
    const { data } = await apiClient.get<Paginated<ColleagueOption>>(
      '/requests/options/colleagues',
      { params: query, signal },
    )
    return data
  },

  /**
   * Everyone's shift on `date` the caller may read on the schedule board (staff read only
   * their own): names the colleagues' shifts where known. Empty without the board.
   */
  async dayShifts(date: string, signal?: AbortSignal): Promise<Record<string, string>> {
    const rows = await board({ from: date, to: date }, signal).catch(() => [])
    const shifts: Record<string, string> = {}
    for (const row of rows) {
      const shift = row.shifts.find((item) => item.workDate === date)
      if (shift) shifts[row.employee.id] = shiftLabel(shift)
    }
    return shifts
  },

  /** The first page of colleagues to swap with on `date`, with their shift where known. */
  async swapColleagues(
    employeeId: string | undefined,
    date: string,
    signal?: AbortSignal,
    q?: string,
  ): Promise<SwapColleague[]> {
    const [page, shifts] = await Promise.all([
      requestsApi.colleagues({ employeeId, q }, signal),
      requestsApi.dayShifts(date, signal),
    ])
    return page.data.map((colleague) => toSwapColleague(colleague, shifts))
  },

  async timeSlots(signal?: AbortSignal): Promise<TimeSlotOption[]> {
    const { data } = await apiClient.get<ApiItem<TimeSlotOption[]>>(
      '/scheduling/options/time-slots',
      { signal },
    )
    return data.data
  },

  /** Locations, branches (with their location) and departments for Transfer. */
  async transferLookups(signal?: AbortSignal): Promise<TransferLookups> {
    const [locations, branches, departments] = await Promise.all([
      lookupsApi.org('locations', undefined, signal),
      lookupsApi.org('branches', undefined, signal),
      lookupsApi.org('departments', undefined, signal),
    ])
    const named = ({ id, name }: { id: string; name: string }) => ({ id, name })
    return {
      locations: locations.map(named),
      branches: branches.map((branch) => ({ ...named(branch), locationId: branch.parentId })),
      departments: departments.map(named),
    }
  },
}

export const requestKeys = {
  all: ['requests'] as const,
  kind: (kind: RequestKind) => [...requestKeys.all, kind] as const,
  list: (kind: RequestKind, params: RequestListParams) =>
    [...requestKeys.kind(kind), 'list', compactQuery(params)] as const,
  approvals: (kind: RequestKind, params: ApprovalListParams) =>
    [...requestKeys.kind(kind), 'approvals', compactQuery(params)] as const,
  detail: (kind: RequestKind, id: string, via: DetailSource = 'request') =>
    [...requestKeys.kind(kind), 'detail', id, via] as const,
  dayShift: (employeeId: string | undefined, date: string) =>
    [...requestKeys.all, 'day-shift', employeeId ?? 'me', date] as const,
  colleagues: (employeeId: string | undefined, date: string) =>
    [...requestKeys.all, 'swap-colleagues', employeeId ?? 'me', date] as const,
  colleagueSearch: (employeeId: string | undefined, q: string) =>
    [...requestKeys.all, 'colleague-options', employeeId ?? 'me', q] as const,
  dayShifts: (date: string) => [...requestKeys.all, 'day-shifts', date] as const,
  timeSlots: () => [...requestKeys.all, 'time-slots'] as const,
  transferLookups: () => [...requestKeys.all, 'lookups', 'transfer'] as const,
}

export const requestListQueryOptions = <K extends RequestKind>(
  kind: K,
  params: RequestListParams,
) =>
  queryOptions({
    queryKey: requestKeys.list(kind, params),
    queryFn: ({ signal }) => requestsApi.list(kind, params, signal),
    placeholderData: keepPreviousData,
  })

export const approvalListQueryOptions = <K extends RequestKind>(
  kind: K,
  params: ApprovalListParams,
) =>
  queryOptions({
    queryKey: requestKeys.approvals(kind, params),
    queryFn: ({ signal }) => requestsApi.approvals(kind, params, signal),
    placeholderData: keepPreviousData,
  })

export const requestDetailQueryOptions = <K extends RequestKind>(
  kind: K,
  id: string,
  via: DetailSource = 'request',
) =>
  queryOptions({
    queryKey: requestKeys.detail(kind, id, via),
    queryFn: ({ signal }) => requestsApi.detail(kind, id, via, signal),
  })

export const dayShiftQueryOptions = (employeeId: string | undefined, date: string) =>
  queryOptions({
    queryKey: requestKeys.dayShift(employeeId, date),
    queryFn: ({ signal }) => requestsApi.dayShift(employeeId, date, signal),
  })

export const swapColleaguesQueryOptions = (employeeId: string | undefined, date: string) =>
  queryOptions({
    queryKey: requestKeys.colleagues(employeeId, date),
    queryFn: ({ signal }) => requestsApi.swapColleagues(employeeId, date, signal),
  })

export const timeSlotsQueryOptions = () =>
  queryOptions({
    queryKey: requestKeys.timeSlots(),
    queryFn: ({ signal }) => requestsApi.timeSlots(signal),
    staleTime: 5 * 60_000,
  })

export const transferLookupsQueryOptions = () =>
  queryOptions({
    queryKey: requestKeys.transferLookups(),
    queryFn: ({ signal }) => requestsApi.transferLookups(signal),
    staleTime: 5 * 60_000,
  })
