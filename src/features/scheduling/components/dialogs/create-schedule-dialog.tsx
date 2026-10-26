import { type ReactNode, useMemo, useState } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import {
  CheckboxField,
  DatePickerField,
  FieldLayoutContext,
  SelectField,
  TextField,
  WeekdayToggleField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { useRosterGroup } from '@/features/roster'
import { ApiError } from '@/lib/api-error'
import { formatTimeValue, parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { REPEAT_OPTIONS, SCHEDULING_PERMISSIONS, WEEKDAY_LABELS } from '../../constants'
import { useBreakTypeOptions, useCreateBatch, useTimeSlotOptions } from '../../hooks/use-scheduling'
import {
  createScheduleSchema,
  type CreateScheduleValues,
  createStepOneSchema,
} from '../../schemas/schedule-forms.schema'
import { type ScheduleBatchInput, WEEKDAYS } from '../../types/scheduling.types'
import { patternDates, toDate, weekdayNumber, weekdayOf } from '../../utils/schedule-dates'
import { hhmm } from '../../utils/shift-hours'
import { BreaksEditor } from '../fields/breaks-editor'
import { EmployeeSelector } from '../fields/employee-selector'
import { GeoFenceSelect } from '../fields/geo-fence-select'
import { RosterSelectField } from '../fields/roster-select-field'
import { TimeSlotSelectField } from '../fields/time-slot-select-field'
import { schedulingType } from '../type-styles'
import { validateStep } from './form-steps'
import { SchedulingDialog, SectionBar } from './scheduling-dialog'

const WEEKDAY_OPTIONS = WEEKDAYS.map((day) => ({
  value: day,
  short: WEEKDAY_LABELS[day],
  label: WEEKDAY_LABELS[day],
}))

/** Codes the API answers when shifts are already planned on those dates. */
const OVERLAP_CODES = new Set(['SCHEDULE_OVERLAP', 'SCHEDULE_DAY_TAKEN'])

function toInput(values: CreateScheduleValues): ScheduleBatchInput {
  const every = Number(values.repeat)
  return {
    startDate: values.startDate,
    endDate: values.endDate,
    timeSlotId: values.source === 'timeSlot' ? values.timeSlotId : null,
    rosterGroupId: values.source === 'roster' ? values.rosterGroupId : null,
    // Every day ticked is the API's "empty = every day".
    weekdays: values.weekdays.length === WEEKDAYS.length ? [] : values.weekdays.map(weekdayNumber),
    repeatEveryWeeks: every,
    step: every > 0 && values.step !== '' ? Number(values.step) : 1,
    geoFenceId: values.geoFenceId || null,
    isWfh: values.workFromHome,
    employeeIds: values.employeeIds,
    breaks: values.breaks.length > 0 ? values.breaks : null,
    replaceExisting: values.replaceExisting,
  }
}

interface CreateScheduleDialogProps {
  /** From an empty board cell: that person and day. */
  employeeIds?: string[] | undefined
  date?: string | undefined
  onClose: () => void
}

/** The "Shifts from" radio pair: one time slot, or a roster group's week. */
function SourceRadios({ form }: { form: ReturnType<typeof useForm<CreateScheduleValues>> }) {
  const { field } = useController({ control: form.control, name: 'source' })
  const options = [
    { value: 'timeSlot', label: 'Time Slot' },
    { value: 'roster', label: 'Time Roster' },
  ] as const
  return (
    <fieldset className="grid gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]">
      <legend className={cn('float-left @xl:py-2', schedulingType.label)}>Shifts from</legend>
      <div className="flex flex-wrap gap-x-8 gap-y-2 @xl:py-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn('flex items-center gap-2.5', schedulingType.label)}
          >
            <input
              type="radio"
              name={field.name}
              value={option.value}
              checked={field.value === option.value}
              onChange={() => {
                field.onChange(option.value)
              }}
              className="size-4 accent-[var(--primary)]"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Create Scheduling, two steps (`POST /scheduling/schedules/batches`). Step 1: Start / End
 * Date, shifts from a Time Slot or a Time Roster (with View), Apply Geo Fence, the days and
 * Repeat with Step, and Breaks that replace the slots' own. Step 2: a summary, Work From
 * Home, the dates it covers, "replace what is planned" and the employees (optional with a
 * roster: its enrolled members). Back / Save / Cancel.
 */
export function CreateScheduleDialog({
  employeeIds = [],
  date,
  onClose,
}: CreateScheduleDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const create = useCreateBatch()
  const slots = useTimeSlotOptions()
  const breakTypes = useBreakTypeOptions()
  const [initial] = useState((): CreateScheduleValues => {
    const start = date ?? toDateValue(new Date())
    return {
      startDate: start,
      endDate: date ? start : toDateValue(addDays(toDate(start), 6)),
      source: 'timeSlot',
      timeSlotId: '',
      rosterGroupId: '',
      geoFenceId: '',
      repeat: '0',
      weekdays: date ? [weekdayOf(date)] : [...WEEKDAYS],
      step: '1',
      breaks: [],
      workFromHome: false,
      replaceExisting: false,
      employeeIds,
    }
  })

  const form = useForm<CreateScheduleValues>({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: initial,
    mode: 'onTouched',
  })
  const { control, getValues } = form
  const values = useWatch({ control })
  const repeat = values.repeat ?? '0'
  const source = values.source ?? 'timeSlot'
  const slot = (slots.data ?? []).find((item) => item.id === values.timeSlotId)
  const roster = useRosterGroup(
    step === 2 && source === 'roster' && values.rosterGroupId ? values.rosterGroupId : undefined,
  )

  const dates = useMemo(() => {
    if (step !== 2) return []
    const current = getValues()
    return patternDates(
      current.startDate,
      current.endDate,
      current.weekdays,
      Number(current.repeat),
      current.step === '' ? 1 : Number(current.step),
    )
  }, [step, getValues])
  // With a roster, its days off get no shift (when the roster is readable).
  const workDates = roster.data
    ? dates.filter((day) => {
        const weekday = weekdayNumber(weekdayOf(day))
        const pattern = roster.data.days.find((item) => item.weekday === weekday)
        return pattern !== undefined && !pattern.isDayOff
      })
    : dates

  const goNext = () => {
    if (!validateStep(form, createStepOneSchema)) return
    const current = getValues()
    const covered = patternDates(
      current.startDate,
      current.endDate,
      current.weekdays,
      Number(current.repeat),
      current.step === '' ? 1 : Number(current.step),
    )
    if (covered.length === 0) {
      form.setError('weekdays', {
        message: 'These dates and repeat settings leave no days to schedule',
      })
      return
    }
    setStep(2)
  }

  const submit = form.handleSubmit(async (formValues) => {
    form.clearErrors('root')
    try {
      await create.mutateAsync(toInput(formValues))
    } catch (error) {
      if (error instanceof ApiError) {
        const overlap = error.code !== undefined && OVERLAP_CODES.has(error.code)
        form.setError('root', {
          message: overlap
            ? `${error.message} Tick "Replace shifts already planned" to overwrite them.`
            : error.message,
        })
        const stepOne = ['timeSlotId', 'rosterGroupId', 'startDate', 'endDate', 'weekdays', 'step']
        if (stepOne.some((field) => error.fieldErrors[field])) setStep(1)
      }
      return
    }
    onClose()
  })

  const rootError = form.formState.errors.root?.message
  const startDate = parseDateValue(values.startDate ?? '')
  const typeName = (id: string | undefined) =>
    (breakTypes.data ?? []).find((type) => type.id === id)?.name ?? 'Break'

  return (
    <SchedulingDialog
      label={step === 1 ? 'Create Scheduling' : 'Create Scheduling, review'}
      steps={{ current: step, total: 2 }}
      onRequestClose={onClose}
      className="max-w-5xl"
      footer={
        step === 1 ? (
          <>
            <Button size="lg" onClick={goNext} className={dialogButtonClass}>
              Next
            </Button>
            <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => {
                setStep(1)
              }}
              className={cn(dialogButtonClass, 'bg-orange-500 text-white hover:bg-orange-500/90')}
            >
              Back
            </Button>
            <Button
              type="submit"
              form="create-schedule-form"
              variant="success"
              size="lg"
              disabled={create.isPending}
              className={dialogButtonClass}
            >
              {create.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
            <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
              Cancel
            </Button>
          </>
        )
      }
    >
      <form id="create-schedule-form" noValidate onSubmit={submit} aria-label="Create Scheduling">
        <FieldLayoutContext value="horizontal">
          {step === 1 ? (
            <div className="grid gap-5">
              <DatePickerField control={control} name="startDate" label="Start Date" required />
              <DatePickerField
                control={control}
                name="endDate"
                label="End Date"
                required
                minDate={startDate}
              />
              <SourceRadios form={form} />
              {source === 'timeSlot' ? (
                <TimeSlotSelectField control={control} name="timeSlotId" required />
              ) : (
                <RosterSelectField control={control} name="rosterGroupId" required />
              )}
              <GeoFenceSelect control={control} name="geoFenceId" />
              <WeekdayToggleField
                control={control}
                name="weekdays"
                options={WEEKDAY_OPTIONS}
                label="Days"
              />
              <SelectField
                control={control}
                name="repeat"
                label="Repeat"
                placeholder="Select Repeat"
                options={REPEAT_OPTIONS}
              />
              {repeat !== '0' && (
                <TextField
                  control={control}
                  name="step"
                  label="Step"
                  inputMode="numeric"
                  placeholder="How many steps"
                  description={`Weeks in a row that are scheduled in each ${repeat === '1' ? 'week' : `${repeat}-week`} cycle, counted from the week of the start date.`}
                />
              )}
              <BreaksEditor control={control} />
            </div>
          ) : (
            <div className="grid gap-5">
              <SectionBar>Shift Scheduling</SectionBar>
              <SummaryRow label="Dates">
                {values.startDate ? format(toDate(values.startDate), 'd MMMM, yyyy') : ''} –{' '}
                {values.endDate ? format(toDate(values.endDate), 'd MMMM, yyyy') : ''}
              </SummaryRow>
              {source === 'timeSlot' ? (
                <SummaryRow label="Time Slot">
                  {slot ? (
                    <>
                      {slot.name}
                      {slot.startTime && slot.endTime && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {formatTimeValue(hhmm(slot.startTime) ?? '')} –{' '}
                          {formatTimeValue(hhmm(slot.endTime) ?? '')}
                          {slot.isOvernight ? ' (ends next day)' : ''}
                          {slot.isFlexible ? ' · flexible' : ''}
                        </span>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </SummaryRow>
              ) : (
                <SummaryRow label="Time Roster">
                  {roster.data?.title ?? 'Each weekday follows the roster'}
                </SummaryRow>
              )}
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <CheckboxField control={control} name="workFromHome" label="Work From Home" />
              </div>

              <SectionBar>Breaks</SectionBar>
              {(values.breaks ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Each shift keeps its time slot&apos;s breaks.
                </p>
              ) : (
                <ul className="grid gap-1 text-sm text-field-value">
                  {(values.breaks ?? []).map((row, index) => (
                    <li key={index} className="rounded-md bg-muted px-3 py-2 tabular-nums">
                      {typeName(row.breakTypeId)}: {row.startTime} – {row.endTime}
                      {row.isInclusive ? ' (inclusive)' : ''}
                    </li>
                  ))}
                </ul>
              )}

              <SectionBar>Shifts</SectionBar>
              {workDates.length === 0 ? (
                <p className="text-sm text-destructive">
                  No working days in these dates. Go back and change the dates or days.
                </p>
              ) : (
                <div className="grid gap-2">
                  <p className="text-sm text-muted-foreground">
                    {workDates.length} day{workDates.length === 1 ? '' : 's'} for each employee.
                    Rest days are skipped.
                  </p>
                  <ol className="grid scrollbar-thin max-h-40 list-inside list-decimal grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto text-sm text-heading @md:grid-cols-2 @3xl:grid-cols-4">
                    {workDates.map((day) => (
                      <li key={day}>{format(toDate(day), 'MMMM d, yyyy')}</li>
                    ))}
                  </ol>
                </div>
              )}
              <CheckboxField
                control={control}
                name="replaceExisting"
                label="Replace shifts already planned"
                description="Without it, dates that already have a shift are refused."
              />

              <SectionBar>Employees Name</SectionBar>
              {source === 'roster' && (
                <p className="text-sm text-muted-foreground">
                  Leave empty to schedule everyone enrolled in the roster on each date.
                </p>
              )}
              <EmployeesField form={form} />
              {rootError && (
                <p role="alert" className="text-sm text-destructive">
                  {rootError}
                </p>
              )}
            </div>
          )}
        </FieldLayoutContext>
      </form>
    </SchedulingDialog>
  )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]">
      <span className={cn('@xl:py-2', schedulingType.label)}>{label}</span>
      <span
        className={cn('flex min-h-10 items-center rounded-md bg-muted px-3', schedulingType.value)}
      >
        <span>{children}</span>
      </span>
    </div>
  )
}

function EmployeesField({ form }: { form: ReturnType<typeof useForm<CreateScheduleValues>> }) {
  const { field, fieldState } = useController({ control: form.control, name: 'employeeIds' })
  return (
    <EmployeeSelector
      variant="compact"
      permission={SCHEDULING_PERMISSIONS.create}
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  )
}
