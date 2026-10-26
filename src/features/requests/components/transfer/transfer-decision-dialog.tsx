import { useId, useState } from 'react'
import { format, parse, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { btn, ConfirmAction, footerButton, ReadOnlyRow } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import type { DetailSource } from '../../api/engine.api'
import { useDecideRequest, useRequestDetail } from '../../hooks/use-requests'
import type { RequestEmployee } from '../../types/requests.types'
import { RequestFlowDialog, RequestHistoryDialog } from '../dialogs/request-dialogs'
import { RequestFileLinks } from '../shared/request-files'
import { ApplicationEditor } from './application-editor'
import { TransferDialogShell } from './transfer-dialog-shell'
import { decisionButton } from './transfer-styles'

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
/** Approve and Reject are Poppins Medium 14 in the frame; Flow, History and Cancel are Inter Medium 16. */
const decisionText = 'font-sans text-sm font-medium'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-baseline gap-3 font-inter text-base text-heading">
      <dt className="text-[1.0625rem] font-semibold">{label}:</dt>
      <dd className="min-w-0 truncate">{value}</dd>
    </div>
  )
}

/** The large photo, the name and job title beside it, then where the person works now. */
function TransferEmployeeCard({ employee }: { employee: RequestEmployee }) {
  return (
    <section aria-label="Employee" className="grid gap-5">
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-10">
        <EmployeeAvatar
          name={employee.name}
          photoUrl={employee.photoUrl}
          className="size-32 shrink-0 @md:size-36"
          fallbackClassName="text-3xl"
        />
        <div className="grid gap-3 text-center @md:text-left">
          <p className="font-inter text-2xl font-medium text-heading">{employee.name}</p>
          <p className="font-inter text-base text-heading">
            <span className="mr-6 text-[1.0625rem] font-semibold">Job Title:</span>
            <span>{employee.designation}</span>
          </p>
        </div>
      </div>
      <dl className="grid gap-3">
        <Fact label="Location" value={employee.location ?? '—'} />
        <Fact label="Department" value={employee.department} />
        <Fact label="Employee Code" value={employee.code} />
        <Fact label="Branch" value={employee.branch ?? '—'} />
        <Fact label="Company" value={employee.company ?? '—'} />
        <Fact
          label="Joining Date"
          value={employee.joiningDate ? format(day(employee.joiningDate), 'd, MMMM yyyy') : '—'}
        />
      </dl>
    </section>
  )
}

/**
 * "Transfer Approval Approve" (and its View): the employee card, the
 * requested move, Created and Remarks, with Flow, History, Approve, Reject and
 * Cancel; the Application is shown beside it, read-only.
 */
export function TransferDecisionDialog({
  id,
  mode,
  via = 'approvals',
  onClose,
}: {
  id: string
  mode: 'decide' | 'view'
  via?: DetailSource
  onClose: () => void
}) {
  const remarksId = useId()
  const detail = useRequestDetail('transfer', id, via)
  const decide = useDecideRequest()
  const canApprove = useCan('requests.approvals.approve')
  const canReject = useCan('requests.approvals.reject')
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null)
  const [panel, setPanel] = useState<'flow' | 'history' | null>(null)
  const request = detail.data?.request
  const deciding = mode === 'decide' && Boolean(request?.actions.includes('decide'))
  // Each button only when the API lists it for the caller (the detail's `actions`).
  const may = (action: 'approve' | 'reject') => request?.decisions?.includes(action) ?? true

  const ask = (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !remarks.trim()) {
      setError('Give a reason for rejecting')
      return
    }
    setError(null)
    setConfirming(decision)
  }

  const submit = async (decision: 'approve' | 'reject') => {
    setConfirming(null)
    if (!request) return
    try {
      await decide.mutateAsync({
        id,
        input: { decision, remarks: remarks.trim(), rowVersion: request.rowVersion },
      })
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (failure.fieldErrors.remarks ?? failure.message)
          : 'Could not save the decision.',
      )
      return
    }
    onClose()
  }

  const decided = request?.flow.filter((step) => step.remarks) ?? []

  return (
    <>
      <TransferDialogShell
        title={deciding ? 'Transfer Approval Approve' : 'Transfer Approval View'}
        onClose={onClose}
        aside={<ApplicationEditor value={request?.application ?? ''} readOnly />}
        footer={
          <>
            {deciding && request && (
              <>
                <Button
                  type="button"
                  onClick={() => {
                    setPanel('flow')
                  }}
                  className={cn(footerButton, decisionButton.flow, 'min-w-20')}
                >
                  Flow
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setPanel('history')
                  }}
                  className={cn(footerButton, btn.orange, 'mr-auto min-w-20')}
                >
                  History
                </Button>
                <Button
                  type="button"
                  disabled={decide.isPending || !canApprove || !may('approve')}
                  onClick={() => {
                    ask('approve')
                  }}
                  className={cn(footerButton, btn.navy, 'min-w-20', decisionText)}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  disabled={decide.isPending || !canReject || !may('reject')}
                  onClick={() => {
                    ask('reject')
                  }}
                  className={cn(footerButton, decisionButton.reject, 'min-w-20', decisionText)}
                >
                  Reject
                </Button>
              </>
            )}
            <Button
              type="button"
              onClick={onClose}
              className={cn(footerButton, btn.red, deciding && 'min-w-20')}
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
          <div className="grid gap-6">
            <TransferEmployeeCard employee={request.employee} />
            {request.status === 'cancelling' && deciding && (
              <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                {request.employee.name} asks to cancel this approved transfer
                {request.cancelReason ? `: ${request.cancelReason}` : '.'} Approving the
                cancellation takes it out of the transfer records.
              </p>
            )}
            <ReadOnlyRow label="Location" value={request.payload.locationName ?? '—'} />
            <ReadOnlyRow label="Branch" value={request.payload.branchName ?? '—'} />
            <ReadOnlyRow label="Department" value={request.payload.departmentName ?? '—'} />
            <ReadOnlyRow
              label="Effective Date"
              value={
                <span className="flex w-full items-center justify-between gap-2">
                  {request.payload.effectiveDate
                    ? format(day(request.payload.effectiveDate), 'MMMM d, yyyy')
                    : '—'}
                  <CalendarDays aria-hidden="true" className="size-4 text-heading" />
                </span>
              }
            />
            <ReadOnlyRow label="Line Manager" value={request.payload.lineManagerName ?? '—'} />
            <ReadOnlyRow
              label="Final Authority"
              value={request.payload.finalAuthorityName ?? '—'}
            />
            <ReadOnlyRow
              label="Attachment"
              value={<RequestFileLinks files={request.attachments} />}
            />
            <ReadOnlyRow
              label="Description"
              value={
                <span className="min-h-24 w-full py-1 whitespace-pre-wrap">
                  {request.description ?? ''}
                </span>
              }
            />
            <ReadOnlyRow
              label="Created"
              value={format(parseISO(request.createdAt), 'MMMM d, yyyy hh:mm a')}
            />
            {deciding ? (
              <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @3xl:grid-cols-[11rem_minmax(0,1fr)]">
                <label htmlFor={remarksId} className="font-inter text-base text-heading @xl:py-2">
                  Remarks
                </label>
                <div className="grid gap-1.5">
                  <Textarea
                    id={remarksId}
                    rows={4}
                    maxLength={500}
                    value={remarks}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${remarksId}-error` : undefined}
                    onChange={(event) => {
                      setRemarks(event.target.value)
                      if (error) setError(null)
                    }}
                  />
                  {error && (
                    <p id={`${remarksId}-error`} role="alert" className="text-xs text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <ReadOnlyRow
                label="Remarks"
                value={
                  <span className="min-h-20 w-full py-1 whitespace-pre-wrap">
                    {decided.map((step) => `${step.authority}: ${step.remarks ?? ''}`).join('\n')}
                  </span>
                }
              />
            )}
          </div>
        )}
      </TransferDialogShell>
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
        <RequestFlowDialog
          kind="transfer"
          id={id}
          via={via}
          onClose={() => {
            setPanel(null)
          }}
        />
      )}
      {panel === 'history' && (
        <RequestHistoryDialog
          kind="transfer"
          id={id}
          via={via}
          onClose={() => {
            setPanel(null)
          }}
        />
      )}
    </>
  )
}
