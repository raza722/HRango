import { type SyntheticEvent, useId } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, isValid, parseISO, subDays } from 'date-fns'
import { z } from 'zod'

import { FormField, TextField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'

import { useCurrentSalary, useSalaryRevision, useSaveSalaryRevision } from '../../hooks/use-payroll'
import { personHint, usePayrollOptions } from '../../hooks/use-payroll-records'
import type { SalaryRevisionRow } from '../../types/payroll.types'
import { formatAmount, formatLong, profileOf } from '../../utils/format'
import { ReadOnlyRow, RsInput } from '../balances/list-parts'
import { DateField } from '../shared/date-input'
import { EmployeeCard } from '../shared/employee-card'
import { EmployeeSearchSelectField } from '../shared/employee-search-select'
import { PayrollDialog } from '../shared/payroll-dialog'
import { TwoWaySwitch } from '../shared/two-way-switch'

const DATE = 'MMMM d, yyyy'

type ChangeType = 'flat' | 'percent'

const schema = z
  .object({
    employeeId: z
      .string()
      .nullable()
      .refine((value) => Boolean(value), { message: 'Choose the employee' }),
    effectiveDate: z.string().min(1, 'Choose the effective date'),
    changeType: z.enum(['flat', 'percent']),
    changeValue: z.string(),
  })
  .refine(
    (value) => {
      const number = Number(value.changeValue.replace(/,/g, ''))
      return value.changeValue.trim() !== '' && Number.isFinite(number) && number !== 0
    },
    { message: 'Enter the change (not zero)', path: ['changeValue'] },
  )
  .refine((value) => value.changeType === 'flat' || Number(value.changeValue) > -100, {
    message: 'A percentage cut cannot be 100% or more',
    path: ['changeValue'],
  })
type Values = z.infer<typeof schema>

/** Flat adds the value to the previous salary; Percentage raises it by that much. */
function revisedSalary(previous: number, changeType: ChangeType, value: string) {
  const number = Number(value.replace(/,/g, ''))
  if (value.trim() === '' || !Number.isFinite(number)) return null
  return changeType === 'flat'
    ? Math.round((previous + number) * 100) / 100
    : Math.round(previous * (1 + number / 100) * 100) / 100
}

const dayBefore = (date: string) => {
  const parsed = parseISO(date)
  return isValid(parsed) ? format(subDays(parsed, 1), 'yyyy-MM-dd') : ''
}

function TypeSwitch({
  value,
  onChange,
  disabled,
}: {
  value: ChangeType
  onChange: (value: ChangeType) => void
  disabled?: boolean
}) {
  return (
    <FormField label="Type">
      {(a11y) => (
        <TwoWaySwitch
          id={a11y.id}
          label="Type"
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'percent', label: 'Percentage' },
          ]}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      )}
    </FormField>
  )
}

/** The change (Rs or %) and the salary it gives, worked out from the previous salary. */
function ChangeFields({
  form,
  previous,
}: {
  form: ReturnType<typeof useForm<Values>>
  previous: number | null | undefined
}) {
  const type = useController({ control: form.control, name: 'changeType' })
  const value = useWatch({ control: form.control, name: 'changeValue' })
  const next =
    previous === null || previous === undefined
      ? null
      : revisedSalary(previous, type.field.value, value)
  return (
    <>
      <FormField label="Previous Salary">
        {(a11y) => (
          <RsInput
            {...a11y}
            value={previous === null || previous === undefined ? '' : formatAmount(previous)}
            placeholder="Choose the employee and date"
            readOnly
          />
        )}
      </FormField>
      <TypeSwitch value={type.field.value} onChange={type.field.onChange} />
      <TextField
        control={form.control}
        name="changeValue"
        label={type.field.value === 'flat' ? 'Increase Amount' : 'Percentage Increase'}
        inputMode="decimal"
        required
      />
      <FormField label="New Salary">
        {(a11y) => <RsInput {...a11y} value={next === null ? '' : formatAmount(next)} readOnly />}
      </FormField>
    </>
  )
}

function useSubmit(
  form: ReturnType<typeof useForm<Values>>,
  onClose: () => void,
  revision?: SalaryRevisionRow,
) {
  const save = useSaveSalaryRevision()
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: revision?.id,
        input: {
          employeeId: values.employeeId ?? '',
          effectiveDate: values.effectiveDate,
          changeType: values.changeType,
          changeValue: Number(values.changeValue.replace(/,/g, '')),
          ...(revision ? { rowVersion: revision.rowVersion } : {}),
        },
      })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.effectiveDate) {
        form.setError('effectiveDate', { message: error.fieldErrors.effectiveDate })
      } else if (error instanceof ApiError && error.fieldErrors.changeValue) {
        form.setError('changeValue', { message: error.fieldErrors.changeValue })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the revision.',
        })
      }
    }
  })
  return { save, submit }
}

/**
 * "Salary Revision Create" (`POST /salary-revisions`): Employee, Effective Date, Flat or
 * Percentage and the change; the new salary is shown from the salary the day before.
 */
export function SalaryRevisionCreateDialog({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const options = usePayrollOptions('payroll.salary_revision.view')
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { employeeId: null, effectiveDate: '', changeType: 'flat', changeValue: '' },
  })
  const [employeeId, effectiveDate] = useWatch({
    control: form.control,
    name: ['employeeId', 'effectiveDate'],
  })
  const current = useCurrentSalary(employeeId, dayBefore(effectiveDate))
  const { save, submit } = useSubmit(form, onClose)

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
        <EmployeeSearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee"
          placeholder="Select Employee"
          filters={options.activeEmployeeFilters}
          hint={personHint}
          required
        />
        <DateField
          control={form.control}
          name="effectiveDate"
          label="Effective Date"
          required
          display={DATE}
        />
        <ChangeFields form={form} previous={current.data?.salary} />
      </form>
    </PayrollDialog>
  )
}

/** Edit (`PUT /salary-revisions/{id}`): the person card, then the date and the change. */
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

function EditForm({ revision, onClose }: { revision: SalaryRevisionRow; onClose: () => void }) {
  const formId = useId()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: revision.employeeId,
      effectiveDate: revision.effectiveDate,
      changeType: revision.changeType ?? 'flat',
      changeValue:
        revision.changeValue === null
          ? String(revision.amount - (revision.previousAmount ?? 0))
          : String(revision.changeValue),
    },
  })
  const { save, submit } = useSubmit(form, onClose, revision)

  return (
    <PayrollDialog
      title="Salary Revision Edit"
      onClose={onClose}
      formId={formId}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
    >
      <div className="grid gap-8">
        <EmployeeCard profile={profileOf(revision)} />
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
          <ChangeFields form={form} previous={revision.previousAmount ?? 0} />
        </form>
      </div>
    </PayrollDialog>
  )
}

/** View: the person card, then Effective Date, Previous Salary, the change and Salary. */
export function SalaryRevisionViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const revision = useSalaryRevision(id)
  const data = revision.data
  return (
    <PayrollDialog title="Salary Revision View" onClose={onClose} readOnly>
      <div className="grid gap-8">
        <EmployeeCard profile={data ? profileOf(data) : undefined} />
        {data ? (
          <div className="grid gap-5">
            <ReadOnlyRow label="Effective Date" value={formatLong(data.effectiveDate)} />
            <ReadOnlyRow
              label="Previous Salary"
              value={data.previousAmount === null ? '—' : `RS ${formatAmount(data.previousAmount)}`}
            />
            <ReadOnlyRow
              label="Change"
              value={
                data.changeValue === null
                  ? '—'
                  : data.changeType === 'percent'
                    ? `${formatAmount(data.changeValue)}%`
                    : `RS ${formatAmount(data.changeValue)}`
              }
            />
            <ReadOnlyRow label="Salary" value={`RS ${formatAmount(data.amount)}`} />
            <ReadOnlyRow label="Source" value={data.source ?? '—'} />
          </div>
        ) : (
          <Skeleton className="h-36 w-full" />
        )}
      </div>
    </PayrollDialog>
  )
}
