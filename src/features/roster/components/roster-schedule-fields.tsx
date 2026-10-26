import { useFormContext, useWatch } from 'react-hook-form'

import { SelectField, SwitchField } from '@/components/form'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { ROSTER_DAY_LABELS } from '../constants'
import type { RosterGroupFormValues } from '../schemas/roster-group-form.schema'
import type { TimeSlotOption } from '../types/roster.types'
import { timeSlotSelectOptions } from '../utils/time-slot-options'
import { ShiftMinutes, SlotTimes } from './shift-minutes'

const headClass = 'px-3 py-3 text-left text-sm font-medium whitespace-nowrap text-heading'
const cellClass = 'border-t px-3 py-2 align-top'

interface WeekProps {
  slots: readonly TimeSlotOption[]
}

/** One day's controls, shared by the table row and the phone card. */
function useDay(index: number, slots: readonly TimeSlotOption[]) {
  const { control, setValue } = useFormContext<RosterGroupFormValues>()
  const [day, applyToAll] = useWatch({ control, name: [`days.${index}`, 'applyToAll'] })
  const label = ROSTER_DAY_LABELS[day.day]
  const slot = day.isDayOff ? undefined : slots.find((item) => item.id === day.timeSlotId)

  const onDayOffChange = (isDayOff: boolean) => {
    // A day off keeps no slot; "Apply For All" refills it if it is switched back.
    if (isDayOff) {
      setValue(`days.${index}.timeSlotId`, '', { shouldDirty: true, shouldValidate: true })
    }
  }

  return {
    control,
    day,
    label,
    slot,
    slotDisabled: day.isDayOff || applyToAll,
    onDayOffChange,
  }
}

function DayRow({ index, slots }: { index: number } & WeekProps) {
  const { control, day, label, slot, slotDisabled, onDayOffChange } = useDay(index, slots)
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
          name={`days.${index}.isDayOff`}
          label={`${label} is a day off`}
          hideLabel
          onCheckedChange={onDayOffChange}
          className="gap-0"
        />
      </td>
      <td className={cn(cellClass, 'min-w-56')}>
        <SelectField
          control={control}
          name={`days.${index}.timeSlotId`}
          label={`${label} time slot`}
          placeholder={day.isDayOff ? 'Day off' : 'Select Time Slot'}
          options={timeSlotSelectOptions(slots)}
          disabled={slotDisabled}
          className="gap-0 [&>label]:sr-only"
        />
      </td>
      <td className={cn(cellClass, 'pt-4.5 whitespace-nowrap')}>
        <SlotTimes slot={slot} isDayOff={day.isDayOff} />
      </td>
      <td className={cellClass}>
        <ShiftMinutes
          label={`${label} defined minutes`}
          clockIn={slot?.startTime ?? null}
          clockOut={slot?.endTime ?? null}
          isWeekend={day.isDayOff}
        />
      </td>
    </tr>
  )
}

function DayCard({ index, slots }: { index: number } & WeekProps) {
  const { control, day, label, slot, slotDisabled, onDayOffChange } = useDay(index, slots)
  return (
    <li className="grid gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base text-nav-active-foreground">
          <span className="text-sm text-muted-foreground tabular-nums">{index + 1}</span>
          {label}
        </h3>
        <SwitchField
          control={control}
          name={`days.${index}.isDayOff`}
          label={`${label} is a day off`}
          hideLabel
          stateLabel={() => 'Day off'}
          onCheckedChange={onDayOffChange}
          className="gap-0"
        />
      </div>
      <SelectField
        control={control}
        name={`days.${index}.timeSlotId`}
        label="Time Slot"
        placeholder={day.isDayOff ? 'Day off' : 'Select Time Slot'}
        options={timeSlotSelectOptions(slots)}
        disabled={slotDisabled}
      />
      <ShiftMinutes
        label={`${label} defined minutes`}
        clockIn={slot?.startTime ?? null}
        clockOut={slot?.endTime ?? null}
        isWeekend={day.isDayOff}
      />
    </li>
  )
}

/**
 * The week of the roster form: # · Day Name · Day Off · Time Slot · Times · Defined
 * Minutes. Each working day follows a time slot (the API stores no free clock times).
 * Phones get one card per day instead of a table.
 */
export function RosterScheduleFields({ slots }: WeekProps) {
  const isWide = useMediaQuery(BREAKPOINTS.md)
  const { control, formState } = useFormContext<RosterGroupFormValues>()
  const days = useWatch({ control, name: 'days' })
  const weekError = formState.errors.days?.root?.message ?? formState.errors.days?.message

  return (
    <section aria-label="Weekly schedule" className="grid gap-3">
      {isWide ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[44rem] text-sm">
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
                  Day Off
                </th>
                <th scope="col" className={headClass}>
                  Time Slot
                </th>
                <th scope="col" className={headClass}>
                  Times
                </th>
                <th scope="col" className={cn(headClass, 'w-48')}>
                  Defined Minutes
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => (
                <DayRow key={day.day} index={index} slots={slots} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid gap-3">
          {days.map((day, index) => (
            <DayCard key={day.day} index={index} slots={slots} />
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
