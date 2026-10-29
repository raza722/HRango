import { useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { ErrorState } from '@/components/feedback/error-state'
import { SelectField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { APPROVE_ON_STATUS_LABELS, FINAL_APPROVAL_LABELS, LEAVE_CODES } from '../../constants'
import { useLeaveSettings, useSaveLeaveSettings } from '../../hooks/use-leaves'
import { APPROVE_ON_STATUSES, FINAL_APPROVAL_AUTHORITIES } from '../../types/leaves.types'
import {
  leaveSettingsFieldsClass,
  settingsCancelButtonClass,
  settingsSaveButtonClass,
} from '../../utils/styles'

const schema = z.object({
  finalApprovalBy: z.enum(FINAL_APPROVAL_AUTHORITIES, {
    error: 'Choose who gives the final approval',
  }),
  approveOnStatus: z.enum(APPROVE_ON_STATUSES, { error: 'Choose the status' }),
  postDeadline: z.boolean(),
})
type Values = z.infer<typeof schema>

/**
 * Settings → General Settings (frame 4428:90230, `GET/PUT /leaves/settings`): Leave Final
 * Approval By, Approve Leave on Status, the Post Leave Application Deadline switch, then
 * Cancel and Save Changes (with `leaves.settings.general.edit`). Labels Poppins Regular 14
 * #303030, fields 40px with 8px corners, the switch navy. The backend stores the three values;
 * approval flows and balances do not read them yet.
 */
export function LeaveGeneralSettingsPage() {
  const settings = useLeaveSettings()
  const save = useSaveLeaveSettings()
  const canEdit = useCan(LEAVE_CODES.generalEdit)
  const switchId = useId()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: settings.data && {
      finalApprovalBy: settings.data.finalApprovalBy,
      approveOnStatus: settings.data.approveOnStatus,
      postDeadline: settings.data.postDeadline,
    },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ ...values, rowVersion: settings.data?.rowVersion ?? null })
      form.reset(values)
    } catch (failure) {
      if (failure instanceof ApiError) form.setError('root', { message: failure.message })
    }
  })

  if (settings.error && !settings.data) {
    return (
      <ErrorState
        message={settings.error.message}
        onRetry={() => {
          void settings.refetch()
        }}
        className="shadow-none"
      />
    )
  }
  if (!settings.data) {
    return (
      <div className="grid gap-6" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-6 w-72" />
      </div>
    )
  }

  return (
    <form
      noValidate
      aria-label="General Settings"
      onSubmit={(event) => void submit(event)}
      className={cn('grid gap-6', leaveSettingsFieldsClass)}
    >
      <SelectField
        control={form.control}
        name="finalApprovalBy"
        label="Leave Final Approval By"
        placeholder="Select"
        disabled={!canEdit}
        options={FINAL_APPROVAL_AUTHORITIES.map((value) => ({
          value,
          label: FINAL_APPROVAL_LABELS[value],
        }))}
        description="Whose approval completes a leave application. Who approves each step is set in Requests → Settings → Request Flows."
      />
      <SelectField
        control={form.control}
        name="approveOnStatus"
        label="Approve Leave on Status"
        placeholder="Select"
        disabled={!canEdit}
        options={APPROVE_ON_STATUSES.map((value) => ({
          value,
          label: APPROVE_ON_STATUS_LABELS[value],
        }))}
        description="When an application counts as leave taken: once it is approved, or as soon as it is applied for (pending)."
      />
      <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
        <label htmlFor={switchId} className="text-sm text-title">
          Post Leave Application Deadline
        </label>
        <Controller
          control={form.control}
          name="postDeadline"
          render={({ field }) => (
            <Switch
              id={switchId}
              ref={field.ref}
              checked={field.value}
              disabled={!canEdit}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
              aria-describedby={`${switchId}-help`}
              className="data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary"
            />
          )}
        />
        <p id={`${switchId}-help`} className="basis-full text-xs text-muted-foreground">
          When on, a back-dated application must be posted within the leave type’s Back Date Leave
          Limit in Days.
        </p>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-4 pt-6">
          {form.formState.errors.root && (
            <p role="alert" className="mr-auto text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
          <Button
            type="button"
            disabled={!form.formState.isDirty || save.isPending}
            onClick={() => {
              form.reset()
            }}
            className={settingsCancelButtonClass}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={save.isPending || !form.formState.isDirty}
            className={settingsSaveButtonClass}
          >
            Save Changes
          </Button>
        </div>
      )}
    </form>
  )
}
