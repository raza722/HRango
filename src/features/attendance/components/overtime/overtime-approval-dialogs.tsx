import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FieldLayoutContext, TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { EmployeeSearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useBulkRejectOvertime,
  useConsentOvertime,
  useForwardOvertime,
  useOvertimeDetail,
} from '../../hooks/use-overtime'
import type { OvertimeApplication, OvertimeBulkResult } from '../../types/overtime.types'
import { dayLabel, stampLabel } from '../../utils/overtime-format'
import { dialogSubmitButtonClass } from '../../utils/overtime-styles'
import { OvertimeDialog } from './overtime-parts'

const remarksRule = z.string().trim().max(4000, 'Keep it under 4000 characters')

/** The request a popup is about: code, person and the hours asked for. */
function Summary({ application }: { application: OvertimeApplication }) {
  return (
    <p className="text-sm text-title">
      {application.code}, {application.employeeName}:{' '}
      {stampLabel(application.date, application.startTime)} to{' '}
      {stampLabel(application.date, application.endTime)}, {application.appliedMinutes} minutes.
    </p>
  )
}

const forwardSchema = z.object({
  employeeId: z
    .string()
    .nullable()
    .refine((value) => value !== null && value !== '', {
      message: 'Choose whom to forward it to',
    }),
  remarks: remarksRule,
})

/**
 * Forward (`POST /requests/approvals/{id}/forward {employeeId, remarks, rowVersion}`): the step
 * waiting for you passes to the person chosen, who decides it in your place. Reads the request
 * as an approver first, for its rowVersion and whether it may still be forwarded.
 */
export function OvertimeForwardDialog({
  application,
  onClose,
}: {
  application: OvertimeApplication
  onClose: () => void
}) {
  const formId = useId()
  const forward = useForwardOvertime()
  const detail = useOvertimeDetail(application.id, 'approvals')
  const refused = detail.data !== undefined && !detail.data.actions.includes('forward')
  const form = useForm<z.infer<typeof forwardSchema>>({
    resolver: zodResolver(forwardSchema),
    defaultValues: { employeeId: null, remarks: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    if (!detail.data || !values.employeeId) return
    try {
      await forward.mutateAsync({
        id: application.id,
        employeeId: values.employeeId,
        remarks: values.remarks.trim() || null,
        rowVersion: detail.data.rowVersion,
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        const field = failure.fieldErrors.employeeId ? 'employeeId' : 'root'
        form.setError(field, { message: failure.fieldErrors.employeeId ?? failure.message })
      }
      return
    }
    onClose()
  })

  return (
    <OvertimeDialog
      title="Forward Overtime"
      description={`${application.code}, ${application.employeeName}`}
      onClose={onClose}
      formId={formId}
      submitLabel="Forward"
      pending={forward.isPending || !detail.data || refused}
      error={form.formState.errors.root?.message ?? detail.error?.message}
      className="max-w-xl"
    >
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
        >
          <Summary application={application} />
          {refused && (
            <p role="alert" className="text-sm text-destructive">
              This request no longer waits for you, so it cannot be forwarded.
            </p>
          )}
          <EmployeeSearchSelectField
            control={form.control}
            name="employeeId"
            label="Forward To"
            placeholder="Choose an employee"
            filters={{ permission: 'requests.approvals.view' }}
            include={(row) => row.id !== application.employeeId}
            required
          />
          <TextareaField
            control={form.control}
            name="remarks"
            label="Remarks"
            rows={3}
            maxLength={4000}
          />
        </form>
      </FieldLayoutContext>
    </OvertimeDialog>
  )
}

/**
 * Consent, from the Consents box (`POST /requests/approvals/{id}/consent {agree, remarks,
 * rowVersion}`): a Can Disagree step asks whether you agree; a disagreement needs remarks. Both
 * are recorded and the flow goes on; the final authority sees a disagreement.
 */
export function OvertimeConsentDialog({
  application,
  onClose,
}: {
  application: OvertimeApplication
  onClose: () => void
}) {
  const consent = useConsentOvertime()
  const detail = useOvertimeDetail(application.id, 'approvals')
  const remarksId = useId()
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const actions = detail.data?.actions ?? []
  const waiting = actions.includes('consent') || actions.includes('disagree')
  const busy = consent.isPending || !detail.data

  const submit = async (agree: boolean) => {
    if (!detail.data) return
    if (!agree && !remarks.trim()) {
      setError('Give the reason for disagreeing')
      return
    }
    setError(null)
    try {
      await consent.mutateAsync({
        id: application.id,
        agree,
        remarks: remarks.trim() || null,
        rowVersion: detail.data.rowVersion,
      })
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (failure.fieldErrors.remarks ?? failure.message)
          : 'Not saved.',
      )
      return
    }
    onClose()
  }

  return (
    <OvertimeDialog
      title="Overtime Consent"
      description={`${application.code}, ${application.employeeName}: your agreement is asked`}
      onClose={onClose}
      onSubmit={() => void submit(true)}
      submitLabel="Agree"
      pending={busy || !actions.includes('consent')}
      error={error ?? detail.error?.message}
      actions={
        <Button
          type="button"
          disabled={busy || !actions.includes('disagree')}
          onClick={() => void submit(false)}
          className={cn(dialogSubmitButtonClass, 'bg-[#7E2448] hover:bg-[#7E2448]/90')}
        >
          Disagree
        </Button>
      }
      className="max-w-xl"
    >
      <div className="grid gap-4">
        <Summary application={application} />
        <p className="text-sm text-grey">
          The approvers still decide; your answer is recorded in the request&apos;s history.
        </p>
        {detail.data && !waiting && (
          <p role="alert" className="text-sm text-destructive">
            Your consent is no longer asked on this request.
          </p>
        )}
        <div className="grid gap-2">
          <label htmlFor={remarksId} className="text-sm leading-none text-title">
            Remarks <span className="text-grey">(required to disagree)</span>
          </label>
          <textarea
            id={remarksId}
            rows={3}
            maxLength={4000}
            value={remarks}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setRemarks(event.target.value)
              if (error) setError(null)
            }}
            className="min-h-24 w-full rounded-lg border border-[#CFCFCF] bg-transparent px-4 py-2 text-sm text-title outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-input"
          />
        </div>
      </div>
    </OvertimeDialog>
  )
}

const rejectSchema = z.object({
  remarks: remarksRule.min(1, 'Give the reason for rejecting'),
})

/**
 * Reject Selected on Applications (`POST /requests/approvals/bulk-reject {items, remarks}`): the
 * ticked requests are rejected one by one with the same reason; those the API refuses stay
 * listed here with its reason.
 */
export function OvertimeBulkRejectDialog({
  applications,
  onClose,
  onDone,
}: {
  applications: readonly OvertimeApplication[]
  onClose: () => void
  /** The ids that were rejected (to untick them). */
  onDone: (rejectedIds: readonly string[]) => void
}) {
  const formId = useId()
  const reject = useBulkRejectOvertime()
  const [refused, setRefused] = useState<OvertimeBulkResult[]>([])
  const form = useForm<z.infer<typeof rejectSchema>>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { remarks: '' },
  })
  const codeOf = (id: string) =>
    applications.find((application) => application.id === id)?.code ?? id

  const submit = form.handleSubmit(async (values) => {
    let results: OvertimeBulkResult[]
    try {
      results = await reject.mutateAsync({
        items: applications.map(({ id, rowVersion }) => ({ id, rowVersion })),
        remarks: values.remarks.trim(),
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        form.setError(failure.fieldErrors.remarks ? 'remarks' : 'root', {
          message: failure.fieldErrors.remarks ?? failure.message,
        })
      }
      return
    }
    const failed = results.filter((result) => !result.ok)
    onDone(results.filter((result) => result.ok).map((result) => result.id))
    if (failed.length === 0) {
      onClose()
      return
    }
    setRefused(failed)
  })
  const count = applications.length

  return (
    <OvertimeDialog
      title="Reject Overtime"
      description={`${String(count)} request${count === 1 ? '' : 's'} chosen`}
      onClose={onClose}
      formId={formId}
      submitLabel={`Reject ${String(count)}`}
      pending={reject.isPending || refused.length > 0}
      error={form.formState.errors.root?.message}
      cancelLabel={refused.length > 0 ? 'Close' : 'Cancel'}
      className="max-w-xl"
    >
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4"
        >
          <ul className="grid max-h-40 gap-1 overflow-y-auto text-sm text-title">
            {applications.map((application) => (
              <li key={application.id}>
                {application.code}, {application.employeeName}: {dayLabel(application.date)},{' '}
                {application.appliedMinutes} minutes
              </li>
            ))}
          </ul>
          {refused.length > 0 ? (
            <div role="alert" className="grid gap-1 text-sm text-destructive">
              <p>
                {refused.length} of {count} could not be rejected:
              </p>
              <ul className="grid gap-1">
                {refused.map((result) => (
                  <li key={result.id}>
                    {codeOf(result.id)}: {result.message ?? 'Not rejected.'}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <TextareaField
              control={form.control}
              name="remarks"
              label="Reason for Rejection"
              required
              rows={4}
              maxLength={4000}
            />
          )}
        </form>
      </FieldLayoutContext>
    </OvertimeDialog>
  )
}
