import type { StandardRequest } from '../../standard.types'
import { TimeWindowDetailRows } from '../relaxation/time-window-parts'
import type { OfficialVisitPayload } from './official-visits.types'

/** The visit's fields in the View and Approve/Reject popups. */
export function OfficialVisitDetail({
  request,
}: {
  request: StandardRequest<OfficialVisitPayload>
}) {
  return <TimeWindowDetailRows request={request} reasonLabel="Purpose of Visit" extras />
}
