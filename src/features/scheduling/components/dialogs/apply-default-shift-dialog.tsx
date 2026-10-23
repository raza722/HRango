import { useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { DatePickerField, FieldLayoutContext, SelectField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { parseDateValue, toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { useRosterTones } from '../../hooks/use-roster-tones'
import { useApplyDefaultShift } from '../../hooks/use-scheduling'
import { applyDefaultSchema, type ApplyDefaultValues } from '../../schemas/schedule-forms.schema'
import { toDate } from '../../utils/schedule-dates'
import { EmployeeSelector } from '../fields/employee-selector'
import { validateStep } from './form-steps'
import { SchedulingDialog } from './scheduling-dialog'

const stepOneSchema = z
  .object({
    startDate: z.string().min(1, 'Pick the start date'),
    endDate: z.string().min(1, 'Pick the end date'),
    rosterGroupId: z.string().min(1, 'Select a roster group'),
  })
  .refine((values) => values.endDate >= values.startDate, {
    path: ['endDate'],
    message: 'Pick a date on or after the start date',
  })

/**
 * Apply Default Shift: Start Date, End Date and Roster Group, then Select
 * Employees. Every day in the range follows the roster (weekends become rest
 * days) and replaces what was scheduled.
 */
export function ApplyDefaultShiftDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const tones = useRosterTones()
  const apply = useApplyDefaultShift()
  const [today] = useState(() => toDateValue(new Date()))
  const form = useForm<ApplyDefaultValues>({
    resolver: zodResolver(applyDefaultSchema),
    defaultValues: {
      startDate: today,
      endDate: toDateValue(addDays(toDate(today), 6)),
      rosterGroupId: '',
      employeeIds: [],
    },
    mode: 'onTouched',
  })
  const { field, fieldState } = useController({ control: form.control, name: 'employeeIds' })

  const submit = form.handleSubmit(async (values) => {
    try {
      await apply.mutateAsync(values)
    } catch {
      return
    }
    onClose()
  })

  return (
    <SchedulingDialog
      title={step === 1 ? 'Apply Default Shift' : 'Select Employees'}
      steps={{ current: step, total: 2 }}
      onRequestClose={onClose}
      className={step === 2 ? 'max-w-5xl' : 'max-w-3xl'}
      footer={
        step === 1 ? (
          <>
            <Button
              size="lg"
              onClick={() => {
                if (validateStep(form, stepOneSchema)) setStep(2)
              }}
              className={dialogButtonClass}
            >
              Next
            </Button>
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
            <Button
              type="submit"
              form="apply-default-form"
              variant="success"
              size="lg"
              disabled={apply.isPending}
              className={dialogButtonClass}
            >
              {apply.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
            <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
              Cancel
            </Button>
          </>
        )
      }
    >
      <form id="apply-default-form" noValidate onSubmit={submit} aria-label="Apply Default Shift">
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
                minDate={parseDateValue(form.getValues('startDate'))}
              />
              <SelectField
                control={form.control}
                name="rosterGroupId"
                label="Roster Group"
                required
                placeholder="Select Roster Group"
                options={tones.groups.map((group) => ({ value: group.id, label: group.title }))}
              />
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
    </SchedulingDialog>
  )
}
