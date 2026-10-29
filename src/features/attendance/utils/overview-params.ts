import { OVERVIEW_PAGE_SIZE } from '../constants'
import type { OverviewSearch } from '../routing'
import type { OverviewParams } from '../types/attendance.types'

/** The overview request for the URL state and the month shown (`yyyy-MM`). */
export function overviewParams(search: OverviewSearch, month: string): OverviewParams {
  return {
    scope: search.scope,
    month,
    page: search.page,
    pageSize: OVERVIEW_PAGE_SIZE,
    ...(search.q ? { search: search.q } : {}),
    ...(search.status !== 'all' ? { status: search.status } : {}),
    ...(search.departmentId ? { departmentId: search.departmentId } : {}),
  }
}
