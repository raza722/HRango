import { type ReactNode, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { ErrorState } from '@/components/feedback/error-state'
import { TextareaField } from '@/components/form'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { btn, ConfirmAction, footerButton, PayrollDialog, ReadOnlyRow } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  CATEGORY_LABELS,
  LEAVE_CODES,
  LEAVE_STATUS_META,
  SHORT_LEAVE_LABELS,
} from '../../constants'
import {
  useCancelLeave,
  useDecideLeave,
  useLeaveApplication,
  useLeaveRequest,
} from '../../hooks/use-leaves'
import {
  type LeaveApplication,
  type LeaveBalance,
  type LeaveRequestDetail,
  SHORT_LEAVE_TYPES,
} from '../../types/leaves.types'
import {
  balanceDays,
  categoryOf,
  clockTime,
  leaveDates,
  leaveDays,
  longStamp,
  words,
} from '../../utils/format'
import { LeaveStatusChip } from './leave-list-parts'

/** The person over a View / Approve popup: initials, name, code, department. */
function PersonHeader({ application }: { application: LeaveApplication }) {
  return (
    <div className="flex items-center gap-4">
      <EmployeeAvatar
        name={application.employeeName}
        photoUrl={null}
        className="size-14"
        fallbackClassName="text-lg"
      />
      <div className="min-w-0">
        <p className="truncate font-inter text-lg font-medium text-heading">
          {application.employeeName}
        </p>
        <p className="truncate font-inter text-sm text-field-value">
          {[application.employeeCode, application.departmentName].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="ml-auto">
        <LeaveStatusChip status={application.status} />
      </div>
    </div>
  )
}

const shortText = (application: LeaveApplication) => {
  const kind = SHORT_LEAVE_TYPES.find((item) => item === application.shortLeaveType)
  const label = kind ? SHORT_LEAVE_LABELS[kind] : (application.shortLeaveType ?? '')
  const times =
    application.startTime && application.endTime
      ? `, ${clockTime(application.startTime)} – ${clockTime(application.endTime)}`
      : ''
  return `Short Leave, ${label}${times}`
}

/** The application's fields, as read-only rows. */
function ApplicationRows({ application }: { application: LeaveApplication }) {
  const category = categoryOf(application)
  return (
    <>
      <ReadOnlyRow label="Code" value={application.code} />
      <ReadOnlyRow label="Category" value={CATEGORY_LABELS[category]} />
      <ReadOnlyRow
        label="Leave Type"
        value={
          application.leaveTypeCode
            ? `${application.leaveTypeTitle} (${application.leaveTypeCode})`
            : application.leaveTypeTitle
        }
      />
      <ReadOnlyRow
        label={category === 'single' ? 'Leave Date' : 'Leave Dates'}
        value={
          application.isShort
            ? `${leaveDates(application.fromDate, application.toDate)} · ${shortText(application)}`
            : leaveDates(application.fromDate, application.toDate)
        }
      />
      <ReadOnlyRow label="Days" value={leaveDays(application.days)} />
      <ReadOnlyRow
        label="Applied On"
        value={longStamp(application.submittedAt ?? application.createdAt)}
      />
      <ReadOnlyRow label="Reason" value={application.reason ?? ''} />
      {application.decidedAt && (
        <ReadOnlyRow label="Decided On" value={longStamp(application.decidedAt)} />
      )}
      {application.cancelReason && (
        <ReadOnlyRow label="Cancellation" value={application.cancelReason} />
      )}
    </>
  )
}

/** Total, Availed, Available and Pending of the person's leave type in that leave year. */
function BalanceTable({
  application,
  balance,
}: {
  application: LeaveApplication
  balance: LeaveBalance | null | undefined
}) {
  if (!balance) {
    return (
      <p className="font-inter text-sm text-field-value">
        No balance of {application.leaveTypeTitle} for that leave year.
      </p>
    )
  }
  return (
    <table className="w-full text-left font-inter text-sm">
      <caption className="sr-only">
        {application.employeeName}’s {application.leaveTypeTitle} balance
      </caption>
      <thead>
        <tr className="text-xs font-medium text-title [&_th]:h-9 [&_th]:bg-sidebar/[0.06] [&_th]:px-4 [&_th]:font-medium dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md">
          <th scope="col">Leave Type</th>
          <th scope="col">Total Leaves</th>
          <th scope="col">Availed Leaves</th>
          <th scope="col">Available</th>
          <th scope="col">Pending</th>
        </tr>
      </thead>
      <tbody className="text-heading [&_td]:px-4 [&_td]:pt-3 [&_th]:px-4 [&_th]:pt-3 [&_th]:font-medium">
        <tr>
          <th scope="row">{application.leaveTypeTitle}</th>
          <td>{balanceDays(balance.entitled)}</td>
          <td>{balanceDays(balance.used)}</td>
          <td>{balanceDays(balance.available)}</td>
          <td>{balanceDays(balance.pending)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="font-inter text-base font-medium text-heading">{title}</h3>
      {children}
    </section>
  )
}

function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

/** The request's steps, oldest first: who acted (or is awaited), what they did, remarks. */
function Steps({ request }: { request: LeaveRequestDetail }) {
  return (
    <ol className="grid gap-2 font-inter text-sm text-heading">
      {request.steps.map((step) => (
        <li key={step.id} className="grid gap-x-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="text-field-value">
            {step.actedAt ? longStamp(step.actedAt) : 'Waiting'}
          </span>
          <span>
            <span className="font-medium">{words(step.actionTaken)}</span>
            {' — '}
            {(step.actedByName ?? step.approverName ?? words(step.approverKind)) || 'Requester'}
            {step.approverKind && step.approverKind !== 'requester' && (
              <span className="text-field-value"> ({words(step.approverKind)})</span>
            )}
            {step.isDelegate && ' (Delegate)'}
            {step.remarks && <span className="text-field-value">: {step.remarks}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * View: the person, the application, their balance of the type, and (with the requests
 * module's view code) the approval steps and attachments of the request behind it.
 */
export function LeaveViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useLeaveApplication(id)
  const canReadRequest = useCan(LEAVE_CODES.requestView)
  const request = useLeaveRequest(id, canReadRequest)
  const application = detail.data
  return (
    <PayrollDialog
      title="Leave Application"
      onClose={onClose}
      readOnly
      className="max-w-3xl"
      layout="horizontal"
    >
      {detail.error && !application ? (
        <ErrorState
          message={detail.error.message}
          onRetry={() => {
            void detail.refetch()
          }}
          className="shadow-none"
        />
      ) : !application ? (
        <Loading />
      ) : (
        <div className="grid gap-5">
          <PersonHeader application={application} />
          <ApplicationRows application={application} />
          <Section title="Balance">
            <BalanceTable application={application} balance={application.balance} />
          </Section>
          {request.data && (
            <>
              <Section title="Attachments">
                {request.data.attachments.length === 0 ? (
                  <p className="font-inter text-sm text-field-value">None</p>
                ) : (
                  <ul className="grid gap-1 font-inter text-sm">
                    {request.data.attachments.map((file) => (
                      <li key={file.id}>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {file.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section title="History">
                <Steps request={request.data} />
              </Section>
            </>
          )}
        </div>
      )}
    </PayrollDialog>
  )
}

const remarksSchema = z.object({
  remarks: z.string().trim().max(4000, 'Keep it under 4000 characters'),
})

/**
 * Approve / Reject on Leave Applications (`POST /requests/approvals/{id}/approve|reject`):
 * the person, the application, their balance of the type and Remarks (needed to reject).
 * A cancellation asks the same, deciding whether the approved leave is cancelled. The
 * buttons work only when the request is waiting for you (its `actions`).
 */
export function LeaveDecisionDialog({
  application,
  onClose,
}: {
  application: LeaveApplication
  onClose: () => void
}) {
  const formId = useId()
  const detail = useLeaveApplication(application.id)
  const request = useLeaveRequest(application.id)
  const decide = useDecideLeave()
  const canApprove = useCan(LEAVE_CODES.approve)
  const canReject = useCan(LEAVE_CODES.reject)
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null)
  const form = useForm<z.infer<typeof remarksSchema>>({
    resolver: zodResolver(remarksSchema),
    defaultValues: { remarks: '' },
  })
  const current = detail.data ?? application
  const cancelling = current.status === 'cancelling'
  const actions = request.data?.actions ?? []
  const mayApprove = canApprove && actions.includes('approve')
  const mayReject = canReject && actions.includes('reject')
  const waiting = request.data && !mayApprove && !mayReject

  const run = async (decision: 'approve' | 'reject') => {
    const remarks = form.getValues('remarks').trim()
    if (decision === 'reject' && !remarks) {
      form.setError('remarks', { message: 'Give a reason for rejecting' })
      return
    }
    if (!request.data) return
    try {
      await decide.mutateAsync({
        id: application.id,
        input: { decision, remarks, rowVersion: request.data.rowVersion },
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        if (failure.fieldErrors.remarks) {
          form.setError('remarks', { message: failure.fieldErrors.remarks })
        } else form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  }

  return (
    <PayrollDialog
      title={cancelling ? 'Leave Cancellation Approve/Reject' : 'Leave Approve/Reject'}
      onClose={onClose}
      readOnly
      error={form.formState.errors.root?.message ?? request.error?.message}
      className="max-w-3xl"
      layout="horizontal"
      actions={
        <>
          {canApprove && (
            <Button
              type="button"
              disabled={decide.isPending || !mayApprove}
              onClick={() => {
                setConfirm('approve')
              }}
              className={cn(footerButton, btn.green)}
            >
              Approve
            </Button>
          )}
          {canReject && (
            <Button
              type="button"
              disabled={decide.isPending || !mayReject}
              onClick={() => {
                void form.handleSubmit(() => {
                  if (!form.getValues('remarks').trim()) {
                    form.setError('remarks', { message: 'Give a reason for rejecting' })
                    return
                  }
                  setConfirm('reject')
                })()
              }}
              className={cn(footerButton, btn.hold)}
            >
              Reject
            </Button>
          )}
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
        }}
        className="grid gap-5"
      >
        <PersonHeader application={current} />
        <ApplicationRows application={current} />
        {cancelling && (
          <p className="rounded-md bg-[#FFEDE0] px-4 py-3 font-inter text-sm text-[#9A4A12] dark:bg-orange-500/15 dark:text-orange-200">
            {current.employeeName} asks to cancel this approved leave. Approve to cancel it and give
            the days back; reject to keep the leave.
          </p>
        )}
        {waiting && (
          <p className="rounded-md bg-[#FFF3D9] px-4 py-3 font-inter text-sm text-[#8A5A00] dark:bg-amber-500/15 dark:text-amber-200">
            This application is waiting for{' '}
            {request.data.nextApproverName ?? words(request.data.nextApproverKind)}
            {request.data.nextApproverKind ? ` (${words(request.data.nextApproverKind)})` : ''}; you
            cannot decide it at this step.
          </p>
        )}
        <Section title="Balance">
          <BalanceTable application={current} balance={detail.data?.balance} />
        </Section>
        <TextareaField
          control={form.control}
          name="remarks"
          label="Remarks"
          rows={3}
          maxLength={4000}
          placeholder="Needed to reject"
        />
      </form>
      <ConfirmAction
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={confirm === 'reject' ? 'Reject the application' : 'Approve the application'}
        message="Are you sure you want to Perform this action?"
        onConfirm={() => {
          const decision = confirm
          setConfirm(null)
          if (decision) void run(decision)
        }}
      />
    </PayrollDialog>
  )
}

const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Give the reason for cancellation')
    .max(4000, 'Keep it under 4000 characters'),
})

/**
 * Cancel on My Leaves (`POST /requests/leave/{id}/cancel`): a pending application is
 * withdrawn; an approved one asks the final authority to cancel it ("Reason for
 * Cancellation *"). Reads the request first for its rowVersion.
 */
export function LeaveCancelDialog({
  application,
  onClose,
}: {
  application: LeaveApplication
  onClose: () => void
}) {
  const formId = useId()
  const cancel = useCancelLeave()
  const request = useLeaveRequest(application.id)
  const form = useForm<z.infer<typeof cancelSchema>>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: '' },
  })
  const pending = application.status === 'pending'
  const refused = request.data && !request.data.actions.includes('cancel')
  const submit = form.handleSubmit(async (values) => {
    if (!request.data) return
    try {
      await cancel.mutateAsync({
        id: application.id,
        reason: values.reason,
        rowVersion: request.data.rowVersion,
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        form.setError(failure.fieldErrors.reason ? 'reason' : 'root', {
          message: failure.fieldErrors.reason ?? failure.message,
        })
      }
      return
    }
    onClose()
  })
  return (
    <PayrollDialog
      title={pending ? 'Withdraw Leave Application' : 'Cancel Leave'}
      onClose={onClose}
      formId={formId}
      saveLabel={pending ? 'Withdraw' : 'Request Cancellation'}
      pending={cancel.isPending || !request.data || refused === true}
      error={form.formState.errors.root?.message ?? request.error?.message}
      className="max-w-2xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        <p className="font-inter text-sm text-heading">
          {application.code}: {application.leaveTypeTitle},{' '}
          {leaveDates(application.fromDate, application.toDate)} ({leaveDays(application.days)} day
          {application.days === 1 ? '' : 's'}), now{' '}
          {LEAVE_STATUS_META[application.status].label.toLowerCase()}.
          {pending
            ? ' Withdrawing takes it out of the approval flow and gives the days back.'
            : ' The final authority decides the cancellation; the days come back once it is approved.'}
        </p>
        {refused && (
          <p role="alert" className="text-sm text-destructive">
            This application can no longer be cancelled.
          </p>
        )}
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason for Cancellation"
          required
          rows={4}
          maxLength={4000}
        />
      </form>
    </PayrollDialog>
  )
}
