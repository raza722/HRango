import { format, parse } from 'date-fns'

import { RequestFileLinks } from '../../../components/shared/request-files'
import { clock } from '../../../utils/request-format'
import type { StandardRequest } from '../../standard.types'
import { StandardReadOnlyRow } from '../../standard-dialogs'
import { durationText, hm, type TimeWindowDetails } from './time-window'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** "Thursday," over "29 Aug 2024", as the lists draw dates. */
export function TwoLineDay({ date }: { date: string }) {
  if (!date) return <>—</>
  const value = day(date)
  return (
    <span className="whitespace-nowrap">
      {format(value, 'EEEE,')}
      <br />
      {format(value, 'd MMM yyyy')}
    </span>
  )
}

/** "RS Morning" over "(09:00 AM - 05:00 PM)": the day's time slot the request was checked against. */
export function SlotCell({ details }: { details: TimeWindowDetails }) {
  if (!details.timeSlotName) return <>—</>
  return (
    <span className="whitespace-nowrap">
      {details.timeSlotName}
      {details.slotStartTime && (
        <>
          <br />({clock(hm(details.slotStartTime))} - {clock(hm(details.slotEndTime))})
        </>
      )}
    </span>
  )
}

/** "01:00 PM -" over "05:00 PM". */
export function TimeRange({ details }: { details: TimeWindowDetails }) {
  return (
    <span className="whitespace-nowrap">
      {clock(hm(details.startTime))} -
      <br />
      {clock(hm(details.endTime))}
    </span>
  )
}

/** The request's fields in the View and Approve/Reject popups. */
export function TimeWindowDetailRows({
  request,
  reasonLabel,
  extras,
}: {
  request: StandardRequest<TimeWindowDetails>
  reasonLabel: string
  extras: boolean
}) {
  const { payload } = request
  const slot = payload.timeSlotName
    ? payload.slotStartTime
      ? `${payload.timeSlotName} (${clock(hm(payload.slotStartTime))} - ${clock(hm(payload.slotEndTime))})`
      : payload.timeSlotName
    : '—'
  return (
    <>
      <StandardReadOnlyRow label="Time Slot" value={slot} />
      <StandardReadOnlyRow
        label="Date"
        value={payload.windowDate ? format(day(payload.windowDate), 'MMMM d, yyyy') : '—'}
      />
      <StandardReadOnlyRow label="Start Time" value={clock(hm(payload.startTime))} />
      <StandardReadOnlyRow label="End Time" value={clock(hm(payload.endTime))} />
      <StandardReadOnlyRow label="Duration" value={durationText(payload.durationMinutes)} />
      <StandardReadOnlyRow label={reasonLabel} value={request.reason ?? '—'} multiline />
      {extras && (
        <>
          <StandardReadOnlyRow label="Description" value={request.description ?? '—'} multiline />
          {request.attachments.length === 0 && (
            <StandardReadOnlyRow
              label="Attachment"
              value={<RequestFileLinks files={request.attachments} />}
            />
          )}
        </>
      )}
    </>
  )
}
