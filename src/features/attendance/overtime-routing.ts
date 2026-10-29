import { z } from 'zod'

import {
  OVERTIME_APPROVAL_BOXES,
  OVERTIME_POLICY_PERIODS,
  OVERTIME_STATUS_FILTERS,
  OVERTIME_TABS,
} from './types/overtime.types'

const optionalText = z.string().trim().min(1).max(80).optional().catch(undefined)
const optionalDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

/** Defaults left out of the Overtime URL. */
export const OVERTIME_SEARCH_DEFAULTS = { tab: 'my', page: 1 } as const

/**
 * `/attendance/overtime?tab=applications&box=delegates&status=unapproved&q=…&from=…&to=…&employeeId=…&page=2`
 * (`period=daily` on the Overtime Policy tab). The tab is one of the card's inner tabs; the
 * rest are that tab's filters and page.
 */
export const overtimeSearchSchema = z.object({
  tab: z.enum(OVERTIME_TABS).default('my').catch('my'),
  /** Applications: the approvals box (Requested when left out). */
  box: z.enum(OVERTIME_APPROVAL_BOXES).optional().catch(undefined),
  status: z.enum(OVERTIME_STATUS_FILTERS).optional().catch(undefined),
  /** Overtime Policy: Daily / Monthly. */
  period: z.enum(OVERTIME_POLICY_PERIODS).optional().catch(undefined),
  q: optionalText,
  from: optionalDay,
  to: optionalDay,
  employeeId: optionalText,
  page: z.number().int().min(1).default(1).catch(1),
})
export type OvertimeSearch = z.infer<typeof overtimeSearchSchema>
