import { useFormContext, useWatch } from 'react-hook-form'

import { SwitchField, TimePickerField } from '@/components/form'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { ROSTER_DAY_LABELS } from '../constants'
import type { RosterGroupFormValues } from '../schemas/roster-group-form.schema'
import { ShiftMinutes } from './shift-minutes'

const headClass = 'px-3 py-3 text-left text-sm font-medium whitespace-nowrap text-heading'
const cellClass = 'border-t px-3 py-2 align-top'

/** One day's controls, shared by the table row and the phone card. */
function useDay(index: number) {
  const { control, setValue } = useFormContext<RosterGroupFormValues>()
  const [day, applyToAll] = useWatch({ control, name: [`days.${index}`, 'applyToAll'] })
  const label = ROSTER_DAY_LABELS[day.day]
  const timesDisabled = day.isWeekend || applyToAll

  const onWeekendChange = (isWeekend: boolean) => {
    // A day off keeps no times; "Apply For All" refills them if it is switched back.
    if (isWeekend) {
      setValue(`days.${index}.clockIn`, '', { shouldDirty: true, shouldValidate: true })
      setValue(`days.${index}.clockOut`, '', { shouldDirty: true, shouldValidate: true })
    }
  }

  return { control, day, label, timesDisabled, onWeekendChange }
}

function DayRow({ index }: { index: number }) {
  const { control, day, label, timesDisabled, onWeekendChange } = useDay(index)
  return (
    <tr>
      <td className={cn(cellClass, 'pt-4.5 text-muted-foreground tabular-nums')}>{index + 1}</td>
      <th
        scope="row"
        className={cn(cellClass, 'pt-4.5 text-left font-normal text-nav-active-foreground')}
      >
        {label}
      </th>
      <td className={cn(cellClass, 'pt-4')}>
        <SwitchField
          control={control}
          name={`days.${index}.isWeekend`}
          label={`${label} is a weekend`}
          hideLabel
          onCheckedChange={onWeekendChange}
          className="gap-0"
        />
      </td>
      <td className={cellClass}>
        <TimePickerField
          control={control}
          name={`days.${index}.clockIn`}
          label={`${label} clock in`}
          hideLabel
          disabled={timesDisabled}
          className="gap-0"
        />
      </td>
      <td className={cellClass}>
        <TimePickerField
          control={control}
          name={`days.${index}.clockOut`}
          label={`${label} clock out`}
          hideLabel
          disabled={timesDisabled}
          className="gap-0"
        />
      </td>
      <td className={cellClass}>
        <ShiftMinutes
          label={`${label} defined minutes`}
          clockIn={day.clockIn}
          clockOut={day.clockOut}
          isWeekend={day.isWeekend}
        />
      </td>
    </tr>
  )
}

function DayCard({ index }: { index: number }) {
  const { control, day, label, timesDisabled, onWeekendChange } = useDay(index)
  return (
    <li className="grid gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base text-nav-active-foreground">
          <span className="text-sm text-muted-foreground tabular-nums">{index + 1}</span>
          {label}
        </h3>
        <SwitchField
          control={control}
          name={`days.${index}.isWeekend`}
          label={`${label} is a weekend`}
          hideLabel
          stateLabel={() => 'Weekend'}
          onCheckedChange={onWeekendChange}
          className="gap-0"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TimePickerField
          control={control}
          name={`days.${index}.clockIn`}
          label="Clock In"
          disabled={timesDisabled}
        />
        <TimePickerField
          control={control}
          name={`days.${index}.clockOut`}
          label="Clock Out"
          disabled={timesDisabled}
        />
      </div>
      <ShiftMinutes
        label={`${label} defined minutes`}
        clockIn={day.clockIn}
        clockOut={day.clockOut}
        isWeekend={day.isWeekend}
      />
    </li>
  )
}

/**
 * The week of the roster form: # · Day Name · Weekend · Clock In · Clock Out ·
 * Defined Minutes, as drawn. Phones get one card per day instead of a table.
 */
export function RosterScheduleFields() {
  const isWide = useMediaQuery(BREAKPOINTS.md)
  const { control, formState } = useFormContext<RosterGroupFormValues>()
  const days = useWatch({ control, name: 'days' })
  const weekError = formState.errors.days?.root?.message ?? formState.errors.days?.message

  return (
    <section aria-label="Weekly schedule" className="grid gap-3">
      {isWide ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Weekly schedule</caption>
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className={cn(headClass, 'w-10')}>
                  #
                </th>
                <th scope="col" className={headClass}>
                  Day Name
                </th>
                <th scope="col" className={cn(headClass, 'w-24')}>
                  Weekend
                </th>
                <th scope="col" className={headClass}>
                  Clock In
                </th>
                <th scope="col" className={headClass}>
                  Clock Out
                </th>
                <th scope="col" className={cn(headClass, 'w-48')}>
                  Defined Minutes
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => (
                <DayRow key={day.day} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid gap-3">
          {days.map((day, index) => (
            <DayCard key={day.day} index={index} />
          ))}
        </ul>
      )}
      {weekError && (
        <p role="alert" className="text-sm text-destructive">
          {weekError}
        </p>
      )}
    </section>
  )
}
