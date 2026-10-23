/** A Resignation request as the client sees it. */
export interface ResignationPayload {
  /** "voluntary", "retirement" or "contract-end"; `typeLabel` is its word. */
  type: string
  typeLabel: string
  resignationDate: string
  /** The design puts it on the request (the requirements put it on the approval). */
  lastWorkingDate: string
  /** Days from the resignation date to the last working date. */
  noticeDays: number
  /** "30 days". */
  noticePeriod: string
  reason: string
  attachmentName: string | null
  /** The End of Employment record the approval opened in Off-boarding, if any. */
  endOfEmploymentId: string | null
}

export interface ResignationInput {
  employeeId?: string
  type: string
  resignationDate: string
  lastWorkingDate: string
  reason: string
  attachmentName: string | null
}

export interface ResignationLookups {
  types: { value: string; label: string }[]
}
