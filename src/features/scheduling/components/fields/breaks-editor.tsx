import { type Control, useController, useFieldArray } from 'react-hook-form'
import { Info, Plus, X } from 'lucide-react'

import {
  DatePickerField,
  FieldLayoutContext,
  SelectField,
  TextField,
  TimePickerField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { BREAK_TYPE_LABELS } from '../../constants'
import type { CreateScheduleValues } from '../../schemas/schedule-forms.schema'
import { BREAK_TYPES } from '../../types/scheduling.types'
import { schedulingType } from '../type-styles'

const BREAK_OPTIONS = BREAK_TYPES.map((type) => ({ value: type, label: BREAK_TYPE_LABELS[type] }))

interface BreaksEditorProps {
  control: Control<CreateScheduleValues>
  /** Dates new rows start with (the schedule's start and end). */
  defaultDates: { startDate: string; endDate: string }
}

function InclusiveBox({
  control,
  index,
}: {
  control: Control<CreateScheduleValues>
  index: number
}) {
  const {
    field: { value, onChange, ref },
  } = useController({ control, name: `breaks.${index}.inclusive` })
  return (
    <span className="flex items-center gap-1.5">
      <Checkbox
        ref={ref}
        aria-label={`Break ${index + 1} is inclusive`}
        checked={value}
        onCheckedChange={(checked) => {
          onChange(checked === true)
        }}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What inclusive means"
            className="text-label outline-none"
          >
            <Info className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Inclusive breaks are paid and count as working time.</TooltipContent>
      </Tooltip>
    </span>
  )
}

/**
 * "Breaks" with "+ Add": one row per break (type, dates, times, description,
 * inclusive) as a table on wide screens and stacked cards on phones.
 */
export function BreaksEditor({ control, defaultDates }: BreaksEditorProps) {
  const isWide = useMediaQuery(BREAKPOINTS.md)
  const { fields, append, remove } = useFieldArray({ control, name: 'breaks' })

  const add = () => {
    append({
      type: 'lunch',
      startDate: defaultDates.startDate,
      endDate: defaultDates.endDate,
      startTime: '13:00',
      endTime: '14:00',
      description: '',
      inclusive: false,
    })
  }

  return (
    <FieldLayoutContext value="vertical">
      <section aria-label="Breaks" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className={schedulingType.section}>Breaks</h3>
          <Button
            size="sm"
            onClick={add}
            className={cn('bg-blue-600 text-white hover:bg-blue-600/90', schedulingType.button)}
          >
            <Plus /> Add
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="rounded-md bg-success/15 px-3 py-2.5 text-sm text-field-foreground">
            No Record Found
          </p>
        ) : isWide ? (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="text-left text-heading [&>th]:px-1.5 [&>th]:pb-2 [&>th]:font-normal">
                  <th scope="col" className="w-36">
                    Break Type
                  </th>
                  <th scope="col">Start Date</th>
                  <th scope="col">End Date</th>
                  <th scope="col" className="w-32">
                    Break Start Time
                  </th>
                  <th scope="col" className="w-32">
                    Break End Time
                  </th>
                  <th scope="col">Description</th>
                  <th scope="col" className="w-20">
                    Inclusive
                  </th>
                  <th scope="col" className="w-12">
                    Action
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
                        options={BREAK_OPTIONS}
                        className="gap-0 [&>label]:sr-only"
                      />
                    </td>
                    <td>
                      <DatePickerField
                        control={control}
                        name={`breaks.${index}.startDate`}
                        label={`Break ${index + 1} start date`}
                        className="gap-0 [&>label]:sr-only"
                      />
                    </td>
                    <td>
                      <DatePickerField
                        control={control}
                        name={`breaks.${index}.endDate`}
                        label={`Break ${index + 1} end date`}
                        className="gap-0 [&>label]:sr-only"
                      />
                    </td>
                    <td>
                      <TimePickerField
                        control={control}
                        name={`breaks.${index}.startTime`}
                        label={`Break ${index + 1} start time`}
                        hideLabel
                        className="gap-0"
                      />
                    </td>
                    <td>
                      <TimePickerField
                        control={control}
                        name={`breaks.${index}.endTime`}
                        label={`Break ${index + 1} end time`}
                        hideLabel
                        className="gap-0"
                      />
                    </td>
                    <td>
                      <TextField
                        control={control}
                        name={`breaks.${index}.description`}
                        label={`Break ${index + 1} description`}
                        maxLength={200}
                        className="gap-0 [&>label]:sr-only"
                      />
                    </td>
                    <td className="pt-2.5">
                      <InclusiveBox control={control} index={index} />
                    </td>
                    <td className="pt-1.5">
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
                  options={BREAK_OPTIONS}
                />
                <div className="grid grid-cols-2 gap-3">
                  <DatePickerField
                    control={control}
                    name={`breaks.${index}.startDate`}
                    label="Start Date"
                  />
                  <DatePickerField
                    control={control}
                    name={`breaks.${index}.endDate`}
                    label="End Date"
                  />
                  <TimePickerField
                    control={control}
                    name={`breaks.${index}.startTime`}
                    label="Break Start"
                  />
                  <TimePickerField
                    control={control}
                    name={`breaks.${index}.endTime`}
                    label="Break End"
                  />
                </div>
                <TextField
                  control={control}
                  name={`breaks.${index}.description`}
                  label="Description"
                  maxLength={200}
                />
                <span className="flex items-center gap-2 text-sm text-field-foreground">
                  <InclusiveBox control={control} index={index} /> Inclusive
                </span>
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
      className="flex size-7 items-center justify-center rounded-full bg-destructive text-white outline-none hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <X className="size-4" strokeWidth={2.5} />
    </button>
  )
}
