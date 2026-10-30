import { queryOptions } from '@tanstack/react-query'

import { type BackendRequestPage, requestKeys } from '@/features/requests'
import { apiClient } from '@/lib/axios'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'
import type { ApiItem } from '@/types/api'
import type { AuthUser } from '@/types/auth'

// ---------------------------------------------------------------- API shapes (`/api/dashboard/*`)

export interface CountItem {
  id: string | null
  name: string
  count: number
}

export interface GenderCount {
  gender: string
  count: number
}

export interface AgeBand {
  band: string
  male: number
  female: number
  other: number
}

export interface MonthTurnover {
  /** First day of the month, `yyyy-MM-dd`. */
  month: string
  hired: number
  left: number
}

export interface DepartmentGender {
  id: string | null
  name: string
  men: number
  women: number
}

export interface JobTitleWomen {
  id: string | null
  name: string
  total: number
  women: number
  womenPercent: number
}

/** Employee figures (CEO and HR dashboards). Employed = active, probation or notice. */
export interface Workforce {
  month: string
  headcount: number
  women: number
  men: number
  womenPercent: number
  hired: number
  left: number
  turnoverPercent: number
  byDepartment: CountItem[]
  byEmploymentType: CountItem[]
  byGender: GenderCount[]
  byAge: AgeBand[]
  turnoverByMonth: MonthTurnover[]
  byDepartmentGender: DepartmentGender[]
  womenByJobTitle: JobTitleWomen[]
}

export interface MonthAttendance {
  month: number
  present: number
  absent: number
  onLeave: number
}

export interface AttendanceRow {
  employeeId: string
  employeeName: string
  designationName: string | null
  firstIn: string | null
  lastOut: string | null
  status: string | null
}

/** From the time sheet of `day`: present (incl. half / short day, WFH, official visit), absent, on leave. */
export interface DashboardAttendance {
  day: string
  present: number
  absent: number
  onLeave: number
  absenteeismPercent: number
  byMonth: MonthAttendance[]
  rows: AttendanceRow[]
}

export interface LeaveApplication {
  id: string
  employeeId: string
  employeeName: string
  designationName: string | null
  appliedAt: string | null
  fromDate: string | null
  toDate: string | null
  /** Decimal from the API (half days). */
  days: number | string | null
  reason: string | null
  status: string
}

export interface Notice {
  id: string
  kind: string
  title: string
  body: string | null
  eventDate: string | null
  publishFrom: string | null
  createdAt: string
}

export interface CeoDashboard {
  workforce: Workforce
  attendance: DashboardAttendance
  leaveApplications: LeaveApplication[]
}

export interface HrDashboard extends CeoDashboard {
  noticeBoard: Notice[]
  upcomingEvents: Notice[]
}

export interface MyDashboard {
  employeeId: string | null
  attendance: DashboardAttendance
  leaveApplications: LeaveApplication[]
  noticeBoard: Notice[]
  upcomingEvents: Notice[]
}

/** Which dashboard: `hr` (`dashboard.hr.view`), `ceo` (`dashboard.ceo.view`), `me` (`dashboard.employee.view`). */
export type DashboardKind = 'hr' | 'ceo' | 'me'

export interface DashboardByKind {
  hr: HrDashboard
  ceo: CeoDashboard
  me: MyDashboard
}

export type AnyDashboard = HrDashboard | CeoDashboard | MyDashboard

const PATHS: Record<DashboardKind, string> = {
  hr: '/dashboard/hr',
  ceo: '/dashboard/ceo',
  me: '/dashboard/me',
}

/** Optional query: `month` (any day of the month the KPIs cover), `day` (the attendance day). */
export interface DashboardParams {
  month?: string | undefined
  day?: string | undefined
}

/**
 * The dashboard this user sees on the landing page: HR first, then CEO, then their own.
 * `null` when they hold none of the three (the page then shows empty tiles). Everyone sees the
 * HR dashboard in mock mode (no permissions list).
 */
export function dashboardKindFor(user: AuthUser | null): DashboardKind | null {
  if (can(user, 'dashboard.hr.view')) return 'hr'
  if (can(user, 'dashboard.ceo.view')) return 'ceo'
  if (can(user, 'dashboard.employee.view')) return 'me'
  return null
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
  dashboard: (kind: DashboardKind, params: DashboardParams = {}) =>
    [...dashboardKeys.all, kind, params] as const,
  /** Kept for older imports: the summary is read from the landing page's dashboard. */
  summary: ['dashboard', 'summary'] as const,
}

/**
 * The query for a chosen month (`yyyy-MM`, from `?month=`): its first day. The current month
 * sends nothing, so the route loader and the page share one cache entry.
 */
export function dashboardParamsFor(month: string | undefined): DashboardParams {
  return month ? { month: `${month}-01` } : {}
}

function compact(params: DashboardParams): Record<string, string> {
  const out: Record<string, string> = {}
  if (params.month) out.month = params.month
  if (params.day) out.day = params.day
  return out
}

export function dashboardQueryOptions<K extends DashboardKind>(
  kind: K,
  params: DashboardParams = {},
) {
  return queryOptions({
    queryKey: dashboardKeys.dashboard(kind, compact(params)),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<ApiItem<DashboardByKind[K]>>(PATHS[kind], {
        params: compact(params),
        signal,
      })
      return data.data
    },
  })
}

// ---------------------------------------------------------------- requests waiting for the caller

/** One request type's requests waiting for the caller's decision. */
export interface WaitingType {
  /** The API's type code (`leave`, `shift_swap`, `overtime` …). */
  type: string
  name: string
  count: number
}

export interface WaitingApprovals {
  total: number
  /** Most first. */
  byType: WaitingType[]
}

/** The approval boxes a decision can wait in (consents are agreements, not approvals). */
const WAITING_BOXES = ['requested', 'delegates', 'cancellations'] as const
const WAITING_PAGE = 100

/**
 * Requests of every type waiting for the caller: `GET /requests/approvals?box=&status=pending`
 * for the requested, delegated and cancellation boxes (pending there means "waiting for you"),
 * as Leaves reads its own. Kept under the requests module's key, so its changes refresh it.
 */
export function waitingApprovalsQueryOptions() {
  return queryOptions({
    queryKey: [...requestKeys.all, 'approvals', 'waiting-for-me'] as const,
    queryFn: async ({ signal }): Promise<WaitingApprovals> => {
      const pages = await Promise.all(
        WAITING_BOXES.map(async (box) => {
          const { data } = await apiClient.get<BackendRequestPage>('/requests/approvals', {
            params: { box, status: 'pending', page: 1, pageSize: WAITING_PAGE },
            signal,
          })
          return data
        }),
      )
      const seen = new Map<string, { type: string; name: string }>()
      let unread = 0
      for (const page of pages) {
        for (const row of page.data) {
          seen.set(row.id, { type: row.requestType, name: row.requestTypeName })
        }
        // Past the first page the rows are not read: count them by the total.
        unread += Math.max(0, page.meta.total - page.data.length)
      }
      const types = new Map<string, WaitingType>()
      for (const { type, name } of seen.values()) {
        const current = types.get(type)
        if (current) current.count += 1
        else types.set(type, { type, name, count: 1 })
      }
      return {
        total: seen.size + unread,
        byType: [...types.values()].sort(
          (a, b) => b.count - a.count || a.name.localeCompare(b.name),
        ),
      }
    },
  })
}

// ---------------------------------------------------------------- the landing page's key figures

/**
 * Key figures of the landing page. `null` means the API does not provide the figure for this
 * dashboard (e.g. headcount on the employee's own dashboard, open positions anywhere).
 */
export interface DashboardSummary {
  kind: DashboardKind
  headcount: number | null
  presentToday: number | null
  onLeave: number | null
  /** Recruitment / manpower feeds are not on the dashboard API yet. */
  openPositions: number | null
}

export function toDashboardSummary(kind: DashboardKind, data: AnyDashboard): DashboardSummary {
  return {
    kind,
    headcount: 'workforce' in data ? data.workforce.headcount : null,
    presentToday: data.attendance.present,
    onLeave: data.attendance.onLeave,
    openPositions: null,
  }
}

/**
 * The summary of the dashboard the signed-in user sees (HR, CEO or their own, see
 * {@link dashboardKindFor}); shares its cache entry with {@link dashboardQueryOptions}.
 */
export function dashboardSummaryQueryOptions(
  kind: DashboardKind = dashboardKindFor(useAuthStore.getState().user) ?? 'me',
) {
  return queryOptions({
    ...dashboardQueryOptions(kind),
    select: (data: AnyDashboard) => toDashboardSummary(kind, data),
  })
}
