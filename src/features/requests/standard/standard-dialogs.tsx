import { type ReactNode, useId, useState } from 'react'
import { format, parse, parseISO } from 'date-fns'

import { AppDialog } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmAction } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import type { FlowStepStatus, RequestEmployee } from '../types/requests.types'
import { stamp } from '../utils/request-format'
import type { StandardKindConfig, StandardRequest } from './standard.types'
import { StandardPersonCell } from './standard-parts'
import { standardButton, standardFooterButton } from './standard-styles'
import {
  useCancelStandard,
  useDecideStandard,
  useDeleteStandard,
  useStandardDetail,
} from './use-standard'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** "Location:" Inter Semi Bold 17, its value Inter Regular 16 (both #000). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-3 font-inter sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-[0.9375rem] font-semibold text-heading sm:text-[1.0625rem]">{label}:</dt>
      <dd className="min-w-0 truncate text-sm text-heading sm:text-base">{value}</dd>
    </div>
  )
}

/** The large photo, the name (Inter Medium 37) and job title, then where the person works. */
export function StandardEmployeeCard({ employee }: { employee: RequestEmployee }) {
  return (
    <section aria-label="Employee" className="grid gap-5">
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-10">
        <EmployeeAvatar
          name={employee.name}
          photoUrl={employee.photoUrl}
          className="size-32 shrink-0 @md:size-36"
          fallbackClassName="text-3xl"
        />
        <div className="grid gap-3 text-center font-inter @md:text-left">
          <p className="text-2xl font-medium text-heading @md:text-[2.3125rem] @md:leading-tight">
            {employee.name}
          </p>
          <p>
            <span className="mr-6 text-[1.0625rem] font-semibold text-heading">Job Title:</span>
            <span className="text-base text-heading">{employee.designation}</span>
          </p>
        </div>
      </div>
      <dl className="grid gap-3">
        <Fact label="Location" value={employee.location ?? '—'} />
        <Fact label="Department" value={employee.department} />
        <Fact label="Employee Code" value={employee.code} />
        <Fact label="Branch" value={employee.branch ?? '—'} />
        <Fact label="Company" value={employee.company ?? '—'} />
        <Fact label="Joining Date" value={format(day(employee.joiningDate), 'd, MMMM yyyy')} />
      </dl>
    </section>
  )
}

/** A label on the left and a read-only grey box, as the View popups draw the request's fields. */
export function StandardReadOnlyRow({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: ReactNode
  multiline?: boolean
}) {
  const id = useId()
  return (
    <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
      <span id={id} className="font-inter text-sm text-heading @xl:text-base">
        {label}
      </span>
      <span
        aria-labelledby={id}
        className={cn(
          'flex min-h-10 items-center rounded-md bg-[#D9D9D9]/60 px-4 py-2 font-inter text-sm text-field-value dark:bg-muted',
          multiline && 'min-h-24 items-start whitespace-pre-wrap',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** A remarks box with its label and error (Inter Regular 16 label). */
function RemarksField({
  label,
  value,
  onChange,
  error,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error: string | null
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @3xl:grid-cols-[11rem_minmax(0,1fr)]">
      <label htmlFor={id} className="font-inter text-sm text-heading @xl:py-2 @xl:text-base">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-[#E50141]">
            *
          </span>
        )}
      </label>
      <div className="grid gap-1.5">
        <Textarea
          id={id}
          rows={4}
          maxLength={500}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

const STEP_STATUS: Record<FlowStepStatus, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'text-grey' },
  pending: { label: 'Pending', className: 'text-[#EBA51E]' },
  approved: { label: 'Approved', className: 'text-[#51B969]' },
  rejected: { label: 'Rejected', className: 'text-[#D83838]' },
  skipped: { label: 'Skipped', className: 'text-grey' },
}

/** Popup tables: Poppins Medium 11 #303030 headers, Poppins Regular 12 #707070 cells. */
const popupTable =
  'w-full text-xs [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-grey [&_th]:bg-sidebar/[0.06] [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title dark:[&_th]:bg-muted'

/** "<Type> Request Flow": each approver, their authority and status; red Cancel. */
export function StandardFlowDialog<P>({
  config,
  request,
  onClose,
}: {
  config: StandardKindConfig<P>
  request: StandardRequest<P>
  onClose: () => void
}) {
  return (
    <AppDialog
      title={`${config.noun} Request Flow`}
      onRequestClose={onClose}
      className="max-w-2xl"
      footer={
        <Button
          type="button"
          onClick={onClose}
          className={cn(standardFooterButton, standardButton.red)}
        >
          Cancel
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-md">
        <table className={cn(popupTable, 'min-w-[30rem]')}>
          <thead>
            <tr>
              <th scope="col">Requestee</th>
              <th scope="col">Authority Type</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {request.flow.map((step, index) => (
              <tr key={`${step.authority}-${String(index)}`} className="border-b last:border-0">
                <td>
                  <StandardPersonCell person={step.approver} />
                </td>
                <td>{step.authority}</td>
                <td>
                  <span className={cn('font-medium', STEP_STATUS[step.status].className)}>
                    {STEP_STATUS[step.status].label}
                  </span>
                  {step.actedBy && step.actedBy.id !== step.approver.id && (
                    <span className="block text-[0.6875rem]">
                      by {step.actedBy.name} (Delegate)
                    </span>
                  )}
                  {step.actedAt && (
                    <span className="block text-[0.6875rem]">{stamp(step.actedAt)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppDialog>
  )
}

/** "<Type> Request History": who did what and when, newest first. */
export function StandardHistoryDialog<P>({
  config,
  id,
  onClose,
}: {
  config: StandardKindConfig<P>
  id: string
  onClose: () => void
}) {
  const detail = useStandardDetail(config.kind, id)
  const history = detail.data?.history ?? []
  return (
    <AppDialog
      title={`${config.noun} Request History`}
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <Button
          type="button"
          onClick={onClose}
          className={cn(standardFooterButton, standardButton.red)}
        >
          Cancel
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-md">
        <table className={cn(popupTable, 'min-w-[36rem]')}>
          <thead>
            <tr>
              <th scope="col">Requestee</th>
              <th scope="col">Date Time</th>
              <th scope="col">Status</th>
              <th scope="col">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {detail.isPending ? (
              <tr>
                <td colSpan={4}>
                  <Skeleton className="h-10 w-full" />
                </td>
              </tr>
            ) : (
              history.map((entry) => (
                <tr key={entry.id} className="border-b align-top last:border-0">
                  <td className="text-person">
                    {entry.by.name}
                    {entry.delegate && <span className="text-grey"> (Delegate)</span>}
                  </td>
                  <td className="whitespace-nowrap">{stamp(entry.at)}</td>
                  <td>{entry.status}</td>
                  <td>{entry.remarks ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppDialog>
  )
}

/** "<Type> Request Cancel": an approved request goes back for approval, with a reason. */
export function StandardCancelDialog<P>({
  config,
  request,
  onClose,
}: {
  config: StandardKindConfig<P>
  request: StandardRequest<P>
  onClose: () => void
}) {
  const cancel = useCancelStandard(config.kind)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!reason.trim()) {
      setError('Give a reason for cancellation')
      return
    }
    try {
      await cancel.mutateAsync({ id: request.id, reason: reason.trim() })
    } catch (failure) {
      if (failure instanceof ApiError) setError(failure.fieldErrors.reason ?? failure.message)
      return
    }
    onClose()
  }
  return (
    <AppDialog
      title={`${config.noun} Request Cancel`}
      description={`${request.code}: the cancellation goes for approval before it takes effect.`}
      onRequestClose={onClose}
      className="max-w-xl"
      footer={
        <>
          <Button
            disabled={cancel.isPending}
            onClick={() => void submit()}
            className={cn(standardFooterButton, standardButton.green)}
          >
            Save
          </Button>
          <Button onClick={onClose} className={cn(standardFooterButton, standardButton.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="@container">
        <RemarksField
          label="Reason for Cancellation"
          required
          value={reason}
          onChange={(value) => {
            setReason(value)
            if (error) setError(null)
          }}
          error={error}
        />
      </div>
    </AppDialog>
  )
}

/** "Are you sure you want to Delete this?" Yes / No. */
export function StandardDeleteDialog<P>({
  config,
  request,
  onClose,
}: {
  config: StandardKindConfig<P>
  request: StandardRequest<P>
  onClose: () => void
}) {
  const remove = useDeleteStandard(config.kind)
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Delete ${request.code}`}
      description="Are you sure you want to Delete this?"
      confirmLabel="Yes"
      cancelLabel="No"
      variant="destructive"
      onConfirm={() => {
        remove.mutate(request.id, { onSettled: onClose })
      }}
    />
  )
}

/** "Unapproved": the ticked requests are rejected with one reason. */
export function StandardUnapproveDialog({
  count,
  pending,
  onConfirm,
  onClose,
}: {
  count: number
  pending: boolean
  onConfirm: (remarks: string) => void
  onClose: () => void
}) {
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <AppDialog
      title="Unapprove requests"
      description={`${String(count)} ticked request${count === 1 ? '' : 's'} will be rejected.`}
      onRequestClose={onClose}
      className="max-w-xl"
      footer={
        <>
          <Button
            disabled={pending}
            onClick={() => {
              if (!remarks.trim()) {
                setError('Give a reason for rejecting')
                return
              }
              onConfirm(remarks.trim())
            }}
            className={cn(standardFooterButton, standardButton.maroon)}
          >
            Unapprove
          </Button>
          <Button onClick={onClose} className={cn(standardFooterButton, standardButton.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="@container">
        <RemarksField
          label="Reason"
          required
          value={remarks}
          onChange={(value) => {
            setRemarks(value)
            if (error) setError(null)
          }}
          error={error}
        />
      </div>
    </AppDialog>
  )
}

/**
 * The Approve/Reject popup and the approvals' View: the employee card, the
 * request's fields, Created, then "Approvals" with the remarks so far, and in
 * Approve/Reject the remarks box (and the type's own approval fields). Flow,
 * History, Approve, Reject and Cancel at the bottom, as drawn.
 */
export function StandardDecisionDialog<P>({
  config,
  id,
  mode,
  onClose,
}: {
  config: StandardKindConfig<P>
  id: string
  mode: 'decide' | 'view'
  onClose: () => void
}) {
  const detail = useStandardDetail<P>(config.kind, id)
  const decide = useDecideStandard(config.kind)
  const [remarks, setRemarks] = useState('')
  const [extras, setExtras] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null)
  const [panel, setPanel] = useState<'flow' | 'history' | null>(null)
  const request = detail.data?.request
  const deciding = mode === 'decide' && Boolean(request?.actions.includes('decide'))
  const cancelling = request?.status === 'cancelling'
  const { DetailRows, DecisionFields } = config

  const ask = (decision: 'approve' | 'reject') => {
    const needed = decision === 'reject' || (config.approveNeedsRemarks && !cancelling)
    if (needed && !remarks.trim()) {
      setError(decision === 'reject' ? 'Give a reason for rejecting' : 'Give a reason for approval')
      return
    }
    setConfirming(decision)
  }
  const submit = async (decision: 'approve' | 'reject') => {
    if (!request) return
    try {
      await decide.mutateAsync({
        id: request.id,
        input: {
          decision,
          remarks: remarks.trim(),
          ...(DecisionFields && !cancelling ? { extras } : {}),
        },
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        setErrors(failure.fieldErrors)
        setError(failure.fieldErrors.remarks ?? failure.message)
      }
      setConfirming(null)
      return
    }
    onClose()
  }

  const title = deciding
    ? cancelling
      ? `${config.noun} Cancellation Approve/Reject`
      : `${config.noun} Approve/Reject`
    : `${config.noun} Request View`
  const decided = request?.flow.filter((step) => step.remarks) ?? []

  return (
    <>
      <AppDialog
        title={title}
        onRequestClose={onClose}
        className="max-w-4xl"
        footer={
          <>
            <div className="mr-auto flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={!request}
                onClick={() => {
                  setPanel('flow')
                }}
                className={cn(standardFooterButton, standardButton.flow)}
              >
                Flow
              </Button>
              <Button
                type="button"
                disabled={!request}
                onClick={() => {
                  setPanel('history')
                }}
                className={cn(standardFooterButton, standardButton.history)}
              >
                History
              </Button>
            </div>
            {deciding && (
              <>
                <Button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => {
                    ask('approve')
                  }}
                  className={cn(
                    'h-10 min-w-24 rounded-[4px] px-5 text-sm font-medium',
                    standardButton.navy,
                  )}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  disabled={decide.isPending}
                  onClick={() => {
                    ask('reject')
                  }}
                  className={cn(
                    'h-10 min-w-24 rounded-[4px] px-5 text-sm font-medium',
                    standardButton.maroon,
                  )}
                >
                  Reject
                </Button>
              </>
            )}
            <Button
              type="button"
              onClick={onClose}
              className={cn(standardFooterButton, standardButton.red)}
            >
              Cancel
            </Button>
          </>
        }
      >
        {detail.isError ? (
          <ErrorState
            title="Could not load this request"
            message="Check your connection and try again."
            onRetry={() => void detail.refetch()}
          />
        ) : !request ? (
          <div className="grid gap-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        ) : (
          <div className="@container grid gap-6">
            <StandardEmployeeCard employee={request.employee} />
            {cancelling && (
              <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                {request.employee.name} asks to cancel this approved request
                {request.cancelReason ? `: ${request.cancelReason}` : '.'}
              </p>
            )}
            <DetailRows request={request} />
            <StandardReadOnlyRow
              label="Created"
              value={format(parseISO(request.createdAt), 'MMMM d, yyyy hh:mm a')}
            />
            {DecisionFields && (
              <DecisionFields
                request={request}
                readOnly={!deciding || cancelling}
                value={extras}
                onChange={(next) => {
                  setExtras(next)
                  setErrors({})
                }}
                errors={errors}
              />
            )}
            <h3 className="font-inter text-base font-semibold text-heading">Approvals</h3>
            {decided.length > 0 && (
              <StandardReadOnlyRow
                label="Approval Remarks"
                multiline
                value={decided.map((step) => `${step.authority}: ${step.remarks ?? ''}`).join('\n')}
              />
            )}
            {deciding && (
              <RemarksField
                label={
                  config.approveNeedsRemarks && !cancelling ? 'Reason for Approval' : 'Remarks'
                }
                required={Boolean(config.approveNeedsRemarks && !cancelling)}
                value={remarks}
                onChange={(value) => {
                  setRemarks(value)
                  if (error) setError(null)
                }}
                error={error}
              />
            )}
          </div>
        )}
      </AppDialog>
      <ConfirmAction
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        title={confirming === 'reject' ? 'Reject' : 'Approve'}
        message={`Are you sure you want to ${confirming === 'reject' ? 'Reject' : 'Approve'} this?`}
        onConfirm={() => {
          if (confirming) void submit(confirming)
        }}
      />
      {panel === 'flow' && request && (
        <StandardFlowDialog
          config={config}
          request={request}
          onClose={() => {
            setPanel(null)
          }}
        />
      )}
      {panel === 'history' && request && (
        <StandardHistoryDialog
          config={config}
          id={request.id}
          onClose={() => {
            setPanel(null)
          }}
        />
      )}
    </>
  )
}
