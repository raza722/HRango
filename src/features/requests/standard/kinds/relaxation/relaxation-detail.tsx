import type { StandardRequest } from '../../standard.types'
import type { RelaxationPayload } from './relaxation.types'
import { TimeWindowDetailRows } from './time-window-parts'

/** The request's fields in the View and Approve/Reject popups. */
export function RelaxationDetail({ request }: { request: StandardRequest<RelaxationPayload> }) {
  return <TimeWindowDetailRows request={request} reasonLabel="Reason" extras={false} />
}
