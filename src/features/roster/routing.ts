import { z } from 'zod'

import { PAGE_SIZE_OPTIONS } from '@/lib/constants'

import { ROSTER_PAGE_SIZE } from './constants'

export const ROSTER_DIALOGS = ['add', 'edit', 'view', 'enroll'] as const

const isPageSize = (value: number) => PAGE_SIZE_OPTIONS.some((size) => size === value)

/** Defaults left out of the URL. */
export const ROSTER_SEARCH_DEFAULTS = { page: 1, pageSize: ROSTER_PAGE_SIZE } as const

/**
 * `/roster?page=1&pageSize=10&q=…&dialog=edit&id=rg_x`. The open modal lives
 * in the URL, so Back closes it and a link can open it. Bad values fall back.
 */
export const rosterSearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  pageSize: z.number().int().refine(isPageSize).default(ROSTER_PAGE_SIZE).catch(ROSTER_PAGE_SIZE),
  q: z.string().trim().max(80).optional().catch(undefined),
  dialog: z.enum(ROSTER_DIALOGS).optional().catch(undefined),
  id: z.string().min(1).optional().catch(undefined),
})
