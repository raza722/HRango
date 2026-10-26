/** The API's resignation types. */
export const RESIGNATION_TYPES = ['resignation', 'voluntary', 'retirement', 'contract_end'] as const
export type ResignationType = (typeof RESIGNATION_TYPES)[number]

/** `details` of a Resignation request, as the API sends them. */
export interface ResignationPayload {
  resignationType: ResignationType
  /** yyyy-MM-dd. */
  resignationDate: string | null
  /** Optional on the form (Figma); the approver may set it (FRD: before the final approval). */
  lastWorkingDate: string | null
  noticePeriodDays: number | null
  serveNotice: boolean
}

/** `details` of POST / PUT /requests/resignation. */
export interface ResignationDetailsIn {
  resignationType: ResignationType
  resignationDate: string
  lastWorkingDate: string | null
  noticePeriodDays: number | null
  serveNotice: boolean
}

export interface ResignationLookups {
  types: { value: ResignationType; label: string }[]
}
