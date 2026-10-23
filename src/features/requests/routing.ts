import { z } from 'zod'

import {
  APPROVAL_VIEWS,
  REQUEST_SCOPES,
  REQUEST_STATUSES,
  REQUEST_TABS,
} from './types/requests.types'

/** Defaults left out of the URL. */
export const REQUEST_SEARCH_DEFAULTS = {
  tab: 'request',
  scope: 'my',
  view: 'requested',
  page: 1,
} as const

/**
 * `/requests/punch?tab=approvals&view=delegates&status=pending&page=2`. Request
 * shows My / All; Approvals shows Requested / Delegates / Consents.
 */
export const requestSearchSchema = z.object({
  tab: z.enum(REQUEST_TABS).default('request').catch('request'),
  scope: z.enum(REQUEST_SCOPES).default('my').catch('my'),
  view: z.enum(APPROVAL_VIEWS).default('requested').catch('requested'),
  status: z.enum(REQUEST_STATUSES).optional().catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
})
export type RequestSearch = z.infer<typeof requestSearchSchema>
