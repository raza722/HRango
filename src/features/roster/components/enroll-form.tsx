import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'

import { DatePickerField, SelectField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { branchResource, useOrgList } from '@/features/settings'
import { ApiError } from '@/lib/api-error'
import { parseDateValue, toDateValue } from '@/lib/date'

import { useEnrollEmployees } from '../hooks/use-roster-enrollments'
import { enrollmentFormSchema, type EnrollmentFormValues } from '../schemas/enrollment-form.schema'
import { EmployeePicker } from './employee-picker'

export const ENROLL_FORM_ID = 'roster-enroll-form'

interface EnrollFormProps {
  groupId: string
  onBack: () => void
}

/**
 * "Enroll New Employee" (not designed): pick people, the period and,
 * optionally, the branch they work this roster at (Settings → Branch).
 */
export function EnrollForm({ groupId, onBack }: EnrollFormProps) {
  const enroll = useEnrollEmployees(groupId)
  const branches = useOrgList(branchResource, { page: 1, pageSize: 100 })
  const branchOptions = (branches.data?.data ?? []).map((branch) => ({
    value: branch.id,
    label: `${branch.name} · ${branch.locationName}`,
  }))

  const form = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: {
      employeeIds: [],
      startDate: toDateValue(new Date()),
      endDate: '',
      branchId: '',
    },
    mode: 'onTouched',
  })
  const { control, setError } = form
  const startDate = useWatch({ control, name: 'startDate' })

  const submit = form.handleSubmit(async (values) => {
    try {
      await enroll.mutateAsync({
        employeeIds: values.employeeIds,
        startDate: values.startDate,
        endDate: values.endDate || null,
        branchId: values.branchId || null,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const field = error.fieldErrors.employeeIds
          ? 'employeeIds'
          : error.fieldErrors.endDate
            ? 'endDate'
            : null
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
        <EmployeePicker control={control} groupId={groupId} />
        <div className="grid gap-5 @2xl:grid-cols-3 @2xl:gap-x-6">
          <DatePickerField control={control} name="startDate" label="Start Date" required />
          <DatePickerField
            control={control}
            name="endDate"
            label="End Date"
            placeholder="Open-ended"
            minDate={parseDateValue(startDate)}
            description="Leave empty to keep them on this roster."
          />
          <SelectField
            control={control}
            name="branchId"
            label="Branch"
            placeholder="Any branch"
            options={branchOptions}
            clearable="Any branch"
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
