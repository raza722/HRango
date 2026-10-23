import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format, parse } from 'date-fns'

import { DatePickerField, SelectField, TextareaField, TimePickerField } from '@/components/form'
import { ApiError } from '@/lib/api-error'

import { useAddMissingPunch } from '../../hooks/use-attendance'
import { missingPunchSchema, type MissingPunchValues } from '../../schemas/time-sheet.schema'
import type { TimeSheetDay } from '../../types/attendance.types'
import { toLocal } from '../../utils/local-time'
import { DayActionDialog } from './day-action-dialog'

const PUNCH_OPTIONS = [
  { value: 'check-in', label: 'Check In' },
  { value: 'check-out', label: 'Check Out' },
]

/** Missing Punch: adds the check in or check out the device did not record. */
export function MissingPunchDialog({ day, onClose }: { day: TimeSheetDay; onClose: () => void }) {
  const mutation = useAddMissingPunch()
  const type = day.clockInStatus === 'missing-punch' ? 'check-in' : 'check-out'
  // An overnight shift clocks out the next morning.
  const overnight =
    day.expectedIn !== null && day.expectedOut !== null && day.expectedOut < day.expectedIn
  const outDate = overnight
    ? format(addDays(parse(day.date, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM-dd')
    : day.date

  const form = useForm<MissingPunchValues>({
    resolver: zodResolver(missingPunchSchema),
    defaultValues: {
      type,
      date: type === 'check-out' ? outDate : day.date,
      time: (type === 'check-in' ? day.expectedIn : day.expectedOut) ?? '',
      reason: '',
    },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        key: { employeeId: day.employeeId, date: day.date },
        input: {
          type: values.type,
          at: toLocal(values.date, values.time),
          reason: values.reason.trim(),
        },
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const at = error.fieldErrors.at
        if (at) form.setError('time', { message: at })
        else form.setError('root', { message: error.message })
      }
      return
    }
    onClose()
  })

  return (
    <DayActionDialog
      title="Missing Punch"
      day={day}
      description="Add the punch the device did not record. It is saved as a manual punch."
      pending={mutation.isPending}
      rootError={form.formState.errors.root?.message}
      onSubmit={(event) => void submit(event)}
      onClose={onClose}
    >
      <SelectField
        control={form.control}
        name="type"
        label="Punch Type"
        options={PUNCH_OPTIONS}
        required
      />
      <div className="grid gap-4 @md:grid-cols-2">
        <DatePickerField control={form.control} name="date" label="Punch Date" required />
        <TimePickerField control={form.control} name="time" label="Punch Time" required />
      </div>
      <TextareaField control={form.control} name="reason" label="Reason" required showCount />
    </DayActionDialog>
  )
}
