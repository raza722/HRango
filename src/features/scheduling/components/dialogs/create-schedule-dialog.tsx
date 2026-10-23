import { useEffect, useMemo, useState } from 'react'
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
  TimePickerField,
  WeekdayToggleField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import type { RosterGroup } from '@/features/roster'
import { ApiError } from '@/lib/api-error'
import { formatTimeValue, parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { BREAK_TYPE_LABELS, REPEAT_OPTIONS, WEEKDAY_LABELS } from '../../constants'
import { useRosterTones } from '../../hooks/use-roster-tones'
import { useCreateSchedule } from '../../hooks/use-scheduling'
import {
  createScheduleSchema,
  type CreateScheduleValues,
  createStepOneSchema,
} from '../../schemas/schedule-forms.schema'
import { type CreateScheduleInput, type RepeatRule, WEEKDAYS } from '../../types/scheduling.types'
import { scheduleDates, toDate, weekdayOf } from '../../utils/schedule-dates'
import { BreaksEditor } from '../fields/breaks-editor'
import { EmployeeSelector } from '../fields/employee-selector'
import { GeoFenceSelect } from '../fields/geo-fence-select'
import { RosterSelectField } from '../fields/roster-select-field'
import { schedulingType } from '../type-styles'
import { validateStep } from './form-steps'
import { SchedulingDialog, SectionBar } from './scheduling-dialog'

const WEEKDAY_OPTIONS = WEEKDAYS.map((day) => ({
  value: day,
  short: WEEKDAY_LABELS[day],
  label: WEEKDAY_LABELS[day],
}))

const ROSTER_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const

function firstShift(group: RosterGroup | undefined) {
  const day = group?.days.find((entry) => !entry.isWeekend && entry.clockIn && entry.clockOut)
  return day?.clockIn && day.clockOut ? { clockIn: day.clockIn, clockOut: day.clockOut } : null
}

const toMinutes = (hours: string) => Math.round(Number(hours) * 60)
const hhmmToMinutes = (value: string) => {
  const [h = '0', m = '0'] = value.split(':')
  return Number(h) * 60 + Number(m)
}

function repeatRule(values: CreateScheduleValues): RepeatRule | null {
  const everyWeeks = Number(values.repeat)
  if (everyWeeks === 0) return null
  return {
    everyWeeks,
    from: values.repeatFrom,
    to: values.repeatTo,
    weekdays: values.weekdays,
    step: values.step === '' ? 1 : Number(values.step),
  }
}

function toInput(values: CreateScheduleValues, timesChanged: boolean): CreateScheduleInput {
  return {
    startDate: values.startDate,
    endDate: values.endDate,
    rosterGroupId: values.rosterGroupId,
    geoFenceIds: values.geoFenceIds,
    repeat: repeatRule(values),
    restDays: values.restDays,
    workFromHome: values.workFromHome,
    breaks: values.breaks.map((row) => ({ ...row, description: row.description.trim() })),
    slot: {
      name: values.slotName.trim(),
      isOvernight: values.isOvernight,
      reverseDecision: values.reverseDecision,
      mode: values.durationRules ? values.mode : 'fixed',
      workableMinutes:
        values.durationRules && values.mode === 'flexible' ? toMinutes(values.workableHours) : null,
      totalMinutes:
        values.durationRules && values.mode === 'total' ? toMinutes(values.totalHours) : null,
      shortOvertime: values.shortOvertime,
      fullOvertime: values.fullOvertime,
      overtimeMinutes:
        (values.shortOvertime || values.fullOvertime) && values.overtime
          ? hhmmToMinutes(values.overtime)
          : null,
    },
    // Untouched times keep each weekday's own roster times.
    clockIn: timesChanged ? values.startTime : null,
    clockOut: timesChanged ? values.endTime : null,
    employeeIds: values.employeeIds,
  }
}

interface CreateScheduleDialogProps {
  /** From an empty board cell: that person and day. */
  employeeIds?: string[] | undefined
  date?: string | undefined
  onClose: () => void
}

/** The "Is Flexible / Total Duration" radio pair with its hours box. */
function DurationRadios({
  form,
  disabled,
}: {
  form: ReturnType<typeof useForm<CreateScheduleValues>>
  disabled: boolean
}) {
  const { field } = useController({ control: form.control, name: 'mode' })
  const options = [
    {
      value: 'flexible',
      label: 'Is Flexible',
      hours: 'workableHours',
      caption: 'Workable Hours',
      unit: 'hrs per day',
    },
    {
      value: 'total',
      label: 'Total Duration',
      hours: 'totalHours',
      caption: 'Total Duration',
      unit: 'hrs per week',
    },
  ] as const
  return (
    <fieldset disabled={disabled} className={cn('grid gap-4', disabled && 'opacity-60')}>
      <legend className="sr-only">How the hours are counted</legend>
      {options.map((option) => (
        <div
          key={option.value}
          className="grid items-center gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]"
        >
          <label className={cn('flex items-center gap-2.5', schedulingType.label)}>
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
          <TextField
            control={form.control}
            name={option.hours}
            label={option.caption}
            placeholder={option.value === 'flexible' ? '8' : '48'}
            inputMode="decimal"
            disabled={disabled || field.value !== option.value}
            description={option.unit}
            className="[&>label]:sr-only"
          />
        </div>
      ))}
    </fieldset>
  )
}

/**
 * Create Scheduling, two steps as drawn. Step 1: Start / End Date, Time
 * Roster (with View), Apply Geo Fence, Repeat (From, To, weekdays, Step),
 * Rest Days and Breaks. Step 2: Shift Scheduling, Time Slot, Breaks, the
 * Shifts it will create and the employees. Back / Save / Cancel.
 */
export function CreateScheduleDialog({
  employeeIds = [],
  date,
  onClose,
}: CreateScheduleDialogProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const tones = useRosterTones()
  const create = useCreateSchedule()
  const [initial] = useState(() => {
    const start = date ?? toDateValue(new Date())
    const end = toDateValue(addDays(toDate(start), 6))
    const values: CreateScheduleValues = {
      startDate: start,
      endDate: end,
      rosterGroupId: '',
      geoFenceIds: [],
      repeat: '0',
      repeatFrom: start,
      repeatTo: end,
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      step: '1',
      restDays: false,
      breaks: [],
      workFromHome: false,
      slotName: '',
      startTime: '09:00',
      endTime: '17:00',
      isOvernight: false,
      reverseDecision: false,
      durationRules: false,
      mode: 'flexible',
      workableHours: '8',
      totalHours: '48',
      shortOvertime: false,
      fullOvertime: false,
      overtime: '',
      employeeIds,
    }
    return values
  })

  const form = useForm<CreateScheduleValues>({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: initial,
    mode: 'onTouched',
  })
  const { control, setValue, getValues, getFieldState } = form
  const values = useWatch({ control })
  const repeat = values.repeat ?? '0'
  const roster = tones.groups.find((group) => group.id === values.rosterGroupId)

  // A clock out before the clock in is an overnight slot.
  const { startTime = '', endTime = '', isOvernight = false } = values
  useEffect(() => {
    if (startTime && endTime && endTime < startTime && !isOvernight) setValue('isOvernight', true)
  }, [startTime, endTime, isOvernight, setValue])

  const preview = useMemo(() => {
    const current = getValues()
    if (!roster || step !== 2) return []
    return scheduleDates(current.startDate, current.endDate, repeatRule(current)).map((day) => {
      const pattern = roster.days[ROSTER_INDEX[weekdayOf(day)]]
      return { day, rest: !pattern || pattern.isWeekend }
    })
  }, [roster, step, getValues])
  const shifts = preview.filter((item) => !item.rest || values.restDays)

  const goNext = () => {
    if (!validateStep(form, createStepOneSchema)) return
    const current = getValues()
    // Step 2 starts from the roster: its name and its first shift's times.
    const group = tones.groups.find((item) => item.id === current.rosterGroupId)
    if (group && !getFieldState('slotName').isDirty) setValue('slotName', group.title)
    const times = firstShift(group)
    if (times && !getFieldState('startTime').isDirty && !getFieldState('endTime').isDirty) {
      setValue('startTime', times.clockIn)
      setValue('endTime', times.clockOut)
      setValue('isOvernight', times.clockOut < times.clockIn)
    }
    if (scheduleDates(current.startDate, current.endDate, repeatRule(current)).length === 0) {
      form.setError('repeat', {
        message: 'These dates and repeat settings leave no days to schedule',
      })
      return
    }
    setStep(2)
  }

  const submit = form.handleSubmit(async (formValues) => {
    const timesChanged = getFieldState('startTime').isDirty || getFieldState('endTime').isDirty
    try {
      await create.mutateAsync(toInput(formValues, timesChanged))
    } catch (error) {
      if (error instanceof ApiError) {
        form.setError('root', { message: error.message })
        if (error.fieldErrors.rosterGroupId || error.fieldErrors.endDate) setStep(1)
      }
      return
    }
    onClose()
  })

  const rootError = form.formState.errors.root?.message
  const startDate = parseDateValue(values.startDate ?? '')

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
              <RosterSelectField control={control} name="rosterGroupId" required />
              <GeoFenceSelect control={control} name="geoFenceIds" />
              <SelectField
                control={control}
                name="repeat"
                label="Repeat"
                placeholder="Select Repeat"
                options={REPEAT_OPTIONS}
                onValueChange={(value) => {
                  if (value !== '0' && !getValues('repeatFrom'))
                    setValue('repeatFrom', getValues('startDate'))
                }}
              />
              {repeat !== '0' && (
                <FieldLayoutContext value="vertical">
                  <div className="grid gap-4 rounded-md border border-dashed p-4 @xl:ml-[calc(10rem+1.5rem)]">
                    <div className="grid gap-4 @md:grid-cols-2">
                      <DatePickerField control={control} name="repeatFrom" label="From" required />
                      <DatePickerField
                        control={control}
                        name="repeatTo"
                        label="To"
                        required
                        minDate={parseDateValue(values.repeatFrom ?? '')}
                      />
                    </div>
                    <WeekdayToggleField
                      control={control}
                      name="weekdays"
                      options={WEEKDAY_OPTIONS}
                      label="Repeat on"
                    />
                    <TextField
                      control={control}
                      name="step"
                      label="Step"
                      inputMode="numeric"
                      placeholder="How many steps"
                      description={`Weeks in a row that are scheduled in each ${repeat === '1' ? 'week' : `${repeat}-week`} cycle.`}
                    />
                  </div>
                </FieldLayoutContext>
              )}
              <CheckboxField
                control={control}
                name="restDays"
                label="Rest Days"
                description="Fill the roster's weekend days as rest days."
              />
              <BreaksEditor
                control={control}
                defaultDates={{ startDate: values.startDate ?? '', endDate: values.endDate ?? '' }}
              />
            </div>
          ) : (
            <div className="grid gap-5">
              <SectionBar>Shift Scheduling</SectionBar>
              <div className="grid gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]">
                <span className={cn('@xl:py-2', schedulingType.label)}>Start Date</span>
                <span
                  className={cn(
                    'flex min-h-10 items-center rounded-md bg-muted px-3',
                    schedulingType.value,
                  )}
                >
                  {values.startDate ? format(toDate(values.startDate), 'd MMMM, yyyy') : ''} –{' '}
                  {values.endDate ? format(toDate(values.endDate), 'd MMMM, yyyy') : ''}
                </span>
              </div>
              <GeoFenceSelect control={control} name="geoFenceIds" />
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <CheckboxField control={control} name="workFromHome" label="Work From Home" />
                <CheckboxField control={control} name="restDays" label="Rest Days" />
              </div>

              <SectionBar>Time Slot</SectionBar>
              <TextField control={control} name="slotName" label="Name" required maxLength={60} />
              <div className="grid gap-5 @3xl:grid-cols-2 @3xl:gap-x-10">
                <TimePickerField control={control} name="startTime" label="Start Time" required />
                <TimePickerField control={control} name="endTime" label="End Time" required />
              </div>
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <CheckboxField control={control} name="isOvernight" label="Is Overnight Slot" />
                <CheckboxField control={control} name="reverseDecision" label="Reverse Decision" />
                <CheckboxField control={control} name="durationRules" label="Total Duration" />
              </div>
              <DurationRadios form={form} disabled={!values.durationRules} />
              <div className="flex flex-wrap gap-x-10 gap-y-3">
                <CheckboxField control={control} name="shortOvertime" label="Short Overtime" />
                <CheckboxField control={control} name="fullOvertime" label="Full Overtime" />
              </div>
              {(values.shortOvertime === true || values.fullOvertime === true) && (
                <TimePickerField
                  control={control}
                  name="overtime"
                  label="Overtime Allowed"
                  description="Hours and minutes, e.g. 08:30 for 8 hrs, 30 min."
                />
              )}

              <SectionBar>Breaks</SectionBar>
              {(values.breaks ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No breaks. Add them in the first step.
                </p>
              ) : (
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="text-left text-heading [&>th]:px-2 [&>th]:pb-2 [&>th]:font-normal">
                        <th scope="col">Break Type</th>
                        <th scope="col">Mark Break Out</th>
                        <th scope="col">Mark Break In</th>
                        <th scope="col">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(values.breaks ?? []).map((row, index) => (
                        <tr key={index} className="text-field-value [&>td]:px-2 [&>td]:py-1">
                          <td>
                            <span className="block rounded-md bg-muted px-3 py-2">
                              {BREAK_TYPE_LABELS[row.type ?? 'lunch']}
                            </span>
                          </td>
                          <td>
                            <span className="block rounded-md bg-muted px-3 py-2 tabular-nums">
                              {row.startDate} {row.startTime ? formatTimeValue(row.startTime) : ''}
                            </span>
                          </td>
                          <td>
                            <span className="block rounded-md bg-muted px-3 py-2 tabular-nums">
                              {row.endDate} {row.endTime ? formatTimeValue(row.endTime) : ''}
                            </span>
                          </td>
                          <td>
                            <span className="block rounded-md bg-muted px-3 py-2">
                              {row.description === undefined || row.description === ''
                                ? '—'
                                : row.description}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <SectionBar>Shifts</SectionBar>
              {shifts.length === 0 ? (
                <p className="text-sm text-destructive">
                  The roster has no working days in these dates. Go back and change the dates or
                  tick Rest Days.
                </p>
              ) : (
                <div className="grid gap-2">
                  <p className="text-sm text-muted-foreground">
                    {shifts.length} day{shifts.length === 1 ? '' : 's'} for each employee.
                  </p>
                  <ol className="grid scrollbar-thin max-h-40 list-inside list-decimal grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto text-sm text-heading @md:grid-cols-2 @3xl:grid-cols-4">
                    {shifts.map((item) => (
                      <li key={item.day}>
                        {format(toDate(item.day), 'MMMM d, yyyy')}
                        {item.rest && <span className="text-muted-foreground"> (rest day)</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <SectionBar>Employees Name</SectionBar>
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

function EmployeesField({ form }: { form: ReturnType<typeof useForm<CreateScheduleValues>> }) {
  const { field, fieldState } = useController({ control: form.control, name: 'employeeIds' })
  return (
    <EmployeeSelector
      variant="compact"
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  )
}
