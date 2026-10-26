import { useState } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { DatePickerField, SelectField, SwitchField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { REPEAT_OPTIONS, SCHEDULING_PERMISSIONS, WEEKDAY_LABELS } from '../../constants'
import { useCreateRestDays } from '../../hooks/use-scheduling'
import { restDaySchema, type RestDayValues } from '../../schemas/schedule-forms.schema'
import { WEEKDAYS } from '../../types/scheduling.types'
import { toDate, weekdayNumber, weekdayOf } from '../../utils/schedule-dates'
import { EmployeeSelector } from '../fields/employee-selector'
import { schedulingType } from '../type-styles'
import { SchedulingDialog } from './scheduling-dialog'

interface RestDayDialogProps {
  employeeIds?: string[] | undefined
  date?: string | undefined
  onClose: () => void
}

/** Square MON … SUN chips of the rest-day form (dark when chosen): Poppins Regular 13 #707070. */
function DayChips({ control }: { control: ReturnType<typeof useForm<RestDayValues>>['control'] }) {
  const { field, fieldState } = useController({ control, name: 'weekdays' })
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm text-title">Select Day</legend>
      <div className="grid grid-cols-4 gap-2">
        {WEEKDAYS.map((day) => {
          const on = field.value.includes(day)
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              onClick={() => {
                field.onChange(
                  on ? field.value.filter((item) => item !== day) : [...field.value, day],
                )
              }}
              className={cn(
                'h-9 rounded-sm text-[0.8125rem] tracking-wide uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                on ? 'bg-sidebar text-sidebar-foreground' : 'bg-muted text-grey hover:bg-chip',
              )}
            >
              {WEEKDAY_LABELS[day]}
            </button>
          )
        })}
      </div>
      {fieldState.error && (
        <p role="alert" className="text-xs text-destructive">
          {fieldState.error.message}
        </p>
      )}
    </fieldset>
  )
}

/**
 * Create New Rest Day (`POST /scheduling/settings/rest-days`): the rule on the left (From,
 * To, Repeat, Step, days, payable) and the people on the right (filters, All Employees,
 * Selected Employees). Cancel / Create. Dates that are already rest days are left alone;
 * shifts on the new rest days stay (the board shows the shift first).
 */
export function RestDayDialog({ employeeIds = [], date, onClose }: RestDayDialogProps) {
  const create = useCreateRestDays()
  const [initial] = useState<RestDayValues>(() => {
    const start = date ?? toDateValue(new Date())
    return {
      fromDate: start,
      toDate: date ? start : toDateValue(addDays(toDate(start), 27)),
      repeat: '1',
      weekdays: [date ? weekdayOf(date) : 'sun'],
      step: '1',
      payable: false,
      employeeIds,
    }
  })
  const form = useForm<RestDayValues>({
    resolver: zodResolver(restDaySchema),
    defaultValues: initial,
    mode: 'onTouched',
  })
  const { control } = form
  const fromDate = useWatch({ control, name: 'fromDate' })
  const { field, fieldState } = useController({ control, name: 'employeeIds' })

  const submit = form.handleSubmit(async (values) => {
    const every = Number(values.repeat)
    try {
      await create.mutateAsync({
        fromDate: values.fromDate,
        toDate: values.toDate,
        weekdays: values.weekdays.map(weekdayNumber),
        repeatEveryWeeks: every,
        step: every > 0 && values.step !== '' ? Number(values.step) : 1,
        isPayable: values.payable,
        employeeIds: values.employeeIds,
      })
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.toDate) {
        form.setError('toDate', { message: error.fieldErrors.toDate })
      }
      return
    }
    onClose()
  })

  return (
    <SchedulingDialog
      title="Create New Rest Day"
      onRequestClose={onClose}
      className="max-w-6xl"
      // Drawn in Poppins: title Poppins SemiBold 20 #202020, buttons Poppins Medium 15.
      appearance="poppins"
      titleClassName="font-sans text-xl font-semibold text-[#202020] sm:text-xl dark:text-heading"
      footer={
        <>
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className="min-w-28 text-[0.9375rem] font-medium"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="rest-day-form"
            size="lg"
            disabled={create.isPending}
            className="min-w-28 bg-sidebar text-[0.9375rem] font-medium text-sidebar-foreground hover:bg-sidebar/90"
          >
            {create.isPending && <Loader2 className="animate-spin" />}
            Create
          </Button>
        </>
      }
    >
      <form
        id="rest-day-form"
        noValidate
        onSubmit={submit}
        aria-label="Create New Rest Day"
        className={cn(
          'grid gap-6 @3xl:grid-cols-[17rem_minmax(0,1fr)] @3xl:gap-8',
          schedulingType.restDayForm,
        )}
      >
        <div className="grid content-start gap-4 @3xl:border-r @3xl:pr-8">
          <div className="grid grid-cols-2 gap-3">
            <DatePickerField control={control} name="fromDate" label="From" required />
            <DatePickerField
              control={control}
              name="toDate"
              label="To"
              required
              minDate={parseDateValue(fromDate)}
            />
          </div>
          <SelectField
            control={control}
            name="repeat"
            label="Repeat"
            required
            options={REPEAT_OPTIONS}
          />
          <TextField
            control={control}
            name="step"
            label="Step"
            placeholder="How many steps"
            inputMode="numeric"
          />
          <DayChips control={control} />
          <SwitchField
            control={control}
            name="payable"
            label="Is Rest Day Payable?"
            stateLabel={(on) => (on ? 'Yes' : 'No')}
          />
        </div>
        <div className="grid content-start gap-3">
          <h3 className="text-lg font-medium text-[#202020] dark:text-heading">Search Filter</h3>
          <EmployeeSelector
            appearance="poppins"
            permission={SCHEDULING_PERMISSIONS.restDaysCreate}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        </div>
      </form>
    </SchedulingDialog>
  )
}
