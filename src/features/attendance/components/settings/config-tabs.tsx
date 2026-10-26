import { type ComponentProps, useId } from 'react'
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
  useForm,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  useBasicSettings,
  useSaveBasicSettings,
  useSaveSchedulingSettings,
  useSchedulingSettings,
} from '../../hooks/use-attendance-settings'
import type { BasicSettings } from '../../types/settings.types'
import { navyButtonClass, pageTitleClass } from '../../utils/settings-styles'

const minutes = (max: number, maxText: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d+$/.test(value), 'Whole minutes only')
    .refine((value) => value === '' || Number(value) <= max, maxText)

const basicSchema = z.object({
  ignorePunchType: z.boolean(),
  useCheckInOutForBreaks: z.boolean(),
  shortDurationOnNonFlexible: z.boolean(),
  dashboardPunch: z.boolean(),
  allowMultiShift: z.boolean(),
  pictureOnDashboardPunch: z.boolean(),
  minimumWorkableMinutes: minutes(1440, 'At most 1,440 minutes (a day)'),
  lateGraceMinutes: minutes(240, 'At most 240 minutes'),
})
type BasicValues = z.infer<typeof basicSchema>

const schedulingSchema = z.object({
  geoFenceRequiredOnShift: z.boolean(),
  ignoreRestDaysForLeaves: z.boolean(),
})
type SchedulingValues = z.infer<typeof schedulingSchema>

const toBasicValues = (settings: BasicSettings): BasicValues => ({
  ignorePunchType: settings.ignorePunchType,
  useCheckInOutForBreaks: settings.useCheckInOutForBreaks,
  shortDurationOnNonFlexible: settings.shortDurationOnNonFlexible,
  dashboardPunch: settings.dashboardPunch,
  allowMultiShift: settings.allowMultiShift,
  pictureOnDashboardPunch: settings.pictureOnDashboardPunch,
  minimumWorkableMinutes: settings.minimumWorkableMinutes
    ? String(settings.minimumWorkableMinutes)
    : '',
  lateGraceMinutes: String(settings.lateGraceMinutes),
})

const toBasicSettings = (values: BasicValues, rowVersion: string | null): BasicSettings => ({
  ...values,
  minimumWorkableMinutes:
    values.minimumWorkableMinutes === '' ? 0 : Number(values.minimumWorkableMinutes),
  lateGraceMinutes: values.lateGraceMinutes === '' ? 0 : Number(values.lateGraceMinutes),
  rowVersion,
})

/** A setting as drawn: the question on the left, a navy switch on the right. */
function ToggleRow<T extends FieldValues>({
  control,
  name,
  label,
  disabled,
}: {
  control: Control<T>
  name: FieldPath<T>
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
            checked={field.value === true}
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

const BASIC: [FieldPath<BasicValues>, string][] = [
  ['ignorePunchType', 'Ignore punch type while computing attendance?'],
  ['useCheckInOutForBreaks', 'Use Check IN/Check OUT for computing breaks.'],
  ['shortDurationOnNonFlexible', 'Short duration applicable on non-flexible'],
  ['dashboardPunch', 'Employee can mark punch from their dashboard'],
  ['allowMultiShift', 'Allow Multi Shift on single day'],
  ['pictureOnDashboardPunch', 'Take Picture For Attendance For Dashboard'],
]

const SCHEDULING: [FieldPath<SchedulingValues>, string][] = [
  ['geoFenceRequiredOnShift', 'Geo Fences Required On Shift'],
  ['ignoreRestDaysForLeaves', 'Ignore rest days for shift selection in leaves and relaxation.'],
]

function LoadingForm() {
  return (
    <div className="grid gap-3 px-4 py-6 sm:px-6">
      <Skeleton className="h-7 w-56" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-6 w-full max-w-md" />
      ))}
    </div>
  )
}

function SaveRow({
  disabled,
  error,
  hidden,
}: {
  disabled: boolean
  error: string | undefined
  hidden: boolean
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-4 pt-8">
      {!hidden && (
        <Button
          type="submit"
          size="lg"
          disabled={disabled}
          className={cn('min-w-36 text-base', navyButtonClass)}
        >
          Save Changes
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** A minutes box with its help line and error. */
function MinutesField({
  label,
  help,
  error,
  disabled,
  ...input
}: {
  label: string
  help: string
  error: string | undefined
  disabled: boolean
} & ComponentProps<'input'>) {
  const id = useId()
  return (
    <div className="grid max-w-sm gap-2">
      <label htmlFor={id} className="text-sm text-title">
        {label}
      </label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="Enter minutes"
        disabled={disabled}
        className="text-grey placeholder:text-[#A4A4A4] dark:placeholder:text-label"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        {...input}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {help}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Basic Configurations (`/attendance/settings/basic`): the switches, Minimum Workable Minutes
 * and the daily late grace, saved with Save Changes (sends the rowVersion last read).
 */
function BasicTab() {
  const settings = useBasicSettings()
  const save = useSaveBasicSettings()
  const canEdit = useCan('attendance.settings.basic.edit')
  const form = useForm<BasicValues>({
    resolver: zodResolver(basicSchema),
    values: settings.data ? toBasicValues(settings.data) : undefined,
  })
  const { errors } = form.formState

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toBasicSettings(values, settings.data?.rowVersion ?? null))
    } catch (error) {
      if (!(error instanceof ApiError)) return
      const [field, message] = Object.entries(error.fieldErrors)[0] ?? []
      const known = BASIC.map(([name]) => name).concat([
        'minimumWorkableMinutes',
        'lateGraceMinutes',
      ])
      const target = known.find((name) => name === field)
      if (target && message) form.setError(target, { message })
      else form.setError('root', { message: error.message })
    }
  })

  if (settings.isError) {
    return (
      <p role="alert" className="px-4 py-6 text-sm text-destructive sm:px-6">
        {settings.error.message}
      </p>
    )
  }
  if (!settings.data) return <LoadingForm />

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-label="Basic Configurations"
      className="@container flex min-h-[28rem] flex-col gap-4 px-4 py-6 sm:px-6"
    >
      <h2 className={pageTitleClass}>Basic Configurations</h2>
      <div className="grid gap-1">
        {BASIC.map(([name, label]) => (
          <ToggleRow
            key={name}
            control={form.control}
            name={name}
            label={label}
            disabled={!canEdit}
          />
        ))}
      </div>
      <div className="grid gap-4 pt-2 @2xl:grid-cols-2">
        <MinutesField
          label="Minimum Workable Minutes"
          help="A finished day with fewer worked minutes counts as a Short Day. Leave empty to use the day's expected minutes."
          error={errors.minimumWorkableMinutes?.message}
          disabled={!canEdit}
          {...form.register('minimumWorkableMinutes')}
        />
        <MinutesField
          label="Late Grace Minutes"
          help="Minutes after the expected start that count as Grace, not Late."
          error={errors.lateGraceMinutes?.message}
          disabled={!canEdit}
          {...form.register('lateGraceMinutes')}
        />
      </div>
      <SaveRow
        hidden={!canEdit}
        disabled={save.isPending || !form.formState.isDirty}
        error={errors.root?.message}
      />
    </form>
  )
}

/**
 * Scheduling Configurations. The API stores no such switches yet (only the mock API answers);
 * against the real API the tab says so and the switches stay off.
 */
function SchedulingTab() {
  const settings = useSchedulingSettings()
  const save = useSaveSchedulingSettings()
  const form = useForm<SchedulingValues>({
    resolver: zodResolver(schedulingSchema),
    values: settings.data,
  })
  const unavailable = settings.isError

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(values)
    } catch (error) {
      if (error instanceof ApiError) form.setError('root', { message: error.message })
    }
  })

  if (settings.isPending) return <LoadingForm />

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-label="Scheduling Configurations"
      className="@container flex min-h-[28rem] flex-col gap-4 px-4 py-6 sm:px-6"
    >
      <h2 className={pageTitleClass}>Scheduling Configurations</h2>
      {unavailable && (
        <p role="status" className="max-w-xl rounded-md bg-muted px-3 py-2.5 text-sm text-grey">
          These switches cannot be saved yet: the server does not store them.
        </p>
      )}
      <div className="grid gap-1">
        {SCHEDULING.map(([name, label]) => (
          <ToggleRow
            key={name}
            control={form.control}
            name={name}
            label={label}
            disabled={unavailable}
          />
        ))}
      </div>
      <SaveRow
        hidden={unavailable}
        disabled={save.isPending || !form.formState.isDirty}
        error={form.formState.errors.root?.message}
      />
    </form>
  )
}

/** The Basic and Scheduling tabs. */
export function ConfigTab({ section }: { section: 'basic' | 'scheduling' }) {
  return section === 'basic' ? <BasicTab /> : <SchedulingTab />
}
