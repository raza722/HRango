import type { NamedRef } from '../../../types/requests.types'

/** `details` of a Promotion (or Demotion) request, as the API sends them. */
export interface PromotionPayload {
  isDemotion: boolean
  gradeId: string
  gradeName: string | null
  jobLevelId: string | null
  jobLevelName: string | null
  designationId: string
  designationName: string | null
  jobTitleId: string
  jobTitleName: string | null
  /** The salary payroll had when the request was made ("Previous Salary (RS)"); null if none. */
  previousSalary: number | null
  newSalary: number
  /** yyyy-MM-dd. */
  effectiveDate: string | null
  /** Benefit pay items ("Benefits (EOBI, Medical)"). */
  benefits: { payItemId: string; payItemName: string | null }[]
}

/** `details` of POST / PUT /requests/promotion. */
export interface PromotionDetailsIn {
  isDemotion: boolean
  gradeId: string
  jobLevelId: string | null
  designationId: string
  jobTitleId: string
  newSalary: number
  effectiveDate: string
  benefitPayItemIds: string[]
}

export interface PromotionLookups {
  grades: NamedRef[]
  levels: NamedRef[]
  designations: NamedRef[]
  jobTitles: NamedRef[]
  /** Benefit pay items (`GET /payroll/pay-items`, `isBenefit`; needs payroll settings). */
  benefits: NamedRef[]
}
