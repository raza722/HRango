import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { TextareaField } from '@/components/form'
import { ApiError } from '@/lib/api-error'

import { useApplyRelaxation } from '../../hooks/use-attendance'
import { relaxationSchema, type RelaxationValues } from '../../schemas/time-sheet.schema'
import type { TimeSheetDay } from '../../types/attendance.types'
import { DayActionDialog } from './day-action-dialog'

/**
 * Relaxation: waives a late arrival or early leave, so it no longer counts
 * towards the monthly warnings. The day shows as "Relaxation".
 */
export function RelaxationDialog({ day, onClose }: { day: TimeSheetDay; onClose: () => void }) {
  const mutation = useApplyRelaxation()
  const form = useForm<RelaxationValues>({
    resolver: zodResolver(relaxationSchema),
    defaultValues: { reason: '' },
  })
  const minutes = [
    day.lateMinutes > 0 ? `${day.lateMinutes} minutes late` : null,
    day.earlyMinutes > 0 ? `${day.earlyMinutes} minutes early` : null,
  ]
    .filter(Boolean)
    .join(' and ')

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        key: { employeeId: day.employeeId, date: day.date },
        input: { reason: values.reason.trim() },
      })
    } catch (error) {
      if (error instanceof ApiError) form.setError('root', { message: error.message })
      return
    }
    onClose()
  })

  return (
    <DayActionDialog
      title="Relaxation"
      day={day}
      description={`Waive ${minutes || 'the late minutes'} so this day does not count as a warning.`}
      submitLabel="Apply"
      pending={mutation.isPending}
      rootError={form.formState.errors.root?.message}
      onSubmit={(event) => void submit(event)}
      onClose={onClose}
    >
      <TextareaField control={form.control} name="reason" label="Reason" required showCount />
    </DayActionDialog>
  )
}
