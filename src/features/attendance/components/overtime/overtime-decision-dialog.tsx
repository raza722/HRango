import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { FieldLayoutContext, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  useAllOvertimePolicies,
  useDecideOvertime,
  useOvertimeDetail,
} from '../../hooks/use-overtime'
import type { OvertimeApplication } from '../../types/overtime.types'
import {
  apiField,
  dayLabel,
  durationLabel,
  slabEncashmentLabel,
  stampLabel,
} from '../../utils/overtime-format'
import { applyPolicy, policyCap, policyOfPeriod } from '../../utils/overtime-policy'
import { dialogSubmitButtonClass } from '../../utils/overtime-styles'
import { OvertimeDialog, OvertimePersonCell, OvertimeReadOnly } from './overtime-parts'

const schema = z.object({
  approvedMinutes: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d+$/.test(value), 'Whole minutes only'),
  remarks: z.string().trim().max(4000, 'Keep it under 4000 characters'),
})
type Values = z.infer<typeof schema>

/**
 * Approve/Reject on Applications (`POST /requests/approvals/{id}/approve | reject`). Reads the
 * request as an approver first (`GET /requests/approvals/{id}`: rowVersion and whether it waits
 * for you). Approve sends the approved minutes (`details.approvedMinutes`, the applied minutes
 * by default); they may not pass the applied minutes, and the active daily policy's top slab
 * caps them. A cancellation is approved or rejected as it stands. Remarks are needed to reject.
 */
export function OvertimeDecisionDialog({
  application,
  onClose,
}: {
  application: OvertimeApplication
  onClose: () => void
}) {
  const formId = useId()
  const decide = useDecideOvertime()
  const detail = useOvertimeDetail(application.id, 'approvals')
  const policies = useAllOvertimePolicies()
  const canApprove = useCan('requests.approvals.approve')
  const canReject = useCan('requests.approvals.reject')
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null)
  const current = detail.data ?? application
  const cancelling = current.status === 'cancelling'
  const actions = detail.data?.actions ?? []
  const mayApprove = canApprove && actions.includes('approve')
  const mayReject = canReject && actions.includes('reject')
  const daily = policyOfPeriod(policies.data?.data ?? [], 'daily')
  const cap = policyCap(daily)
  const start = Math.min(current.approvedMinutes ?? current.appliedMinutes, cap ?? Infinity)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { approvedMinutes: String(start), remarks: '' },
  })
  const asked = useWatch({ control: form.control, name: 'approvedMinutes' })
  const minutes = /^\d+$/.test(asked) ? Number(asked) : 0
  const outcome = applyPolicy(daily, minutes)

  const run = async (decision: 'approve' | 'reject') => {
    if (!detail.data) return
    const values = form.getValues()
    try {
      await decide.mutateAsync({
        id: application.id,
        decision,
        input: {
          remarks: values.remarks.trim() || null,
          ...(decision === 'approve' && !cancelling
            ? { approvedMinutes: Number(values.approvedMinutes) }
            : {}),
          rowVersion: detail.data.rowVersion,
        },
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        const fields = Object.fromEntries(
          Object.entries(failure.fieldErrors).map(([key, message]) => [apiField(key), message]),
        )
        if (fields.approvedMinutes) {
          form.setError('approvedMinutes', { message: fields.approvedMinutes })
        } else if (fields.remarks) form.setError('remarks', { message: fields.remarks })
        else form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  }

  const approve = form.handleSubmit((values) => {
    if (!cancelling) {
      const value = Number(values.approvedMinutes)
      const problem =
        values.approvedMinutes === ''
          ? 'Enter the minutes to approve'
          : value <= 0
            ? 'Approve more than 0 minutes, or reject the request'
            : value > current.appliedMinutes
              ? `At most the ${String(current.appliedMinutes)} minutes applied for`
              : cap !== null && value > cap
                ? `${daily?.name ?? 'The daily policy'} caps a day at ${String(cap)} minutes`
                : null
      if (problem) {
        form.setError('approvedMinutes', { message: problem })
        return
      }
    }
    setConfirm('approve')
  })
  const reject = () => {
    form.clearErrors()
    if (!form.getValues('remarks').trim()) {
      form.setError('remarks', { message: 'Give a reason for rejecting' })
      return
    }
    setConfirm('reject')
  }

  const policyHint = policies.isPending
    ? 'Reading the overtime policy…'
    : !daily
      ? 'No active daily overtime policy: the minutes are approved as entered.'
      : outcome.capped
        ? `${daily.name} caps a day at ${String(cap)} minutes.`
        : outcome.slab
          ? `${daily.name}: ${String(minutes)} minutes fall in the ${String(outcome.slab.minMinutes)}–${String(outcome.slab.maxMinutes)} slab (${slabEncashmentLabel(outcome.slab)}).`
          : `${daily.name}: ${String(minutes)} minutes fall in no slab.`

  return (
    <OvertimeDialog
      title={cancelling ? 'Overtime Cancellation Approve/Reject' : 'Overtime Approve/Reject'}
      description={`${current.code}, ${current.employeeName}`}
      onClose={onClose}
      formId={formId}
      submitLabel="Approve"
      readOnly={!canApprove}
      pending={decide.isPending || !mayApprove}
      error={form.formState.errors.root?.message ?? detail.error?.message}
      className="max-w-[53.5rem]"
      actions={
        canReject && (
          <Button
            type="button"
            disabled={decide.isPending || !mayReject}
            onClick={reject}
            className={cn(dialogSubmitButtonClass, 'bg-[#7E2448] hover:bg-[#7E2448]/90')}
          >
            Reject
          </Button>
        )
      }
    >
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void approve(event)}
          className="grid gap-4 @lg:grid-cols-2"
        >
          <div className="@lg:col-span-2">
            <OvertimePersonCell name={current.employeeName} code={current.employeeCode} />
          </div>
          {detail.data && !mayApprove && !mayReject && (
            <p
              role="status"
              className="rounded-md bg-[#FFF3D9] px-4 py-3 text-sm text-[#8A5A00] @lg:col-span-2 dark:bg-amber-500/15 dark:text-amber-200"
            >
              This request is not waiting for your decision
              {current.nextApproverName ? ` (next: ${current.nextApproverName})` : ''}.
            </p>
          )}
          {cancelling && (
            <p className="rounded-md bg-[#FFEDE0] px-4 py-3 text-sm text-[#9A4A12] @lg:col-span-2 dark:bg-orange-500/15 dark:text-orange-200">
              {current.employeeName} asks to cancel this approved overtime
              {current.cancelReason ? `: ${current.cancelReason}` : ''}. Approve to cancel it and
              take the minutes off the time sheet; reject to keep it.
            </p>
          )}
          <OvertimeReadOnly label="Code" value={current.code} />
          <OvertimeReadOnly label="Date" value={dayLabel(current.date)} />
          <OvertimeReadOnly label="From" value={stampLabel(current.date, current.startTime)} />
          <OvertimeReadOnly label="To" value={stampLabel(current.date, current.endTime)} />
          <OvertimeReadOnly
            label="Applied Minutes"
            value={`${String(current.appliedMinutes)} (${durationLabel(current.appliedMinutes)})`}
          />
          <OvertimeReadOnly label="Department" value={current.departmentName ?? '—'} />
          <OvertimeReadOnly
            label="Reason for Overtime"
            value={current.reason ?? '—'}
            className="@lg:col-span-2"
          />
          {!cancelling && (
            <TextField
              control={form.control}
              name="approvedMinutes"
              label="Approved Minutes"
              inputMode="numeric"
              required
              disabled={!mayApprove}
              description={policyHint}
            />
          )}
          <TextareaField
            control={form.control}
            name="remarks"
            label="Remarks"
            placeholder="Needed to reject"
            rows={3}
            maxLength={4000}
            disabled={!mayApprove && !mayReject}
          />
        </form>
      </FieldLayoutContext>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={confirm === 'reject' ? 'Reject the request' : 'Approve the request'}
        description={
          confirm === 'reject'
            ? `Reject ${current.employeeName}'s ${cancelling ? 'cancellation' : 'overtime'} of ${dayLabel(current.date)}?`
            : cancelling
              ? `Cancel ${current.employeeName}'s overtime of ${dayLabel(current.date)}?`
              : `Approve ${String(minutes)} minutes for ${current.employeeName}?`
        }
        confirmLabel="Yes"
        cancelLabel="No"
        variant={confirm === 'reject' ? 'destructive' : 'default'}
        onConfirm={() => {
          const decision = confirm
          setConfirm(null)
          if (decision) void run(decision)
        }}
      />
    </OvertimeDialog>
  )
}
