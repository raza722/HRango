import type { ReactNode } from 'react'
import { format, parse } from 'date-fns'

import { EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import { PUNCH_TYPE_LABELS } from '../../constants'
import type { AnyRequest, RequestEmployee } from '../../types/requests.types'
import { clock, longDate, stamp } from '../../utils/request-format'
import { StatusChip } from '../shared/request-controls'

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
            {format(parse(employee.joiningDate, 'yyyy-MM-dd', new Date()), 'd MMMM yyyy')}
          </Fact>
        </dl>
      </div>
    </section>
  )
}

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
          <Fact label="Date">{longDate(request.payload.date)}</Fact>
          <Fact label="Punch Type">{PUNCH_TYPE_LABELS[request.payload.punchType]}</Fact>
          <Fact label="Expected Check In">{clock(request.payload.expectedIn)}</Fact>
          <Fact label="Expected Check Out">{clock(request.payload.expectedOut)}</Fact>
          <Fact label="Punch Time">{clock(request.payload.punchTime)}</Fact>
        </>
      ) : request.kind === 'transfer' ? (
        <>
          <Fact label="Effective Date">{longDate(request.payload.effectiveDate)}</Fact>
          <Fact label="Transfer To">
            {`${request.payload.branch.name}, ${request.payload.location.name} (${request.payload.department})`}
          </Fact>
        </>
      ) : (
        <>
          <Fact label="Date">{longDate(request.payload.date)}</Fact>
          <Fact label="Time Roster">
            {request.payload.rosterTitle ?? (request.payload.swapWith ? 'Swap' : '—')}
          </Fact>
          <Fact label="Swap From">{request.payload.swapFrom ?? '—'}</Fact>
          <Fact label="Swap To">
            {request.payload.swapWith
              ? `${request.payload.swapWith.name}${request.payload.swapToShift ? `, ${request.payload.swapToShift}` : ''}`
              : '—'}
          </Fact>
        </>
      )}
      <div className="@2xl:col-span-2">
        <Fact label="Description">{request.payload.description || '—'}</Fact>
      </div>
      <Fact label="Created">
        {stamp(request.createdAt)} by {request.createdBy.name}
      </Fact>
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
                  `${consent.person.name}: ${consent.status === 'pending' ? 'waiting' : consent.status}`,
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
