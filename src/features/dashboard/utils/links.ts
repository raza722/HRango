import type { AppPath } from '@/app/navigation'
import type { DayStatus } from '@/features/attendance'
import { REQUEST_TYPE_CODES } from '@/features/requests'

/** Where a tile or card opens (typed like the sidebar's links). */
export interface DashLink {
  to: AppPath
  params?: Record<string, string>
  search?: Record<string, string | number | boolean>
}

/** A From–To range of days, `yyyy-MM-dd`. */
export interface DayRange {
  from: string
  to: string
}

/** Everyone's time sheet for one day or a range (and one state). */
export function timeSheetLink(days: string | DayRange, dayStatus?: DayStatus): DashLink {
  const { from, to } = typeof days === 'string' ? { from: days, to: days } : days
  return {
    to: '/attendance/time-sheet',
    search: { scope: 'all', from, to, ...(dayStatus ? { dayStatus } : {}) },
  }
}

const SLUG_BY_CODE = new Map<string, string>(
  Object.entries(REQUEST_TYPE_CODES).map(([slug, code]) => [code, slug]),
)

/** Request types with a page of their own; the rest share `/requests/$type`. */
const OWN_PAGE: Partial<Record<string, AppPath>> = {
  punch: '/requests/punch',
  shift: '/requests/shift',
  transfer: '/requests/transfer',
}

/** Where a request type's approvals are decided (its Approvals tab, pending first). */
export function approvalsLink(type: string): DashLink {
  if (type === 'overtime') return { to: '/attendance/overtime', search: { tab: 'applications' } }
  const slug = SLUG_BY_CODE.get(type)
  if (!slug) return { to: '/requests/punch', search: { tab: 'approvals' } }
  const search = { tab: 'approvals', status: 'pending' }
  const own = OWN_PAGE[slug]
  return own ? { to: own, search } : { to: '/requests/$type', params: { type: slug }, search }
}
