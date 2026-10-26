import type { TimeWindowDetails } from '../relaxation/time-window'

/**
 * An Official Visit: time away on duty on one day (the API's `time_window`
 * kind, shared with Relaxation; no shift is needed). The purpose is the
 * request's reason, plus a description and an attachment.
 */
export type OfficialVisitPayload = TimeWindowDetails
