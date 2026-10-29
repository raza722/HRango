import { useId } from 'react'
import { type Control, Controller, type FieldPath, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { useOvertimeSettings, useSaveOvertimeSettings } from '../../hooks/use-overtime'
import {
  overtimeSettingsSchema,
  type OvertimeSettingsValues,
  toOvertimeSettings,
  toSettingsValues,
} from '../../schemas/overtime.schema'
import { navyButtonClass, pageTitleClass } from '../../utils/settings-styles'

type SwitchName = Exclude<FieldPath<OvertimeSettingsValues>, 'encashmentShiftHours'>

/** The switches with the requirements' wording ("Overtime Settings", 01-Requests). */
const SWITCHES: [SwitchName, string][] = [
  ['overtimeOnCheckIn', 'Overtime Applicable on Check-in'],
  ['overtimeOnCheckOut', 'Overtime Applicable on Checkout'],
  ['overtimeApprovalRequired', 'Overtime Approval Required'],
  ['doNotAutoCreateRequests', 'Do Not Auto-Create Overtime Requests'],
  ['overtimeOnHolidays', 'Is Overtime Applicable on Holidays'],
  ['overtimeAfterDutyDuration', 'Overtime Applicable After Duty Duration'],
]

/** A setting as the Attendance Settings Basic tab draws it: the question, then a navy switch. */
function ToggleRow({
  control,
  name,
  label,
  disabled,
}: {
  control: Control<OvertimeSettingsValues>
  name: SwitchName
  label: string
  disabled: boolean
}) {
  const id = useId()
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-1.5 @xl:grid-cols-[22rem_auto] @xl:justify-start">
      <label htmlFor={id} className="text-sm text-title">
        {label}
      </label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            id={id}
            ref={field.ref}
            checked={field.value}
            disabled={disabled}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            className="data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary"
          />
        )}
      />
    </div>
  )
}

/**
 * Settings (not drawn: the tab is in the frames' tab row, its page is not): the overtime
 * settings (`GET/PUT /attendance/settings/overtime`) in the style of Attendance Settings →
 * Basic: six switches, Shift Hours for Overtime Encashment (hours here, minutes on the API)
 * and Save Changes, which sends the rowVersion last read. Read-only without
 * `attendance.settings.overtime.edit`.
 */
export function OvertimeSettingsTab() {
  const settings = useOvertimeSettings()
  const save = useSaveOvertimeSettings()
  const canEdit = useCan('attendance.settings.overtime.edit')
  const hoursId = useId()
  const form = useForm<OvertimeSettingsValues>({
    resolver: zodResolver(overtimeSettingsSchema),
    values: settings.data ? toSettingsValues(settings.data) : undefined,
  })
  const { errors } = form.formState

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toOvertimeSettings(values, settings.data?.rowVersion ?? null))
    } catch (failure) {
      if (!(failure instanceof ApiError)) return
      const shift = failure.fieldErrors.encashmentShiftMinutes
      if (shift) form.setError('encashmentShiftHours', { message: shift })
      else form.setError('root', { message: failure.message })
    }
  })

  if (settings.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {settings.error.message}
      </p>
    )
  }
  if (!settings.data) {
    return (
      <div className="grid gap-3" aria-busy="true">
        <Skeleton className="h-7 w-56" />
        {SWITCHES.map(([name]) => (
          <Skeleton key={name} className="h-6 w-full max-w-md" />
        ))}
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-labelledby="overtime-settings-title"
      className="@container flex min-h-[28rem] flex-col gap-4"
    >
      <h2 id="overtime-settings-title" className={pageTitleClass}>
        Overtime Settings
      </h2>
      <div className="grid gap-1">
        {SWITCHES.map(([name, label]) => (
          <ToggleRow
            key={name}
            control={form.control}
            name={name}
            label={label}
            disabled={!canEdit}
          />
        ))}
      </div>
      <div className="grid max-w-sm gap-2 pt-2">
        <label htmlFor={hoursId} className="text-sm text-title">
          Shift Hours for Overtime Encashment
        </label>
        <Input
          id={hoursId}
          inputMode="decimal"
          placeholder="e.g. 8"
          disabled={!canEdit}
          className="text-grey placeholder:text-[#A4A4A4] dark:placeholder:text-label"
          aria-invalid={errors.encashmentShiftHours ? true : undefined}
          aria-describedby={`${hoursId}-help${errors.encashmentShiftHours ? ` ${hoursId}-error` : ''}`}
          {...form.register('encashmentShiftHours')}
        />
        <p id={`${hoursId}-help`} className="text-xs text-muted-foreground">
          The shift length a day of overtime encashment counts as. Leave empty for none.
        </p>
        {errors.encashmentShiftHours && (
          <p id={`${hoursId}-error`} role="alert" className="text-xs text-destructive">
            {errors.encashmentShiftHours.message}
          </p>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
        {canEdit && (
          <Button
            type="submit"
            size="lg"
            disabled={save.isPending || !form.formState.isDirty}
            className={cn('min-w-36 text-base', navyButtonClass)}
          >
            Save Changes
          </Button>
        )}
        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
      </div>
    </form>
  )
}
