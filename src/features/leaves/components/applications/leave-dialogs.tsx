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
import { cn } from '@/lib/utils'

import { CATEGORY_LABELS, FINAL_APPROVAL_LABELS, LEAVE_STATUS_META } from '../../constants'
import {
  useCancelLeave,
  useDecideLeave,
  useLeaveApplication,
  useLeavesLookups,
} from '../../hooks/use-leaves'
import type { LeaveApplication } from '../../types/leaves.types'
import { balanceDays, leaveDates, leaveDays, longStamp } from '../../utils/format'
import { LeaveStatusChip } from './leave-list-parts'

/** The person over a View / Approve popup: photo, name, code, department. */
function PersonHeader({ application }: { application: LeaveApplication }) {
  const { employee } = application
  return (
    <div className="flex items-center gap-4">
      <EmployeeAvatar
        name={employee.name}
        photoUrl={employee.photoUrl}
        className="size-14"
        fallbackClassName="text-lg"
      />
      <div className="min-w-0">
        <p className="truncate font-inter text-lg font-medium text-heading">{employee.name}</p>
        <p className="truncate font-inter text-sm text-field-value">
          {employee.code} · {employee.department} · {employee.designation}
        </p>
      </div>
      <div className="ml-auto">
        <LeaveStatusChip status={application.status} />
      </div>
    </div>
  )
}

/** The application's fields, as read-only rows. */
function ApplicationRows({ application }: { application: LeaveApplication }) {
  return (
    <>
      <ReadOnlyRow label="Code" value={application.code} />
      <ReadOnlyRow label="Category" value={CATEGORY_LABELS[application.category]} />
      <ReadOnlyRow
        label="Leave Type"
        value={`${application.leaveTypeTitle} (${application.leaveTypeCode})`}
      />
      <ReadOnlyRow
        label={application.category === 'single' ? 'Leave Date' : 'Leave Dates'}
        value={
          application.short
            ? `${leaveDates(application.from, application.to)} · Short Leave, ${application.shortTypeLabel ?? ''}`
            : leaveDates(application.from, application.to)
        }
      />
      <ReadOnlyRow label="Days" value={leaveDays(application.count)} />
      <ReadOnlyRow label="Roster" value={application.rosterTitle} />
      <ReadOnlyRow label="Applied On" value={longStamp(application.appliedAt)} />
      <ReadOnlyRow label="Reason" value={application.reason} />
      <ReadOnlyRow
        label="Attachment"
        value={
          application.attachment ??
          (application.attachmentMissing ? 'None (the type asks for one)' : 'None')
        }
      />
      {application.cancelReason && (
        <ReadOnlyRow label="Cancellation" value={application.cancelReason} />
      )}
    </>
  )
}

/** Balance, Availed, Available and Pending of the person's leave type. */
function BalanceTable({ application }: { application: LeaveApplication }) {
  const { balance } = application
  return (
    <table className="w-full text-left font-inter text-sm">
      <caption className="sr-only">
        {application.employee.name}’s {application.leaveTypeTitle} balance
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
          <td>{balanceDays(balance.total)}</td>
          <td>{balanceDays(balance.availed)}</td>
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

/**
 * View: the person, the application, the approval steps and the history.
 * Reads the application again, so the history is current.
 */
export function LeaveViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useLeaveApplication(id)
  const application = detail.data?.application
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
          <Section title="Approval">
            <ol className="grid gap-2 font-inter text-sm text-heading">
              {application.flow.map((step, index) => (
                <li key={`${step.authority}-${String(index)}`} className="flex flex-wrap gap-x-3">
                  <span className="min-w-40 font-medium">{step.authority}</span>
                  <span>{step.approver.name}</span>
                  <span className="text-field-value capitalize">{step.status}</span>
                  {step.remarks && <span className="text-field-value">“{step.remarks}”</span>}
                </li>
              ))}
            </ol>
          </Section>
          <Section title="History">
            <ol className="grid gap-2 font-inter text-sm text-heading">
              {detail.data?.history.map((entry) => (
                <li key={entry.id} className="grid gap-x-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <span className="text-field-value">{longStamp(entry.at)}</span>
                  <span>
                    <span className="font-medium">{entry.status}</span> — {entry.by.name}
                    {entry.delegate && ' (Delegate)'}
                    {entry.remarks && <span className="text-field-value">: {entry.remarks}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}
    </PayrollDialog>
  )
}

const remarksSchema = z.object({
  remarks: z.string().trim().max(500, 'Keep it under 500 characters'),
})

/**
 * Approve / Reject on Leave Applications: the person, the application, their
 * balance of the type and Remarks (needed to reject). A cancellation asks the
 * same, deciding whether the approved leave is cancelled.
 */
export function LeaveDecisionDialog({
  application,
  onClose,
}: {
  application: LeaveApplication
  onClose: () => void
}) {
  const formId = useId()
  const lookups = useLeavesLookups()
  const decide = useDecideLeave()
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null)
  const form = useForm<z.infer<typeof remarksSchema>>({
    resolver: zodResolver(remarksSchema),
    defaultValues: { remarks: '' },
  })
  const cancelling = application.status === 'cancelling'
  const finalBy = lookups.data?.settings.finalApprovalBy

  const run = async (decision: 'approve' | 'reject') => {
    const remarks = form.getValues('remarks').trim()
    if (decision === 'reject' && !remarks) {
      form.setError('remarks', { message: 'Give a reason for rejecting' })
      return
    }
    try {
      await decide.mutateAsync({ id: application.id, input: { decision, remarks } })
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
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
      layout="horizontal"
      actions={
        <>
          <Button
            type="button"
            disabled={decide.isPending}
            onClick={() => {
              setConfirm('approve')
            }}
            className={cn(footerButton, btn.green)}
          >
            Approve
          </Button>
          <Button
            type="button"
            disabled={decide.isPending}
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
        <PersonHeader application={application} />
        <ApplicationRows application={application} />
        {cancelling && (
          <p className="rounded-md bg-[#FFEDE0] px-4 py-3 font-inter text-sm text-[#9A4A12] dark:bg-orange-500/15 dark:text-orange-200">
            {application.employee.name} asks to cancel this approved leave. Approve to cancel it and
            give the days back; reject to keep the leave.
          </p>
        )}
        <Section title="Balance">
          <BalanceTable application={application} />
        </Section>
        {finalBy && !cancelling && (
          <p className="font-inter text-sm text-field-value">
            Approving here records the final approval by the {FINAL_APPROVAL_LABELS[finalBy]}
            (Settings → General Settings) and completes the application.
          </p>
        )}
        <TextareaField
          control={form.control}
          name="remarks"
          label="Remarks"
          rows={3}
          maxLength={500}
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
    .max(500, 'Keep it under 500 characters'),
})

/**
 * Cancel on My Leaves: a pending application is withdrawn; an approved one
 * asks the final authority to cancel it ("Reason for Cancellation *").
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
  const form = useForm<z.infer<typeof cancelSchema>>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: '' },
  })
  const pending = application.status === 'pending'
  const submit = form.handleSubmit(async (values) => {
    try {
      await cancel.mutateAsync({ id: application.id, reason: values.reason })
    } catch (failure) {
      if (failure instanceof ApiError) form.setError('root', { message: failure.message })
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
      pending={cancel.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-2xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        <p className="font-inter text-sm text-heading">
          {application.code}: {application.leaveTypeTitle},{' '}
          {leaveDates(application.from, application.to)} ({leaveDays(application.count)} day
          {application.count === 1 ? '' : 's'}), now{' '}
          {LEAVE_STATUS_META[application.status].label.toLowerCase()}.
          {pending
            ? ' Withdrawing takes it out of the approval flow and gives the days back.'
            : ' The final authority decides the cancellation; the days come back once it is approved.'}
        </p>
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason for Cancellation"
          required
          rows={4}
          maxLength={500}
        />
      </form>
    </PayrollDialog>
  )
}
