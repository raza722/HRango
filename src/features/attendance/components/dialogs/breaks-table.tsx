import { type Control, useFieldArray, useWatch } from 'react-hook-form'
import { Plus, X } from 'lucide-react'

import {
  DatePickerField,
  FieldLayoutContext,
  SelectField,
  TimePickerField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'

import { useBreakTypes } from '../../hooks/use-attendance-settings'
import type { DayEditValues } from '../../schemas/time-sheet.schema'
import { shiftLocal, splitLocal, toLocal } from '../../utils/local-time'

const hidden = 'gap-0 [&>label]:sr-only'

/**
 * Breaks of Time Sheet Edit: Break Type, Break Out date and time, Break In
 * date and time and a red remove button per row, or "No Record Found". Rows
 * become cards on phones. (The API keeps no description per break.)
 */
export function BreaksTable({
  control,
  day,
}: {
  control: Control<DayEditValues>
  /** The day being edited; new breaks start on it. */
  day: string
}) {
  const isWide = useMediaQuery(BREAKPOINTS.md)
  // Break types come from Attendance → Settings → Break Types.
  const breakOptions = useBreakTypes().list.map((type) => ({ value: type.id, label: type.name }))
  const { fields, append, remove } = useFieldArray({ control, name: 'breaks' })

  // A new break starts an hour after check in and lasts half an hour.
  const [checkInDate, checkInTime] = useWatch({ control, name: ['checkInDate', 'checkInTime'] })
  const add = () => {
    const start = checkInDate && checkInTime ? toLocal(checkInDate, checkInTime) : null
    const out = start ? splitLocal(shiftLocal(start, 60)) : { date: day, time: '13:00' }
    const back = start ? splitLocal(shiftLocal(start, 90)) : { date: day, time: '13:30' }
    append({
      type: '',
      outDate: out.date,
      outTime: out.time,
      inDate: back.date,
      inTime: back.time,
    })
  }

  return (
    <FieldLayoutContext value="vertical">
      <section aria-label="Breaks" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-medium text-heading sm:text-2xl">Breaks</h3>
          <Button
            onClick={add}
            className="h-9 bg-[#3B6FF5] px-5 text-base font-medium text-white hover:bg-[#3B6FF5]/90"
          >
            <Plus /> Add
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="rounded-md bg-success/15 px-4 py-3.5 text-base font-medium text-heading sm:text-[1.4375rem]">
            No Record Found
          </p>
        ) : isWide ? (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="text-left text-base text-heading [&>th]:px-1.5 [&>th]:pb-2 [&>th]:font-normal">
                  <th scope="col" className="w-36">
                    Break Type
                  </th>
                  <th scope="col">Break Out Date</th>
                  <th scope="col" className="w-32">
                    Break Out Time
                  </th>
                  <th scope="col">Break In Date</th>
                  <th scope="col" className="w-32">
                    Break In Time
                  </th>
                  <th scope="col" className="w-14 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((row, index) => (
                  <tr key={row.id} className="align-top [&>td]:px-1.5 [&>td]:pb-2">
                    <td>
                      <SelectField
                        control={control}
                        name={`breaks.${index}.type`}
                        label={`Break ${index + 1} type`}
                        placeholder="Break Type"
                        options={breakOptions}
                        className={hidden}
                      />
                    </td>
                    <td>
                      <DatePickerField
                        control={control}
                        name={`breaks.${index}.outDate`}
                        label={`Break ${index + 1} out date`}
                        className={hidden}
                      />
                    </td>
                    <td>
                      <TimePickerField
                        control={control}
                        name={`breaks.${index}.outTime`}
                        label={`Break ${index + 1} out time`}
                        hideLabel
                        className="gap-0"
                      />
                    </td>
                    <td>
                      <DatePickerField
                        control={control}
                        name={`breaks.${index}.inDate`}
                        label={`Break ${index + 1} in date`}
                        className={hidden}
                      />
                    </td>
                    <td>
                      <TimePickerField
                        control={control}
                        name={`breaks.${index}.inTime`}
                        label={`Break ${index + 1} in time`}
                        hideLabel
                        className="gap-0"
                      />
                    </td>
                    <td className="pt-1.5 text-center">
                      <RemoveButton index={index} onRemove={remove} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid gap-3">
            {fields.map((row, index) => (
              <li key={row.id} className="grid gap-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-heading">Break {index + 1}</span>
                  <RemoveButton index={index} onRemove={remove} />
                </div>
                <SelectField
                  control={control}
                  name={`breaks.${index}.type`}
                  label="Break Type"
                  placeholder="Break Type"
                  options={breakOptions}
                />
                <div className="grid grid-cols-2 gap-3">
                  <DatePickerField
                    control={control}
                    name={`breaks.${index}.outDate`}
                    label="Break Out Date"
                  />
                  <TimePickerField
                    control={control}
                    name={`breaks.${index}.outTime`}
                    label="Break Out Time"
                  />
                  <DatePickerField
                    control={control}
                    name={`breaks.${index}.inDate`}
                    label="Break In Date"
                  />
                  <TimePickerField
                    control={control}
                    name={`breaks.${index}.inTime`}
                    label="Break In Time"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </FieldLayoutContext>
  )
}

function RemoveButton({ index, onRemove }: { index: number; onRemove: (index: number) => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove break ${index + 1}`}
      onClick={() => {
        onRemove(index)
      }}
      className="inline-flex size-7 items-center justify-center rounded-full bg-destructive text-white outline-none hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <X className="size-4" strokeWidth={2.5} />
    </button>
  )
}
