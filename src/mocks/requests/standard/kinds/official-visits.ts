import { addDays, format } from 'date-fns'
import { z } from 'zod'

import { entryOn } from '../../effects'
import { invalid } from '../../http'
import {
  defineStandardKind,
  type PayloadContext,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import {
  timeWindowDetails,
  timeWindowFromBody,
  timeWindowHeader,
  type TimeWindowStored,
} from './time-window'

/*
 * Official Visit: time away on duty on one day, on the API's `time_window`
 * kind (shared with Relaxation, ./time-window.ts). No shift is needed; the
 * day's shift, when there is one, is kept for the Time Slot. The purpose is
 * the reason, with a description and attachments. Approval only: the mock
 * changes nothing in Attendance.
 */

const ymd = /^\d{4}-\d{2}-\d{2}$/
const hm = /^([01]\d|2[0-3]):[0-5]\d$/
const schema = z.object({
  date: z.string().regex(ymd, 'Date is required.'),
  startTime: z.string().regex(hm, 'Start time is required.'),
  endTime: z.string().regex(hm, 'End time is required.'),
  reason: z.string().trim().max(4000),
  description: z.string().trim().max(4000),
})
type Input = z.infer<typeof schema>

export interface OfficialVisitStored extends TimeWindowStored {
  description: string
}

const stored = (record: StoredStandardRequest) => record.payload as unknown as OfficialVisitStored
const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function toPayload(input: Input, context: PayloadContext): Response | Record<string, unknown> {
  if (minutesOf(input.endTime) <= minutesOf(input.startTime)) {
    return invalid('End time must be after the start time.', {
      endTime: 'End time must be after the start time.',
    })
  }
  const clash = context.records.find((record) => {
    if (record.id === context.ignoreId || record.employeeId !== context.employeeId) return false
    if (!['pending', 'completed', 'cancelling'].includes(record.status)) return false
    const other = stored(record)
    return (
      other.date === input.date &&
      minutesOf(other.startTime) < minutesOf(input.endTime) &&
      minutesOf(other.endTime) > minutesOf(input.startTime)
    )
  })
  if (clash) {
    return invalid('Another request on this date overlaps these times.', {
      startTime: 'Another request on this date overlaps these times.',
    })
  }
  const entry = entryOn(context.employeeId, input.date)
  const shift = entry?.kind === 'shift' && entry.clockIn && entry.clockOut ? entry : null
  const payload: OfficialVisitStored = {
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    reason: input.reason,
    description: input.description,
    slotName: shift ? shift.slot.name : null,
    shiftIn: shift?.clockIn ?? null,
    shiftOut: shift?.clockOut ?? null,
  }
  return { ...payload }
}

const def: StandardKindServer<Input> = {
  kind: 'official-visits',
  typeCode: 'official_visit',
  typeName: 'Official Visit',
  backendKind: 'time_window',
  settingsType: 'official_visit',
  codePrefix: 'OV-',
  codeDigits: 4,
  fromBody: timeWindowFromBody,
  schema,
  toPayload,
  dateOf: (payload) => String(payload.date),
  header: (payload) => timeWindowHeader(payload as unknown as OfficialVisitStored),
  toDetails: (payload) =>
    timeWindowDetails('official_visit', payload as unknown as OfficialVisitStored),
  seed: () => {
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
    const make = (
      number: number,
      employeeId: string,
      offset: number,
      status: StoredStandardRequest['status'],
      visit: { start: string; end: string; reason: string; description: string; daysAgo: number },
    ): StoredStandardRequest => {
      const date = day(offset)
      const entry = entryOn(employeeId, date)
      const shift = entry?.kind === 'shift' && entry.clockIn && entry.clockOut ? entry : null
      const digits = String(number).padStart(4, '0')
      return seedRequest(def, {
        id: `ov_${digits}`,
        code: `OV-${digits}`,
        employeeId,
        payload: {
          date,
          startTime: visit.start,
          endTime: visit.end,
          reason: visit.reason,
          description: visit.description,
          slotName: shift ? shift.slot.name : null,
          shiftIn: shift?.clockIn ?? null,
          shiftOut: shift?.clockOut ?? null,
        } satisfies OfficialVisitStored,
        at: at(visit.daysAgo),
        status,
      })
    }
    return [
      make(1, 'em_sadia', 3, 'pending', {
        start: '10:00',
        end: '13:00',
        reason: 'Client site visit for the audit kick-off.',
        description: 'Meeting at the client’s head office.',
        daysAgo: 1,
      }),
      make(2, 'em_haroon', 5, 'pending', {
        start: '14:00',
        end: '16:30',
        reason: 'Vendor meeting for the new laptops.',
        description: '',
        daysAgo: 2,
      }),
      make(3, 'em_shelley', 4, 'pending', {
        start: '11:00',
        end: '12:30',
        reason: 'Job fair at the university.',
        description: 'Campus hiring drive.',
        daysAgo: 1,
      }),
      make(4, 'em_shelley', -7, 'completed', {
        start: '09:30',
        end: '12:00',
        reason: 'Labour office filing.',
        description: '',
        daysAgo: 10,
      }),
      make(5, 'em_omer', -3, 'rejected', {
        start: '15:00',
        end: '17:00',
        reason: 'Bank branch visit.',
        description: '',
        daysAgo: 5,
      }),
    ]
  },
}

export const officialVisitsServer = defineStandardKind(def)
