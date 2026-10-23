import { z } from 'zod'

import { REQUEST_STATUSES } from '../types/requests.types'
import { STANDARD_APPROVAL_VIEWS } from './standard.types'

/** Defaults left out of the URL. */
export const STANDARD_SEARCH_DEFAULTS = {
  tab: 'request',
  scope: 'my',
  view: 'requested',
  page: 1,
} as const

/**
 * `/requests/leave?tab=approvals&view=delegates&status=pending&page=2`; the
 * Settings tab (Loan & Advances) keeps its own page in `section`.
 */
export const standardSearchSchema = z.object({
  tab: z.enum(['request', 'approvals', 'settings']).default('request').catch('request'),
  scope: z.enum(['my', 'all']).default('my').catch('my'),
  view: z.enum(STANDARD_APPROVAL_VIEWS).default('requested').catch('requested'),
  status: z.enum(REQUEST_STATUSES).optional().catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
  section: z.string().max(40).optional().catch(undefined),
})
export type StandardSearch = z.infer<typeof standardSearchSchema>
