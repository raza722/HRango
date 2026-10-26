import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/axios'
import type { ApiItem, Paginated } from '@/types/api'

import type {
  AllotmentInput,
  AllotmentResult,
  CarryForwardInput,
  CarryForwardResult,
  DepartmentLookup,
  EmployeeLookup,
  Encashment,
  EncashmentDetail,
  EncashmentInput,
  EncashmentListParams,
  EncashmentUpdateInput,
  EnrolledEmployee,
  LeaveApplication,
  LeaveApplicationCounts,
  LeaveApplicationDetail,
  LeaveApplicationListParams,
  LeaveBalanceParams,
  LeaveBalanceRow,
  LeaveDecisionInput,
  LeavePolicy,
  LeavePolicyInput,
  LeavePolicyListParams,
  LeaveRequestDetail,
  LeaveRequestInput,
  LeaveSettings,
  LeaveSettingsInput,
  LeaveType,
  LeaveTypeInput,
  LeaveTypeListParams,
  LeaveTypeOption,
  LedgerEntry,
  LedgerEntryInput,
} from '../types/leaves.types'

type LeaveCountParams = Pick<LeaveApplicationListParams, 'tab' | 'filters'>

/** Leaves out empty values, so the query string carries only what is set. */
function clean(params: object): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )
}

/** `/leaves/applications` and `/counts` take the tab, the status and the filters flat. */
function applicationQuery({ filters, ...rest }: LeaveApplicationListParams) {
  return clean({ ...rest, ...filters })
}

export const leavesApi = {
  // --- Leave applications (read) -----------------------------------------------------------------
  async applications(params: LeaveApplicationListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<LeaveApplication>>('/leaves/applications', {
      params: applicationQuery(params),
      signal,
    })
    return data
  },
  /** The counts of the status dropdown: the tab and the filters, without the status. */
  async applicationCounts(params: LeaveCountParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeaveApplicationCounts>>(
      '/leaves/applications/counts',
      { params: clean({ tab: params.tab, ...params.filters }), signal },
    )
    return data.data
  },
  async application(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeaveApplicationDetail>>(
      `/leaves/applications/${id}`,
      { signal },
    )
    return data.data
  },

  // --- Leave requests (the requests module) ------------------------------------------------------
  async request(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeaveRequestDetail>>(`/requests/leave/${id}`, {
      signal,
    })
    return data.data
  },
  async apply(input: LeaveRequestInput) {
    const { data } = await apiClient.post<ApiItem<LeaveRequestDetail>>('/requests/leave', input)
    return data.data
  },
  async cancel(id: string, reason: string, rowVersion: string) {
    const { data } = await apiClient.post<ApiItem<LeaveRequestDetail>>(
      `/requests/leave/${id}/cancel`,
      { reason, rowVersion },
    )
    return data.data
  },
  async decide(id: string, { decision, remarks, rowVersion }: LeaveDecisionInput) {
    const { data } = await apiClient.post<ApiItem<LeaveRequestDetail>>(
      `/requests/approvals/${id}/${decision}`,
      { remarks: remarks || null, rowVersion },
    )
    return data.data
  },

  // --- Settings ----------------------------------------------------------------------------------
  async settings(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeaveSettings>>('/leaves/settings', { signal })
    return data.data
  },
  async saveSettings(input: LeaveSettingsInput) {
    const { data } = await apiClient.put<ApiItem<LeaveSettings>>('/leaves/settings', input)
    return data.data
  },

  async types(params: LeaveTypeListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<LeaveType>>('/leaves/types', {
      params: clean(params),
      signal,
    })
    return data
  },
  async createType(input: LeaveTypeInput) {
    const { data } = await apiClient.post<ApiItem<LeaveType>>('/leaves/types', input)
    return data.data
  },
  async updateType(id: string, input: LeaveTypeInput) {
    const { data } = await apiClient.put<ApiItem<LeaveType>>(`/leaves/types/${id}`, input)
    return data.data
  },
  async deleteType(id: string, rowVersion: string) {
    await apiClient.delete(`/leaves/types/${id}`, { params: { rowVersion } })
  },

  async policies(params: LeavePolicyListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<LeavePolicy>>('/leaves/policies', {
      params: clean(params),
      signal,
    })
    return data
  },
  async createPolicy(input: LeavePolicyInput) {
    const { data } = await apiClient.post<ApiItem<LeavePolicy>>('/leaves/policies', input)
    return data.data
  },
  async updatePolicy(id: string, input: LeavePolicyInput) {
    const { data } = await apiClient.put<ApiItem<LeavePolicy>>(`/leaves/policies/${id}`, input)
    return data.data
  },
  async deletePolicy(id: string, rowVersion: string) {
    await apiClient.delete(`/leaves/policies/${id}`, { params: { rowVersion } })
  },
  async enrolled(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<EnrolledEmployee>>(
      `/leaves/policies/${id}/employees`,
      { params: { page: 1, pageSize: 100 }, signal },
    )
    return data
  },
  async enrol(id: string, employeeIds: string[]) {
    const { data } = await apiClient.post<ApiItem<LeavePolicy>>(
      `/leaves/policies/${id}/employees`,
      { employeeIds },
    )
    return data.data
  },
  async unenrol(id: string, employeeId: string) {
    await apiClient.delete(`/leaves/policies/${id}/employees/${employeeId}`)
  },

  // --- Balances, ledger, allotment ---------------------------------------------------------------
  async balances(params: LeaveBalanceParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<LeaveBalanceRow>>('/leaves/balances', {
      params: clean(params),
      signal,
    })
    return data
  },
  async ledger(
    params: {
      employeeId?: string
      leaveTypeId?: string
      fiscalYear?: number
      reason?: string
      page: number
      pageSize: number
    },
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get<Paginated<LedgerEntry>>('/leaves/ledger', {
      params: clean(params),
      signal,
    })
    return data
  },
  async addLedgerEntry(input: LedgerEntryInput) {
    const { data } = await apiClient.post<ApiItem<LedgerEntry>>('/leaves/ledger', input)
    return data.data
  },
  async processAllotment(input: AllotmentInput) {
    const { data } = await apiClient.post<ApiItem<AllotmentResult>>(
      '/leaves/allotment/process',
      clean(input),
    )
    return data.data
  },
  async processCarryForward(input: CarryForwardInput) {
    const { data } = await apiClient.post<ApiItem<CarryForwardResult>>(
      '/leaves/carry-forward/process',
      clean(input),
    )
    return data.data
  },

  // --- Encashment ----------------------------------------------------------------------------------
  async encashments(params: EncashmentListParams, signal?: AbortSignal) {
    const { data } = await apiClient.get<Paginated<Encashment>>('/leaves/encashments', {
      params: clean(params),
      signal,
    })
    return data
  },
  async encashment(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<EncashmentDetail>>(`/leaves/encashments/${id}`, {
      signal,
    })
    return data.data
  },
  async createEncashment(input: EncashmentInput) {
    const { data } = await apiClient.post<ApiItem<EncashmentDetail>>('/leaves/encashments', input)
    return data.data
  },
  async updateEncashment(id: string, input: EncashmentUpdateInput) {
    const { data } = await apiClient.put<ApiItem<EncashmentDetail>>(
      `/leaves/encashments/${id}`,
      input,
    )
    return data.data
  },
  async deleteEncashment(id: string, rowVersion: string) {
    await apiClient.delete(`/leaves/encashments/${id}`, { params: { rowVersion } })
  },

  // --- Look-ups ------------------------------------------------------------------------------------
  /** People the caller reaches through `permission` (the code the screen itself needs). */
  /**
   * One page of the people the caller reaches through `permission`, searched with `q`
   * (`GET /employees/lookup` → `{data, meta}`; the pickers page through it themselves).
   */
  async employees(permission: string, q?: string, signal?: AbortSignal, page = 1, pageSize = 100) {
    const { data } = await apiClient.get<Paginated<EmployeeLookup>>('/employees/lookup', {
      params: clean({ permission, q, page, pageSize }),
      signal,
    })
    return data.data
  },
  /** The leave types `employeeId` (default: the caller) may apply for, with balance and rules. */
  async leaveTypeOptions(employeeId: string | undefined, asOf?: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<LeaveTypeOption[]>>(
      '/requests/options/leave-types',
      { params: clean({ employeeId, asOf }), signal },
    )
    return data.data
  },
  async departments(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiItem<DepartmentLookup[]>>(
      '/organisation/lookups/departments',
      { signal },
    )
    return data.data
  },
}

export const leavesKeys = {
  all: ['leaves'] as const,
  applications: () => [...leavesKeys.all, 'applications'] as const,
  applicationList: (params: LeaveApplicationListParams) =>
    [...leavesKeys.applications(), 'list', applicationQuery(params)] as const,
  applicationCounts: (params: LeaveCountParams) =>
    [
      ...leavesKeys.applications(),
      'counts',
      clean({ tab: params.tab, ...params.filters }),
    ] as const,
  application: (id: string) => [...leavesKeys.applications(), 'detail', id] as const,
  request: (id: string) => [...leavesKeys.applications(), 'request', id] as const,
  settings: () => [...leavesKeys.all, 'settings'] as const,
  types: () => [...leavesKeys.all, 'types'] as const,
  typeList: (params: LeaveTypeListParams) => [...leavesKeys.types(), clean(params)] as const,
  policies: () => [...leavesKeys.all, 'policies'] as const,
  policyList: (params: LeavePolicyListParams) => [...leavesKeys.policies(), clean(params)] as const,
  enrolled: (id: string) => [...leavesKeys.policies(), 'enrolled', id] as const,
  balances: (params: LeaveBalanceParams) => [...leavesKeys.all, 'balances', clean(params)] as const,
  encashments: () => [...leavesKeys.all, 'encashments'] as const,
  employees: (permission: string) => [...leavesKeys.all, 'employees', permission] as const,
  departments: () => [...leavesKeys.all, 'departments'] as const,
  typeOptions: (employeeId: string | undefined, asOf: string | undefined) =>
    [...leavesKeys.all, 'type-options', employeeId ?? 'me', asOf ?? ''] as const,
}

export const leaveApplicationsQueryOptions = (params: LeaveApplicationListParams) =>
  queryOptions({
    queryKey: leavesKeys.applicationList(params),
    queryFn: ({ signal }) => leavesApi.applications(params, signal),
    placeholderData: keepPreviousData,
  })

export const leaveApplicationCountsQueryOptions = (params: LeaveCountParams) =>
  queryOptions({
    queryKey: leavesKeys.applicationCounts(params),
    queryFn: ({ signal }) => leavesApi.applicationCounts(params, signal),
    placeholderData: keepPreviousData,
  })

export const leaveApplicationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: leavesKeys.application(id),
    queryFn: ({ signal }) => leavesApi.application(id, signal),
  })

export const leaveRequestQueryOptions = (id: string) =>
  queryOptions({
    queryKey: leavesKeys.request(id),
    queryFn: ({ signal }) => leavesApi.request(id, signal),
  })

export const leaveSettingsQueryOptions = () =>
  queryOptions({
    queryKey: leavesKeys.settings(),
    queryFn: ({ signal }) => leavesApi.settings(signal),
  })

export const leaveTypesQueryOptions = (params: LeaveTypeListParams) =>
  queryOptions({
    queryKey: leavesKeys.typeList(params),
    queryFn: ({ signal }) => leavesApi.types(params, signal),
    placeholderData: keepPreviousData,
  })

export const leavePoliciesQueryOptions = (params: LeavePolicyListParams) =>
  queryOptions({
    queryKey: leavesKeys.policyList(params),
    queryFn: ({ signal }) => leavesApi.policies(params, signal),
    placeholderData: keepPreviousData,
  })

export const leaveBalancesQueryOptions = (params: LeaveBalanceParams) =>
  queryOptions({
    queryKey: leavesKeys.balances(params),
    queryFn: ({ signal }) => leavesApi.balances(params, signal),
  })
