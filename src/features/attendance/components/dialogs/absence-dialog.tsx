import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextareaField } from '@/components/form'
import { ApiError } from '@/lib/api-error'

import { ABSENCE_MARK_LABELS } from '../../constants'
import { useMarkAbsence } from '../../hooks/use-attendance'
import { absenceSchema, type AbsenceValues } from '../../schemas/time-sheet.schema'
import { ABSENCE_MARKS, type TimeSheetDay } from '../../types/attendance.types'
import { DayActionDialog } from './day-action-dialog'

const OPTIONS = ABSENCE_MARKS.map((mark) => ({ value: mark, label: ABSENCE_MARK_LABELS[mark] }))

/**
 * Absent: records how a day without punches counts: kept as an unpaid
 * absence, or turned into leave, official duty, an official visit or WFH.
 */
export function AbsenceDialog({ day, onClose }: { day: TimeSheetDay; onClose: () => void }) {
  const mutation = useMarkAbsence()
  const form = useForm<AbsenceValues>({
    resolver: zodResolver(absenceSchema),
    defaultValues: { markAs: 'leave', reason: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        key: { employeeId: day.employeeId, date: day.date },
        input: { markAs: values.markAs, reason: values.reason.trim() },
      })
    } catch (error) {
      if (error instanceof ApiError) form.setError('root', { message: error.message })
      return
    }
    onClose()
  })

  return (
    <DayActionDialog
      title="Absent"
      day={day}
      description="Nothing was punched on this day. Record how it should count."
      pending={mutation.isPending}
      rootError={form.formState.errors.root?.message}
      onSubmit={(event) => void submit(event)}
      onClose={onClose}
    >
      <SelectField
        control={form.control}
        name="markAs"
        label="Mark As"
        options={OPTIONS}
        required
      />
      <TextareaField control={form.control} name="reason" label="Reason" required showCount />
    </DayActionDialog>
  )
}
