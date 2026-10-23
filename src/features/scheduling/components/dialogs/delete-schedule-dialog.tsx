import { useState } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { CheckboxField, DatePickerField, FieldLayoutContext } from '@/components/form'
import { Button } from '@/components/ui/button'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { useDeleteScheduleRange } from '../../hooks/use-scheduling'
import {
  deleteScheduleSchema,
  type DeleteScheduleValues,
} from '../../schemas/schedule-forms.schema'
import { EmployeeSelector } from '../fields/employee-selector'
import { validateStep } from './form-steps'
import { SchedulingDialog } from './scheduling-dialog'
import { TrashConfirmDialog } from './trash-confirm-dialog'

const stepOneSchema = z
  .object({
    startDate: z.string().min(1, 'Pick the start date'),
    endDate: z.string().min(1, 'Pick the end date'),
  })
  .refine((values) => values.endDate >= values.startDate, {
    path: ['endDate'],
    message: 'Pick a date on or after the start date',
  })

/**
 * Delete Scheduling: a date range, "Delete Rest Days" and "Delete for All
 * Employees"; without the last, Next opens Select Employees. A final
 * confirmation guards the delete.
 */
export function DeleteScheduleDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [confirming, setConfirming] = useState(false)
  const remove = useDeleteScheduleRange()
  const [today] = useState(() => toDateValue(new Date()))
  const form = useForm<DeleteScheduleValues>({
    resolver: zodResolver(deleteScheduleSchema),
    defaultValues: {
      startDate: today,
      endDate: today,
      deleteRestDays: false,
      allEmployees: true,
      employeeIds: [],
    },
    mode: 'onTouched',
  })
  const allEmployees = useWatch({ control: form.control, name: 'allEmployees' })
  const startDate = useWatch({ control: form.control, name: 'startDate' })
  const { field, fieldState } = useController({ control: form.control, name: 'employeeIds' })

  const askToConfirm = form.handleSubmit(() => {
    setConfirming(true)
  })

  const run = () => {
    remove.mutate(form.getValues(), {
      onSuccess: onClose,
      onSettled: () => {
        setConfirming(false)
      },
    })
  }

  const deleteButton = (
    <Button
      type="submit"
      form="delete-schedule-form"
      variant="success"
      size="lg"
      className={dialogButtonClass}
    >
      {remove.isPending && <Loader2 className="animate-spin" />}
      Delete
    </Button>
  )

  return (
    <SchedulingDialog
      title={step === 1 ? 'Delete Scheduling' : 'Select Employees'}
      steps={allEmployees ? undefined : { current: step, total: 2 }}
      onRequestClose={onClose}
      className={step === 2 ? 'max-w-5xl' : 'max-w-3xl'}
      footer={
        step === 1 ? (
          <>
            {allEmployees ? (
              deleteButton
            ) : (
              <Button
                size="lg"
                onClick={() => {
                  if (validateStep(form, stepOneSchema)) setStep(2)
                }}
                className={dialogButtonClass}
              >
                Next
              </Button>
            )}
            <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => {
                setStep(1)
              }}
              className={cn(dialogButtonClass, 'bg-orange-500 text-white hover:bg-orange-500/90')}
            >
              Back
            </Button>
            {deleteButton}
            <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
              Cancel
            </Button>
          </>
        )
      }
    >
      <form
        id="delete-schedule-form"
        noValidate
        onSubmit={askToConfirm}
        aria-label="Delete Scheduling"
      >
        {step === 1 ? (
          <FieldLayoutContext value="horizontal">
            <div className="grid gap-5">
              <DatePickerField
                control={form.control}
                name="startDate"
                label="Start Date"
                required
              />
              <DatePickerField
                control={form.control}
                name="endDate"
                label="End Date"
                required
                minDate={parseDateValue(startDate)}
              />
              <FieldLayoutContext value="vertical">
                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  <CheckboxField
                    control={form.control}
                    name="deleteRestDays"
                    label="Delete Rest Days"
                  />
                  <CheckboxField
                    control={form.control}
                    name="allEmployees"
                    label="Delete for All Employees"
                    onCheckedChange={(checked) => {
                      if (checked) setStep(1)
                    }}
                  />
                </div>
              </FieldLayoutContext>
            </div>
          </FieldLayoutContext>
        ) : (
          <EmployeeSelector
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      </form>
      <TrashConfirmDialog
        open={confirming}
        pending={remove.isPending}
        message={
          form.getValues('deleteRestDays')
            ? 'Are you sure you want to Delete this Schedule, including its Rest Days?'
            : 'Are you sure you want to Delete this Schedule? Rest Days will not be Deleted.'
        }
        onCancel={() => {
          setConfirming(false)
        }}
        onConfirm={run}
      />
    </SchedulingDialog>
  )
}
