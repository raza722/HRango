import { useId, useState } from 'react'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { KIND_LABELS } from '../../constants'
import {
  useCancelRequest,
  useConsentRequest,
  useDecideRequest,
  useDeleteRequest,
  useRequestDetail,
} from '../../hooks/use-requests'
import type { AnyRequest, FlowStepStatus, RequestKind } from '../../types/requests.types'
import { stamp } from '../../utils/request-format'
import { personCodeText, personNameText } from '../shared/request-styles'
import { RequestFields, RequestPersonCard } from './request-fields'

const STEP_STATUS: Record<FlowStepStatus, { label: string; className: string }> = {
  waiting: { label: 'Waiting', className: 'text-muted-foreground' },
  pending: { label: 'Pending', className: 'text-[#EBA51E] dark:text-amber-300' },
  approved: { label: 'Approved', className: 'text-[#51B969] dark:text-green-400' },
  rejected: { label: 'Rejected', className: 'text-destructive' },
  skipped: { label: 'Skipped', className: 'text-muted-foreground' },
}

/** A remarks box with its label and error, used by the decision popups. */
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
    <div className="grid gap-2">
      <label htmlFor={id} className="font-inter text-base text-heading">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-[#D80027] dark:text-destructive">
            *
          </span>
        )}
      </label>
      <Textarea
        id={id}
        rows={3}
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
  )
}

type DecisionMode = 'view' | 'decide' | 'consent'

/**
 * View, and the same popup with Remarks and Approve / Reject ("decide") or
 * Give / Decline consent ("consent"). A decision asks "Are you sure…?" first.
 */
export function RequestViewDialog({
  kind,
  id,
  mode,
  onClose,
}: {
  kind: RequestKind
  id: string
  mode: DecisionMode
  onClose: () => void
}) {
  const detail = useRequestDetail(kind, id)
  const decide = useDecideRequest(kind)
  const consent = useConsentRequest(kind)
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null)
  const request = detail.data?.request
  const pending = decide.isPending || consent.isPending
  const labels =
    mode === 'consent'
      ? { approve: 'Give Consent', reject: 'Decline' }
      : { approve: 'Approve', reject: 'Reject' }

  const ask = (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && mode === 'decide' && !remarks.trim()) {
      setError('Give a reason for rejecting')
      return
    }
    setError(null)
    setConfirming(decision)
  }

  const submit = async (decision: 'approve' | 'reject') => {
    setConfirming(null)
    const mutation = mode === 'consent' ? consent : decide
    try {
      await mutation.mutateAsync({ id, input: { decision, remarks: remarks.trim() } })
    } catch (failure) {
      if (failure instanceof ApiError) setError(failure.fieldErrors.remarks ?? failure.message)
      return
    }
    onClose()
  }

  const title =
    mode === 'decide'
      ? `${KIND_LABELS[kind].title} Approve/Reject`
      : mode === 'consent'
        ? `${KIND_LABELS[kind].title} Consent`
        : `${KIND_LABELS[kind].title} View`

  return (
    <>
      <AppDialog
        title={title}
        onRequestClose={onClose}
        className="max-w-3xl"
        footer={
          <>
            {mode !== 'view' && request && (
              <>
                <Button
                  variant="success"
                  size="lg"
                  disabled={pending}
                  onClick={() => {
                    ask('approve')
                  }}
                  className={dialogButtonClass}
                >
                  {labels.approve}
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={pending}
                  onClick={() => {
                    ask('reject')
                  }}
                  className={dialogButtonClass}
                >
                  {labels.reject}
                </Button>
              </>
            )}
            <Button variant="outline" size="lg" onClick={onClose} className={dialogButtonClass}>
              {mode === 'view' ? 'Close' : 'Cancel'}
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
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="grid gap-5">
            <RequestPersonCard employee={request.employee} />
            {request.status === 'cancelling' && mode === 'decide' && (
              <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                {request.employee.name} asks to cancel this completed request. Approving the
                cancellation undoes it.
              </p>
            )}
            <RequestFields request={request} />
            {mode !== 'view' && (
              <RemarksField
                label={mode === 'consent' ? 'Remarks' : 'Approval Remarks'}
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
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        title={confirming === 'approve' ? labels.approve : labels.reject}
        description={`Are you sure you want to ${confirming === 'approve' ? labels.approve : labels.reject} this?`}
        confirmLabel="Yes"
        cancelLabel="No"
        variant={confirming === 'reject' ? 'destructive' : 'default'}
        onConfirm={() => {
          if (confirming) void submit(confirming)
        }}
      />
    </>
  )
}

/** "Flow": each approver in order with their authority and status. */
export function RequestFlowDialog({
  request,
  onClose,
}: {
  request: AnyRequest
  onClose: () => void
}) {
  return (
    <AppDialog
      title={`${KIND_LABELS[request.kind].title} Flow`}
      onRequestClose={onClose}
      className="max-w-2xl"
      footer={
        // The Transfer Flow frame closes with a red Cancel under the table.
        request.kind === 'transfer' && (
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        )
      }
    >
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[30rem] text-xs text-grey">
          <thead className="bg-muted text-left text-[0.6875rem] text-title">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-medium">
              <th scope="col">Requestee</th>
              <th scope="col">Authority Type</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {request.flow.map((step, index) => (
              <tr
                key={`${step.authority}-${index}`}
                className="border-t align-top [&>td]:px-4 [&>td]:py-2.5"
              >
                <td>
                  <span className="flex items-center gap-2.5">
                    <EmployeeAvatar name={step.approver.name} className="size-8" />
                    <span>
                      <span className={cn('block', personNameText)}>{step.approver.name}</span>
                      <span className={cn('block', personCodeText)}>{step.approver.code}</span>
                    </span>
                  </span>
                </td>
                <td>{step.authority}</td>
                <td>
                  <span className={cn('font-medium', STEP_STATUS[step.status].className)}>
                    {STEP_STATUS[step.status].label}
                  </span>
                  {step.actedBy && step.actedBy.id !== step.approver.id && (
                    <span className="block text-[0.6875rem] text-muted-foreground">
                      by {step.actedBy.name} (Delegate)
                    </span>
                  )}
                  {step.actedAt && (
                    <span className="block text-[0.6875rem] text-muted-foreground">
                      {stamp(step.actedAt)}
                    </span>
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

/** "History": who did what and when, newest first. */
export function RequestHistoryDialog({
  kind,
  id,
  onClose,
}: {
  kind: RequestKind
  id: string
  onClose: () => void
}) {
  const detail = useRequestDetail(kind, id)
  const history = detail.data?.history ?? []
  return (
    <AppDialog
      title={`${KIND_LABELS[kind].title} History`}
      onRequestClose={onClose}
      className="max-w-3xl"
    >
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[36rem] text-xs text-grey">
          <thead className="bg-muted text-left text-[0.6875rem] text-title">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-medium">
              <th scope="col">Requestee</th>
              <th scope="col">Date Time</th>
              <th scope="col">Status</th>
              <th scope="col">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {detail.isPending ? (
              <tr>
                <td colSpan={4} className="p-4">
                  <Skeleton className="h-10 w-full" />
                </td>
              </tr>
            ) : (
              history.map((entry) => (
                <tr key={entry.id} className="border-t align-top [&>td]:px-4 [&>td]:py-2.5">
                  <td className={personNameText}>
                    {entry.by.name}
                    {entry.delegate && <span className="text-muted-foreground"> (Delegate)</span>}
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

/** "Cancel": a completed request goes back to the final authority with a reason. */
export function CancelRequestDialog({
  request,
  onClose,
}: {
  request: AnyRequest
  onClose: () => void
}) {
  const cancel = useCancelRequest(request.kind)
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
      title={`${KIND_LABELS[request.kind].title} Cancel`}
      description={`${request.code}: the cancellation goes to ${request.flow.at(-1)?.approver.name ?? 'the final authority'} for approval.`}
      onRequestClose={onClose}
      className="max-w-xl"
      footer={
        <>
          <Button
            size="lg"
            disabled={cancel.isPending}
            onClick={() => void submit()}
            className={cn(dialogButtonClass, 'bg-sidebar text-white hover:bg-sidebar/90')}
          >
            Save
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
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
    </AppDialog>
  )
}

/** "Are you sure you want to Delete this?" Yes / No. */
export function DeleteRequestDialog({
  request,
  onClose,
}: {
  request: AnyRequest
  onClose: () => void
}) {
  const remove = useDeleteRequest(request.kind)
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
