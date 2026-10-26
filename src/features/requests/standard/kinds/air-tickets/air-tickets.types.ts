/** An air ticket claim's `details` as the API sends them (`/requests/air-ticket`). */
export interface AirTicketPayload {
  title: string
  claimDate: string | null
  travelDate: string
  fromPlace: string | null
  toPlace: string | null
  amount: number
  /** Set by an approver (never above the claim); the claim is paid at this amount. */
  approvedAmount: number | null
  currency: string | null
  description: string | null
  /** The ticket: an upload, with a signed link. */
  fileId: string | null
  fileName: string | null
  fileUrl?: string | null
  openingBalanceId: string | null
  /** The payroll month the approved claim is paid in. */
  paidInMonth: string | null
}

/** `AirTicketDetails` as the form sends them. */
export interface AirTicketDetailsInput {
  title: string
  claimDate: string | null
  travelDate: string
  fromPlace: string | null
  toPlace: string | null
  amount: number
  description: string | null
  fileId: string | null
}
