import { useId } from 'react'
import { type Control, Controller, type FieldPath, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useAttendanceSettings, useSaveSettings } from '../../hooks/use-attendance-settings'
import type { AttendanceSettings } from '../../types/settings.types'
import { navyButtonClass, pageTitleClass } from '../../utils/settings-styles'

const formSchema = z.object({
  basic: z.object({
    ignorePunchType: z.boolean(),
    useCheckInOutForBreaks: z.boolean(),
    shortDurationOnNonFlexible: z.boolean(),
    dashboardPunch: z.boolean(),
    multiShiftPerDay: z.boolean(),
    pictureOnDashboardPunch: z.boolean(),
    minimumWorkableMinutes: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d+$/.test(value), 'Whole minutes only')
      .refine((value) => value === '' || Number(value) <= 1440, 'At most 1,440 minutes (a day)'),
  }),
  scheduling: z.object({
    geoFenceRequiredOnShift: z.boolean(),
    ignoreRestDaysForLeaves: z.boolean(),
  }),
})
type FormValues = z.infer<typeof formSchema>

const toValues = (settings: AttendanceSettings): FormValues => ({
  basic: {
    ...settings.basic,
    minimumWorkableMinutes:
      settings.basic.minimumWorkableMinutes === null
        ? ''
        : String(settings.basic.minimumWorkableMinutes),
  },
  scheduling: settings.scheduling,
})

const toSettings = (values: FormValues): AttendanceSettings => ({
  basic: {
    ...values.basic,
    minimumWorkableMinutes:
      values.basic.minimumWorkableMinutes === ''
        ? null
        : Number(values.basic.minimumWorkableMinutes),
  },
  scheduling: values.scheduling,
})

type BooleanField = Exclude<
  FieldPath<FormValues>,
  'basic' | 'scheduling' | 'basic.minimumWorkableMinutes'
>

/** A setting as drawn: the question on the left, a navy switch on the right. */
function ToggleRow({
  control,
  name,
  label,
}: {
  control: Control<FormValues>
  name: BooleanField
  label: string
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
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            className="data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary"
          />
        )}
      />
    </div>
  )
}

const BASIC: [BooleanField, string][] = [
  ['basic.ignorePunchType', 'Ignore punch type while computing attendance?'],
  ['basic.useCheckInOutForBreaks', 'Use Check IN/Check OUT for computing breaks.'],
  ['basic.shortDurationOnNonFlexible', 'Short duration applicable on non-flexible'],
  ['basic.dashboardPunch', 'Employee can mark punch from their dashboard'],
  ['basic.multiShiftPerDay', 'Allow Multi Shift on single day'],
  ['basic.pictureOnDashboardPunch', 'Take Picture For Attendance For Dashboard'],
]

const SCHEDULING: [BooleanField, string][] = [
  ['scheduling.geoFenceRequiredOnShift', 'Geo Fences Required On Shift'],
  [
    'scheduling.ignoreRestDaysForLeaves',
    'Ignore rest days for shift selection in leaves and relaxation.',
  ],
]

/**
 * Basic Configurations and Scheduling Configurations: switches and Minimum
 * Workable Minutes, saved with Save Changes. Both tabs save the whole set.
 */
export function ConfigTab({ section }: { section: 'basic' | 'scheduling' }) {
  const settings = useAttendanceSettings()
  const save = useSaveSettings()
  const minutesId = useId()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: settings.data ? toValues(settings.data) : undefined,
  })
  const minutesError = form.formState.errors.basic?.minimumWorkableMinutes?.message

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toSettings(values))
    } catch (error) {
      if (error instanceof ApiError) form.setError('root', { message: error.message })
    }
  })

  if (!settings.data) {
    return (
      <div className="grid gap-3 px-4 py-6 sm:px-6">
        <Skeleton className="h-7 w-56" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-full max-w-md" />
        ))}
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-label={section === 'basic' ? 'Basic Configurations' : 'Scheduling Configurations'}
      className="@container flex min-h-[28rem] flex-col gap-4 px-4 py-6 sm:px-6"
    >
      <h2 className={pageTitleClass}>
        {section === 'basic' ? 'Basic Configurations' : 'Scheduling Configurations'}
      </h2>
      <div className="grid gap-1">
        {(section === 'basic' ? BASIC : SCHEDULING).map(([name, label]) => (
          <ToggleRow key={name} control={form.control} name={name} label={label} />
        ))}
      </div>
      {section === 'basic' && (
        <div className="grid max-w-sm gap-2 pt-2">
          <label htmlFor={minutesId} className="text-sm text-title">
            Minimum Workable Minutes
          </label>
          <Input
            id={minutesId}
            inputMode="numeric"
            placeholder="Enter minutes"
            className="text-grey placeholder:text-[#A4A4A4] dark:placeholder:text-label"
            aria-invalid={minutesError ? true : undefined}
            aria-describedby={`${minutesId}-help${minutesError ? ` ${minutesId}-error` : ''}`}
            {...form.register('basic.minimumWorkableMinutes')}
          />
          <p id={`${minutesId}-help`} className="text-xs text-muted-foreground">
            A finished day with fewer worked minutes counts as a Short Day. Leave empty for no
            limit.
          </p>
          {minutesError && (
            <p id={`${minutesId}-error`} role="alert" className="text-xs text-destructive">
              {minutesError}
            </p>
          )}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
        <Button
          type="submit"
          size="lg"
          disabled={save.isPending || !form.formState.isDirty}
          className={cn('min-w-36 text-base', navyButtonClass)}
        >
          Save Changes
        </Button>
        {form.formState.errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
      </div>
    </form>
  )
}
