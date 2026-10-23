import { z } from 'zod'

import { CATEGORY_VALUES } from './categories'

/** The tabs: `?year=` is the "Showing:" plan year (absent: All Plan Years). */
export const benefitsSearchSchema = z.object({
  year: z.string().min(1).optional().catch(undefined),
})
export type BenefitsSearch = z.infer<typeof benefitsSearchSchema>

/** Employees: `?missing=true` keeps the people with missing information. */
export const benefitEmployeesSearchSchema = benefitsSearchSchema.extend({
  missing: z.boolean().optional().catch(undefined),
})
export type BenefitEmployeesSearch = z.infer<typeof benefitEmployeesSearchSchema>

/** Add Plan: the category chosen in the Add New Plan menu. */
export const addPlanSearchSchema = z.object({
  category: z.enum(CATEGORY_VALUES).default('medical').catch('medical'),
})
export type AddPlanSearch = z.infer<typeof addPlanSearchSchema>
