import { z } from 'zod'

/**
 * `/?month=2026-09`: the month the dashboard's monthly figures cover (new hires, leavers,
 * turnover, attendance by month, the module summaries). Left out for the current month.
 */
export const dashboardSearchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
})
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>
