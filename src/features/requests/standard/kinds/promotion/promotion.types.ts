/** A Promotion (or Demotion) request as the client sees it. */
export interface PromotionPayload {
  demotion: boolean
  grade: string
  level: string
  designation: string
  jobTitle: string
  /** The person's salary when the request was made ("Previous Salary (RS)"). */
  previousSalary: number
  salary: number
  /** Pay item ids ("pi_eobi", "pi_medical"). */
  benefits: string[]
  benefitNames: string[]
  effectiveDate: string
  attachment: string | null
  description: string
}

export interface PromotionInput {
  employeeId?: string
  demotion: boolean
  grade: string
  level: string
  designation: string
  jobTitle: string
  salary: number
  benefits: string[]
  effectiveDate: string
  attachment: string | null
  description: string
}

export interface PromotionLookups {
  grades: string[]
  levels: string[]
  designations: string[]
  jobTitles: string[]
  benefits: { value: string; label: string }[]
  /** Each person's salary, grade and job title now. */
  current: Record<string, { salary: number; grade: string; jobTitle: string }>
}
