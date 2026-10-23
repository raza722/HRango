import { z } from 'zod'

import { REQUEST_STATUSES } from '@/features/requests'

/** Defaults left out of the list URLs. */
export const LEAVE_LIST_SEARCH_DEFAULTS = { page: 1 } as const

/** `/leaves/my-leaves?status=pending&page=2`, the same for `/leaves/applications`. */
export const leaveListSearchSchema = z.object({
  status: z.enum(REQUEST_STATUSES).optional().catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
})
export type LeaveListSearch = z.infer<typeof leaveListSearchSchema>

/** Defaults left out of the Settings list URLs. */
export const LEAVE_PAGE_SEARCH_DEFAULTS = { page: 1 } as const

/**
 * `/leaves/settings/leave-types?page=2&dialog=add`, the same for
 * `/leaves/settings/policies`; `dialog=add` opens "+ Add New"'s popup.
 */
export const leavePageSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  dialog: z.enum(['add']).optional().catch(undefined),
})
export type LeavePageSearch = z.infer<typeof leavePageSearchSchema>
