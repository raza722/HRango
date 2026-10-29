import { z } from 'zod'

import { LEAVE_STATUSES } from './types/leaves.types'

/** Defaults left out of the list URLs. */
export const LEAVE_LIST_SEARCH_DEFAULTS = { page: 1 } as const

/**
 * `/leaves/my-leaves?status=pending&page=2`, the same for `/leaves/applications`, which also
 * takes `tab=subordinates` (the backend's My / Subordinates / All; All when left out) and
 * `employeeId` (one person's applications, as a profile's link opens them).
 */
export const leaveListSearchSchema = z.object({
  status: z.enum(LEAVE_STATUSES).optional().catch(undefined),
  tab: z.enum(['subordinates', 'all']).optional().catch(undefined),
  employeeId: z.string().trim().min(1).max(64).optional().catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
})
export type LeaveListSearch = z.infer<typeof leaveListSearchSchema>

/** Defaults left out of the Settings list URLs. */
export const LEAVE_PAGE_SEARCH_DEFAULTS = { page: 1 } as const

/**
 * `/leaves/settings/leave-types?page=2&dialog=add`, the same for
 * `/leaves/settings/policies`; `dialog=add` opens "+ Add New"'s popup and
 * `dialog=allotment` (Leave Types) the allotment / carry forward run.
 */
export const leavePageSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  dialog: z.enum(['add', 'allotment']).optional().catch(undefined),
})
export type LeavePageSearch = z.infer<typeof leavePageSearchSchema>
