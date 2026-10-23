import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { TextareaField, TextField } from '@/components/form'
import { ApiError } from '@/lib/api-error'

import { useApproveOvertime } from '../../hooks/use-attendance'
import { overtimeSchema, type OvertimeValues } from '../../schemas/time-sheet.schema'
import type { TimeSheetDay } from '../../types/attendance.types'
import { formatDuration } from '../../utils/local-time'
import { DayActionDialog } from './day-action-dialog'

/** Overtime: approves some or all of the minutes worked past the clock out. */
export function OvertimeDialog({ day, onClose }: { day: TimeSheetDay; onClose: () => void }) {
  const mutation = useApproveOvertime()
  const form = useForm<OvertimeValues>({
    resolver: zodResolver(overtimeSchema(day.overtimeMinutes)),
    defaultValues: { minutes: String(day.overtimeMinutes), reason: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        key: { employeeId: day.employeeId, date: day.date },
        input: { approvedMinutes: Number(values.minutes), reason: values.reason.trim() },
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const field = error.fieldErrors.approvedMinutes
        if (field) form.setError('minutes', { message: field })
        else form.setError('root', { message: error.message })
      }
      return
    }
    onClose()
  })

  return (
    <DayActionDialog
      title="Overtime"
      day={day}
      description={`${formatDuration(day.overtimeMinutes)} worked past the clock out. Approve all or part of it.`}
      submitLabel="Approve"
      pending={mutation.isPending}
      rootError={form.formState.errors.root?.message}
      onSubmit={(event) => void submit(event)}
      onClose={onClose}
    >
      <TextField
        control={form.control}
        name="minutes"
        label="Approved Minutes"
        inputMode="numeric"
        required
      />
      <TextareaField control={form.control} name="reason" label="Reason" required showCount />
    </DayActionDialog>
  )
}
