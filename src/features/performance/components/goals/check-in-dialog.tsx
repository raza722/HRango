import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextareaField, TextField } from '@/components/form'

import { GOAL_STATUS_META } from '../../constants'
import { useCheckIn } from '../../hooks/use-performance'
import {
  checkInFormSchema,
  checkInFormToInput,
  type CheckInFormValues,
  checkInToForm,
} from '../../schemas/performance-forms.schema'
import { type Goal, GOAL_STATUSES } from '../../types/performance.types'
import { showServerErrors } from '../../utils/form-errors'
import { formatNumber } from '../../utils/format'
import { FormDialog } from '../shared/dialogs'
import { ProgressBar } from '../shared/parts'

const FIELDS = ['progress', 'actualValue', 'status', 'comments']

/**
 * Check In (`POST /performance/goals/{id}/check-ins`): the progress now, the actual value
 * against the target, the status (or let the progress set it) and a note. Each check-in is
 * kept in the goal's history.
 */
export function CheckInDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const checkIn = useCheckIn()
  const form = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInFormSchema),
    defaultValues: checkInToForm(goal),
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await checkIn.mutateAsync({ id: goal.id, input: checkInFormToInput(values, goal) })
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS)
      return
    }
    onClose()
  })

  return (
    <FormDialog
      title="Check In"
      description={goal.title}
      onClose={onClose}
      onSubmit={submit}
      saving={checkIn.isPending}
      saveLabel="Check In"
      rootError={form.formState.errors.root?.message}
    >
      <div className="grid gap-1.5 rounded-lg bg-[#F5F7FB] px-4 py-3 dark:bg-muted">
        <span className="text-xs text-grey">Progress so far</span>
        <ProgressBar value={goal.progress} label={`Progress so far of ${goal.title}`} />
        {goal.targetValue !== null && (
          <span className="text-xs text-grey">
            Target {formatNumber(goal.targetValue)} · actual so far {formatNumber(goal.actualValue)}
          </span>
        )}
      </div>
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="progress"
          label="Progress (%)"
          required
          inputMode="decimal"
          placeholder="0 – 100"
        />
        {goal.targetValue !== null && (
          <TextField
            control={form.control}
            name="actualValue"
            label="Actual Value"
            inputMode="decimal"
            placeholder={`Target ${formatNumber(goal.targetValue)}`}
          />
        )}
        <SelectField
          control={form.control}
          name="status"
          label="Status"
          placeholder="Set from the progress"
          clearable="Set from the progress"
          options={GOAL_STATUSES.map((status) => ({
            value: status,
            label: GOAL_STATUS_META[status].label,
          }))}
        />
        <TextareaField
          control={form.control}
          name="comments"
          label="Comments"
          placeholder="What moved since the last check-in"
          className="@md:col-span-2"
        />
      </div>
    </FormDialog>
  )
}
