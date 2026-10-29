import { queryOptions } from '@tanstack/react-query'

import { benefitKeys, benefitsApi } from '@/features/benefits'
import { leavesApi, leavesKeys } from '@/features/leaves'
import { offboardingApi, offboardingKeys } from '@/features/offboarding'
import { payrollApi, payrollKeys } from '@/features/payroll'
import { performanceApi, performanceKeys } from '@/features/performance'
import { recruitmentApi, recruitmentKeys } from '@/features/recruitment'
import { warningPoliciesQueryOptions } from '@/features/warning'

/*
 * The module summaries the dashboard shows. Each is built from the module's own query keys and
 * API calls (its barrel exports both), with the same parameters its own screens use where they
 * read the same thing, so the cache is shared: opening a module after the dashboard shows its
 * numbers at once, and a change made there refreshes the dashboard's card.
 */

/** One row is enough to read how many records match (`meta.total`). */
const COUNT_PAGE = { page: 1, pageSize: 1 } as const

/** Payroll Dashboard of a year (`GET /payroll/dashboard?year`): the same read as its page. */
export const payrollDashboardQueryOptions = (year: number) =>
  queryOptions({
    queryKey: payrollKeys.list('dashboard', { year }),
    queryFn: ({ signal }) => payrollApi.dashboard({ year }, signal),
  })

/** The month's payroll runs (`GET /payroll/payrolls?month=yyyy-MM-01`), as Monthly reads them. */
export const monthPayrollsQueryOptions = (month: string) => {
  const params = { page: 1, pageSize: 100, month: `${month}-01` }
  return queryOptions({
    queryKey: payrollKeys.list('payrolls', params),
    queryFn: ({ signal }) => payrollApi.payrolls(params, signal),
  })
}

/** Recruitment Dashboard for a month (`GET /recruitment/dashboard?year&month`). */
export const recruitmentDashboardQueryOptions = (year: number, month: number) =>
  queryOptions({
    queryKey: recruitmentKeys.dashboard({ year, month }),
    queryFn: ({ signal }) => recruitmentApi.dashboard({ year, month }, signal),
  })

const OPEN_OPENINGS = { status: 'open', ...COUNT_PAGE } as const

/** How many job openings are open (Recruitment → Job Openings, status Open). */
export const openOpeningsQueryOptions = () =>
  queryOptions({
    queryKey: recruitmentKeys.list('openings', OPEN_OPENINGS),
    queryFn: ({ signal }) => recruitmentApi.openings(OPEN_OPENINGS, signal),
    select: (page) => page.meta.total,
  })

const ACTIVE_CYCLES = { status: 'active', page: 1, pageSize: 5 } as const

/** Running appraisal cycles, with how many appraisals sit at each stage. */
export const activeCyclesQueryOptions = () =>
  queryOptions({
    queryKey: performanceKeys.cycleList(ACTIVE_CYCLES),
    queryFn: ({ signal }) => performanceApi.cycles(ACTIVE_CYCLES, signal),
  })

const MY_SELF_REVIEWS = { tab: 'my', status: 'self_review', ...COUNT_PAGE } as const
const TEAM_MANAGER_REVIEWS = { tab: 'team', status: 'manager_review', ...COUNT_PAGE } as const

/** Reviews waiting for the caller: their own self review, or their team's manager reviews. */
export const waitingReviewsQueryOptions = (part: 'self' | 'manager') => {
  const params = part === 'self' ? MY_SELF_REVIEWS : TEAM_MANAGER_REVIEWS
  return queryOptions({
    queryKey: performanceKeys.reviewList(params),
    queryFn: ({ signal }) => performanceApi.reviews(params, signal),
    select: (page) => page.meta.total,
  })
}

/** Leave Applications' status counts (All); with a month, the leaves that fall in it. */
export const leaveCountsQueryOptions = (range?: { fromDate: string; toDate: string }) => {
  const params = { tab: 'all' as const, ...(range ? { filters: range } : {}) }
  return queryOptions({
    queryKey: leavesKeys.applicationCounts(params),
    queryFn: ({ signal }) => leavesApi.applicationCounts(params, signal),
  })
}

const PENDING_EXITS = { ...COUNT_PAGE, status: 'pending' }

/** Ends of employment still pending (Separation Management's count). */
export const pendingExitsQueryOptions = () =>
  queryOptions({
    queryKey: offboardingKeys.list('end-of-employment', PENDING_EXITS),
    queryFn: ({ signal }) => offboardingApi.endOfEmployments(PENDING_EXITS, signal),
    select: (page) => page.meta.total,
  })

/** Final settlements still to settle: pending (not calculated) and open (not closed). */
export const settlementsToSettleQueryOptions = () =>
  queryOptions({
    queryKey: payrollKeys.list('final-settlements', { ...COUNT_PAGE, status: 'pending+open' }),
    queryFn: async ({ signal }) => {
      const [pending, open] = await Promise.all([
        payrollApi.finalSettlements({ ...COUNT_PAGE, status: 'pending' }, signal),
        payrollApi.finalSettlements({ ...COUNT_PAGE, status: 'open' }, signal),
      ])
      return { meta: { total: pending.meta.total + open.meta.total } }
    },
    select: (page) => page.meta.total,
  })

/** Benefits' stats row (`GET /benefits/summary`). */
export const benefitsSummaryQueryOptions = () =>
  queryOptions({
    queryKey: benefitKeys.summary(),
    queryFn: ({ signal }) => benefitsApi.summary(signal),
  })

/** The warning policies (first 100: the API has no status filter), to count the active ones. */
export const warningPolicyCountQueryOptions = () =>
  warningPoliciesQueryOptions({ page: 1, pageSize: 100 })
