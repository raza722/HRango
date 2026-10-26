import type { TimeWindowDetails } from './time-window'

/**
 * A Relaxation request: time off inside the person's shift on one day. The
 * payload is the API's `details` (`time_window`); the reason is the request's.
 */
export type RelaxationPayload = TimeWindowDetails
