import type { ReactNode } from 'react'
import { format, parse } from 'date-fns'

import { EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import { PUNCH_TYPE_LABELS } from '../../constants'
import type { AnyRequest, RequestEmployee } from '../../types/requests.types'
import { clock, longDate, stamp } from '../../utils/request-format'
import { StatusChip } from '../shared/request-controls'
import { RequestFileLinks } from '../shared/request-files'

/**
 * A label and its value. Figma: the request's fields have Inter Regular 16 #000
 * labels and Inter Regular 14 #475569 values; the employee card (`person`) has
 * Inter Semi Bold 17 labels and Inter Regular 16 values, both #000.
 */
function Fact({
  label,
  person = false,
  children,
}: {
  label: string
  person?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] items-baseline gap-2 font-inter text-sm">
      <dt
        className={cn('text-heading sm:text-base', person && 'font-semibold sm:text-[1.0625rem]')}
      >
        {label}
      </dt>
      <dd className={cn('min-w-0', person ? 'text-heading sm:text-base' : 'text-field-value')}>
        {children}
      </dd>
    </div>
  )
}

/** Employee card of the View / Approve popups. */
export function RequestPersonCard({ employee }: { employee: RequestEmployee }) {
  return (
    <section
      aria-label="Employee"
      className="flex flex-col gap-4 rounded-md border px-4 py-4 @xl:flex-row @xl:items-center"
    >
      <EmployeeAvatar
        name={employee.name}
        photoUrl={employee.photoUrl}
        className="size-16 shrink-0"
        fallbackClassName="text-lg"
      />
      <div className="grid min-w-0 flex-1 gap-3">
        <p className="font-inter text-xl font-medium text-heading sm:text-2xl">{employee.name}</p>
        <dl className="grid gap-x-6 gap-y-2 @2xl:grid-cols-2">
          <Fact person label="Employee Code">
            {employee.code}
          </Fact>
          <Fact person label="Job Title">
            {employee.designation}
          </Fact>
          <Fact person label="Company">
            {employee.company ?? '—'}
          </Fact>
          <Fact person label="Branch">
            {employee.branch ?? '—'}
          </Fact>
          <Fact person label="Department">
            {employee.department}
          </Fact>
          <Fact person label="Location">
            {employee.location ?? '—'}
          </Fact>
          <Fact person label="Joining Date">
            {employee.joiningDate
              ? format(parse(employee.joiningDate, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy')
              : '—'}
          </Fact>
        </dl>
      </div>
    </section>
  )
}

const dateOrDash = (date: string | null) => (date ? longDate(date) : '—')

/** The request's own fields, then who created it and when. */
export function RequestFields({ request }: { request: AnyRequest }) {
  const approvals = request.flow.filter((step) => step.remarks)
  return (
    <dl className="grid gap-x-6 gap-y-3 @2xl:grid-cols-2">
      <Fact label="Code">{request.code}</Fact>
      <Fact label="Status">
        <StatusChip status={request.status} />
      </Fact>
      {request.kind === 'punch' ? (
        <>
          <Fact label="Date">{dateOrDash(request.payload.punchDate ?? request.fromDate)}</Fact>
          <Fact label="Punch Type">{PUNCH_TYPE_LABELS[request.payload.punchType]}</Fact>
          <Fact label="Punch Time">{clock(request.payload.punchTime)}</Fact>
        </>
      ) : request.kind === 'transfer' ? (
        <>
          <Fact label="Effective Date">{dateOrDash(request.payload.effectiveDate)}</Fact>
          <Fact label="Transfer To">
            {`${request.payload.branchName ?? '—'}, ${request.payload.locationName ?? '—'} (${request.payload.departmentName ?? '—'})`}
          </Fact>
        </>
      ) : (
        <>
          <Fact label="Date">{dateOrDash(request.payload.shiftDate ?? request.fromDate)}</Fact>
          <Fact label="Time Slot">
            {request.payload.timeSlotName ?? (request.payload.withEmployeeId ? 'Swap' : '—')}
          </Fact>
          <Fact label="Swap From">{request.payload.fromTimeSlotName ?? '—'}</Fact>
          <Fact label="Swap To">
            {request.payload.withEmployeeId
              ? `${request.payload.withEmployeeName ?? '—'}${request.payload.toTimeSlotName ? `, ${request.payload.toTimeSlotName}` : ''}`
              : '—'}
          </Fact>
        </>
      )}
      {request.reason && (
        <div className="@2xl:col-span-2">
          <Fact label="Reason">{request.reason}</Fact>
        </div>
      )}
      <div className="@2xl:col-span-2">
        <Fact label="Description">{request.description ?? '—'}</Fact>
      </div>
      {request.attachments.length > 0 && (
        <div className="@2xl:col-span-2">
          <Fact label="Attachments">
            <RequestFileLinks files={request.attachments} />
          </Fact>
        </div>
      )}
      <Fact label="Created">{stamp(request.createdAt)}</Fact>
      {request.currentStep && (
        <Fact label="Next Requestee">
          {request.currentStep.approver.name} ({request.currentStep.authority})
        </Fact>
      )}
      {request.consents.length > 0 && (
        <div className="@2xl:col-span-2">
          <Fact label="Consent">
            {request.consents
              .map(
                (consent) =>
                  `${consent.person.name}: ${consent.status === 'pending' ? 'waiting' : consent.status === 'given' ? 'agreed' : 'disagreed'}`,
              )
              .join(', ')}
          </Fact>
        </div>
      )}
      {request.cancelReason && (
        <div className="@2xl:col-span-2">
          <Fact label="Cancellation">{request.cancelReason}</Fact>
        </div>
      )}
      {approvals.length > 0 && (
        <div className="@2xl:col-span-2">
          <Fact label="Approval Remarks">
            <ul className="grid gap-1">
              {approvals.map((step) => (
                <li key={`${step.authority}-${step.approver.id}`}>
                  <span className="font-medium">{step.authority}:</span> {step.remarks}
                </li>
              ))}
            </ul>
          </Fact>
        </div>
      )}
    </dl>
  )
}
