import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

import { DatePickerField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { parseDateValue, toDateValue } from '@/lib/date'

import { ENROLLMENT_DATE_FORMAT } from '../constants'
import { useEnrollEmployees } from '../hooks/use-roster-enrollments'
import { enrollmentFormSchema, type EnrollmentFormValues } from '../schemas/enrollment-form.schema'
import type { RosterGroupDetail } from '../types/roster.types'
import { EmployeePicker } from './employee-picker'

export const ENROLL_FORM_ID = 'roster-enroll-form'

interface EnrollFormProps {
  group: RosterGroupDetail
  onBack: () => void
}

const FIELDS = ['employeeIds', 'startDate', 'endDate'] as const

/** The first day an enrolment may start: today, or the roster's start if that is later. */
function firstDay(group: RosterGroupDetail): string {
  const today = toDateValue(new Date())
  return group.fromDate > today ? group.fromDate : today
}

/**
 * "Enroll New Employee" (not designed): pick people and the period they follow this
 * roster, inside the roster's own period. Someone already on a roster for those dates is
 * refused by the API (409), shown under the employee list.
 */
export function EnrollForm({ group, onBack }: EnrollFormProps) {
  const enroll = useEnrollEmployees(group.id)

  const form = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: { employeeIds: [], startDate: firstDay(group), endDate: '' },
    mode: 'onTouched',
  })
  const { control, setError } = form
  const startDate = useWatch({ control, name: 'startDate' })
  const period = `${format(parseISO(group.fromDate), ENROLLMENT_DATE_FORMAT)} – ${
    group.toDate ? format(parseISO(group.toDate), ENROLLMENT_DATE_FORMAT) : 'open-ended'
  }`

  const submit = form.handleSubmit(async (values) => {
    try {
      await enroll.mutateAsync({
        employeeIds: values.employeeIds,
        startDate: values.startDate,
        endDate: values.endDate || null,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const field = FIELDS.find((name) => error.fieldErrors[name])
        setError(field ?? 'root', {
          type: 'server',
          message: (field && error.fieldErrors[field]) ?? error.message,
        })
      }
      return
    }
    form.reset()
    onBack()
  })

  const rootError = form.formState.errors.root?.message

  return (
    <form id={ENROLL_FORM_ID} noValidate onSubmit={submit} aria-label="Enroll employees">
      <fieldset disabled={enroll.isPending} className="grid min-w-0 gap-6">
        <Button variant="link" onClick={onBack} className="h-auto w-fit p-0 text-field-foreground">
          <ArrowLeft /> Back to enrolled employees
        </Button>
        <EmployeePicker control={control} />
        <div className="grid gap-5 @2xl:grid-cols-2 @2xl:gap-x-6">
          <DatePickerField
            control={control}
            name="startDate"
            label="Start Date"
            required
            minDate={parseDateValue(group.fromDate)}
            maxDate={group.toDate ? parseDateValue(group.toDate) : undefined}
            description={`The roster runs ${period}.`}
          />
          <DatePickerField
            control={control}
            name="endDate"
            label="End Date"
            placeholder={group.toDate ? 'Until the roster ends' : 'Open-ended'}
            minDate={parseDateValue(startDate)}
            maxDate={group.toDate ? parseDateValue(group.toDate) : undefined}
            description="Leave empty to keep them on this roster."
          />
        </div>
        {rootError && (
          <p role="alert" className="text-sm text-destructive">
            {rootError}
          </p>
        )}
      </fieldset>
    </form>
  )
}
