import { type SyntheticEvent, useEffect, useId } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormField, TextField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'

import { useCurrentSalary, useSalaryRevision, useSaveSalaryRevision } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { SalaryRevisionDetail } from '../../types/payroll.types'
import { formatAmount, formatLong } from '../../utils/format'
import { ReadOnlyRow, RsField, RsInput } from '../balances/list-parts'
import { DateField } from '../shared/date-input'
import { EmployeeCard } from '../shared/employee-card'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { TwoWaySwitch } from '../shared/two-way-switch'

const DATE = 'MMMM d, yyyy'

const schema = z
  .object({
    employeeId: z
      .string()
      .nullable()
      .refine((value) => Boolean(value), { message: 'Choose the employee' }),
    effectiveDate: z.string().min(1, 'Choose the effective date'),
    type: z.enum(['flat', 'percentage']),
    percentage: z.string(),
    salary: z
      .string()
      .refine((value) => Number(value.replace(/,/g, '')) > 0, { message: 'Enter the salary' }),
  })
  .refine((value) => value.type === 'flat' || Number(value.percentage) > 0, {
    message: 'Enter the percentage increase',
    path: ['percentage'],
  })
type Values = z.infer<typeof schema>

const raise = (salary: number, percentage: string) => {
  const rate = Number(percentage)
  return Number.isFinite(rate) && rate > 0 ? Math.round(salary * (1 + rate / 100)) : null
}

function TypeSwitch({
  value,
  onChange,
}: {
  value: 'flat' | 'percentage'
  onChange: (value: 'flat' | 'percentage') => void
}) {
  return (
    <FormField label="Type">
      {(a11y) => (
        <TwoWaySwitch
          id={a11y.id}
          label="Type"
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'percentage', label: 'Percentage' },
          ]}
          value={value}
          onChange={onChange}
        />
      )}
    </FormField>
  )
}

/**
 * "Salary Revision Create": Employee, Effective Date, Flat or Percentage;
 * with Percentage the new salary is worked out from the current one.
 */
export function SalaryRevisionCreateDialog({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const options = usePayrollOptions()
  const save = useSaveSalaryRevision()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: null,
      effectiveDate: '',
      type: 'flat',
      percentage: '',
      salary: '',
    },
  })
  const type = useController({ control: form.control, name: 'type' })
  const [employeeId, effectiveDate, percentage] = useWatch({
    control: form.control,
    name: ['employeeId', 'effectiveDate', 'percentage'],
  })
  const current = useCurrentSalary(employeeId, effectiveDate)
  const currentSalary = current.data?.salary

  // With Percentage, the salary follows the current salary and the increase.
  useEffect(() => {
    if (type.field.value !== 'percentage' || currentSalary === undefined) return
    const next = raise(currentSalary, percentage)
    if (next !== null) form.setValue('salary', String(next), { shouldValidate: true })
  }, [currentSalary, form, percentage, type.field.value])

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        input: {
          employeeId: values.employeeId ?? '',
          effectiveDate: values.effectiveDate,
          type: values.type,
          percentage: values.type === 'percentage' ? Number(values.percentage) : null,
          salary: Number(values.salary.replace(/,/g, '')),
        },
      })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.effectiveDate) {
        form.setError('effectiveDate', { message: error.fieldErrors.effectiveDate })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the revision.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title="Salary Revision Create"
      onClose={onClose}
      formId={formId}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className="grid gap-5"
      >
        <SearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          options={options.activeEmployees}
          required
        />
        <DateField
          control={form.control}
          name="effectiveDate"
          label="Effective Date"
          required
          display={DATE}
        />
        <TypeSwitch value={type.field.value} onChange={type.field.onChange} />
        {type.field.value === 'percentage' && (
          <TextField
            control={form.control}
            name="percentage"
            label="Percentage Increase"
            inputMode="decimal"
            required
          />
        )}
        <RsField control={form.control} name="salary" label="Salary" />
        {currentSalary !== undefined && (
          <p className="-mt-2 text-xs text-muted-foreground @xl:ml-[11.5rem] @3xl:ml-[12.5rem]">
            Current salary: Rs {formatAmount(currentSalary)}
          </p>
        )}
      </form>
    </PayrollDialog>
  )
}

/** Edit: the person card, then Effective Date, Previous Salary, Type, Percentage Increase and Salary. */
export function SalaryRevisionEditDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const revision = useSalaryRevision(id)
  if (!revision.data) {
    return (
      <PayrollDialog title="Salary Revision Edit" onClose={onClose} readOnly>
        <Skeleton className="h-72 w-full" />
      </PayrollDialog>
    )
  }
  return <EditForm revision={revision.data} onClose={onClose} />
}

function EditForm({ revision, onClose }: { revision: SalaryRevisionDetail; onClose: () => void }) {
  const formId = useId()
  const save = useSaveSalaryRevision()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: revision.employeeId,
      effectiveDate: revision.effectiveDate,
      type: revision.type,
      percentage: revision.percentage === null ? '' : String(revision.percentage),
      salary: String(revision.salary),
    },
  })
  const type = useController({ control: form.control, name: 'type' })
  const percentage = useWatch({ control: form.control, name: 'percentage' })

  useEffect(() => {
    if (type.field.value !== 'percentage') return
    const next = raise(revision.previousSalary, percentage)
    if (next !== null) form.setValue('salary', String(next), { shouldValidate: true })
  }, [form, percentage, revision.previousSalary, type.field.value])

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: revision.id,
        input: {
          employeeId: revision.employeeId,
          effectiveDate: values.effectiveDate,
          type: values.type,
          percentage: values.type === 'percentage' ? Number(values.percentage) : null,
          salary: Number(values.salary.replace(/,/g, '')),
        },
      })
      onClose()
    } catch (error) {
      form.setError('root', {
        message: error instanceof ApiError ? error.message : 'Could not save the revision.',
      })
    }
  })

  return (
    <PayrollDialog
      title="Salary Revision Edit"
      onClose={onClose}
      formId={formId}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
    >
      <div className="grid gap-8">
        <EmployeeCard profile={revision.profile} />
        <form
          id={formId}
          noValidate
          onSubmit={(event: SyntheticEvent) => void submit(event)}
          className="grid gap-5"
        >
          <DateField
            control={form.control}
            name="effectiveDate"
            label="Effective Date"
            required
            display={DATE}
          />
          <FormField label="Previous Salary">
            {(a11y) => <RsInput {...a11y} value={formatAmount(revision.previousSalary)} readOnly />}
          </FormField>
          <TypeSwitch value={type.field.value} onChange={type.field.onChange} />
          {type.field.value === 'percentage' && (
            <TextField
              control={form.control}
              name="percentage"
              label="Percentage Increase"
              inputMode="decimal"
              required
            />
          )}
          <RsField control={form.control} name="salary" label="Salary" />
        </form>
      </div>
    </PayrollDialog>
  )
}

/** View: the person card, then Effective Date, Previous Salary and Salary. */
export function SalaryRevisionViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const revision = useSalaryRevision(id)
  const data = revision.data
  return (
    <PayrollDialog title="Salary Revision View" onClose={onClose} readOnly>
      <div className="grid gap-8">
        <EmployeeCard profile={data?.profile} />
        {data ? (
          <div className="grid gap-5">
            <ReadOnlyRow label="Effective Date" value={formatLong(data.effectiveDate)} />
            <ReadOnlyRow
              label="Previous Salary"
              value={`RS ${formatAmount(data.previousSalary)}`}
            />
            <ReadOnlyRow label="Salary" value={`RS ${formatAmount(data.salary)}`} />
          </div>
        ) : (
          <Skeleton className="h-36 w-full" />
        )}
      </div>
    </PayrollDialog>
  )
}
