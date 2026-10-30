import type { AppPath } from '@/app/navigation'
import type { DayStatus } from '@/features/attendance'
import { REQUEST_TYPE_CODES } from '@/features/requests'

/** Where a tile or card opens (typed like the sidebar's links). */
export interface DashLink {
  to: AppPath
  params?: Record<string, string>
  search?: Record<string, string | number | boolean>
}

/** Everyone's time sheet for one day (and one state). */
export function timeSheetLink(day: string, dayStatus?: DayStatus): DashLink {
  return {
    to: '/attendance/time-sheet',
    search: { scope: 'all', from: day, to: day, ...(dayStatus ? { dayStatus } : {}) },
  }
}

const SLUG_BY_CODE = new Map<string, string>(
  Object.entries(REQUEST_TYPE_CODES).map(([slug, code]) => [code, slug]),
)

/** Where a request type's approvals are decided (its Approvals tab, pending first). */
export function approvalsLink(type: string): DashLink {
  if (type === 'overtime') return { to: '/attendance/overtime', search: { tab: 'applications' } }
  const slug = SLUG_BY_CODE.get(type)
  if (!slug) return { to: '/requests/punch', search: { tab: 'approvals' } }
  return {
    to: '/requests/$type',
    params: { type: slug },
    search: { tab: 'approvals', status: 'pending' },
  }
}
