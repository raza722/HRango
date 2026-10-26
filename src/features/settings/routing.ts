import { z } from 'zod'

import { PAGE_SIZE_OPTIONS } from '@/lib/constants'

export const ORG_LIST_PAGE_SIZE = 10

/** Defaults left out of the URL (see `stripSearchParams` in the routes). */
export const ORG_LIST_SEARCH_DEFAULTS = { page: 1, pageSize: ORG_LIST_PAGE_SIZE } as const

const isPageSize = (value: number) => PAGE_SIZE_OPTIONS.some((size) => size === value)

/**
 * `?page=2&pageSize=20&q=lah` for every Control Panel list. Bad values fall
 * back to the defaults instead of throwing.
 */
export const orgListSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z
    .number()
    .int()
    .refine(isPageSize)
    .default(ORG_LIST_PAGE_SIZE)
    .catch(ORG_LIST_PAGE_SIZE),
  q: z.string().trim().max(80).optional().catch(undefined),
})

/** Areas and Branches can be narrowed to one location (`?locationId=`). */
export const locationFilteredSearchSchema = orgListSearchSchema.extend({
  locationId: z.string().min(1).optional().catch(undefined),
})
