import { type SyntheticEvent, useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, SelectField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { ENCASHMENT_BASIS_LABELS } from '../../constants'
import {
  useLeaveEncashment,
  useLeaveTypeLookup,
  usePayrollSettings,
  useSaveLeaveEncashment,
} from '../../hooks/use-payroll'
import { personHint, usePayrollOptions } from '../../hooks/use-payroll-records'
import {
  ENCASHMENT_BASES,
  ENCASHMENT_TYPES,
  type LeaveEncashmentDetail,
} from '../../types/payroll.types'
import { formatRs } from '../../utils/format'
import { currentLeaveYear } from '../../utils/leave-year'
import { RsField } from '../balances/list-parts'
import { EmployeeMultiSearchSelectField } from '../shared/employee-search-select'
import { PayrollDialog } from '../shared/payroll-dialog'
import { TwoWaySwitchField } from '../shared/two-way-switch'
import { YearField } from '../shared/year-picker'

const schema = z
  .object({
    leaveTypeId: z.string().min(1, 'Choose the leave type'),
    allEmployees: z.boolean(),
    employeeIds: z.array(z.string()),
    year: z.string().min(1, 'Choose the year'),
    mode: z.enum(ENCASHMENT_TYPES),
    basis: z.enum(ENCASHMENT_BASES),
    amountPerLeave: z.string(),
  })
  .refine((value) => value.allEmployees || value.employeeIds.length > 0, {
    message: 'Choose the employees',
    path: ['employeeIds'],
  })
  .refine(
    (value) =>
      value.basis === 'earned_salary' || Number(value.amountPerLeave.replace(/,/g, '')) > 0,
    { message: 'Enter the amount per leave for this basis', path: ['amountPerLeave'] },
  )
type Values = z.infer<typeof schema>

const toValues = (detail: LeaveEncashmentDetail | undefined): Values => ({
  leaveTypeId: detail?.leaveTypeId ?? '',
  allEmployees: detail?.appliesToAll ?? false,
  employeeIds: detail ? detail.employees.map((line) => line.employeeId) : [],
  year: detail ? String(detail.fiscalYear) : '',
  mode: detail?.mode ?? 'payroll',
  basis: detail?.basis ?? 'earned_salary',
  amountPerLeave: detail && detail.basis !== 'earned_salary' ? String(detail.amountPerLeave) : '',
})

type Mode = 'create' | 'edit' | 'view'

const TITLES: Record<Mode, string> = {
  create: 'Leave Encashment Create',
  edit: 'Leave Encashment Edit',
  view: 'Leave Encashment View',
}

const FIELDS = ['leaveTypeId', 'employeeIds', 'amountPerLeave'] as const

/** View draws its drop-downs and the year as grey boxes, not faded white ones. */
const viewFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted',
)

/**
 * "Leave Encashment Create" / Edit / View (`/payroll/leave-encashments`): Leave Type, All
 * Employees (or the chosen Employees), Year, Type Payroll (next monthly run) or Manually, and the
 * "Amount Per Leave" basis: Earned Salary is a day's salary; other bases need the amount.
 */
export function LeaveEncashmentDialog({
  id,
  mode,
  onClose,
}: {
  id: string | null
  mode: Mode
  onClose: () => void
}) {
  const encashment = useLeaveEncashment(id)
  if (id && !encashment.data) {
    return (
      <PayrollDialog title={TITLES[mode]} onClose={onClose} readOnly className="max-w-3xl">
        <Skeleton className="h-64 w-full" />
      </PayrollDialog>
    )
  }
  return <EncashmentForm detail={encashment.data} mode={mode} onClose={onClose} />
}

function EncashmentForm({
  detail,
  mode,
  onClose,
}: {
  detail: LeaveEncashmentDetail | undefined
  mode: Mode
  onClose: () => void
}) {
  const formId = useId()
  const options = usePayrollOptions('payroll.leave_encashment.view')
  const leaveTypes = useLeaveTypeLookup()
  const settings = usePayrollSettings()
  const save = useSaveLeaveEncashment()
  // Paid in a released pay slip: it can only be looked at.
  const locked = mode === 'edit' && detail?.isPaid === true
  const readOnly = mode === 'view' || locked
  const creating = mode === 'create'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(detail) })
  const [allEmployees, basis] = useWatch({ control: form.control, name: ['allEmployees', 'basis'] })
  const leaveOptions = (leaveTypes.data ?? []).map((item) => ({ value: item.id, label: item.name }))
  if (detail && !leaveOptions.some((item) => item.value === detail.leaveTypeId)) {
    leaveOptions.push({ value: detail.leaveTypeId, label: detail.leaveTypeName })
  }
  // The encashment's people keep their names until the picker has read them.
  const knownPeople = (detail?.employees ?? []).map((line) => ({
    value: line.employeeId,
    label: line.employeeName,
  }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: detail?.id,
        input: {
          leaveTypeId: values.leaveTypeId,
          fiscalYear: Number(values.year),
          allEmployees: values.allEmployees,
          employeeIds: values.allEmployees ? [] : values.employeeIds,
          mode: values.mode,
          basis: values.basis,
          amountPerLeave:
            values.basis === 'earned_salary' && values.amountPerLeave.trim() === ''
              ? null
              : Number(values.amountPerLeave.replace(/,/g, '')),
          ...(detail ? { rowVersion: detail.rowVersion } : {}),
        },
      })
      onClose()
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELDS.find((name) => error.fieldErrors[name]) : undefined
      if (error instanceof ApiError && field) {
        form.setError(field, { message: error.fieldErrors[field] })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the encashment.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={
        locked
          ? 'This encashment was paid in a released pay slip and cannot be changed.'
          : form.formState.errors.root?.message
      }
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn('grid gap-5', readOnly && viewFieldsClass)}
      >
        <SelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          placeholder="Select Leave Type"
          options={leaveOptions}
          required={creating}
          disabled={readOnly}
        />
        <CheckboxField
          control={form.control}
          name="allEmployees"
          label="All Employees"
          tone="violet"
          disabled={readOnly}
        />
        {!allEmployees && (
          <EmployeeMultiSearchSelectField
            control={form.control}
            name="employeeIds"
            label="Employees"
            placeholder="Select Employees"
            filters={creating ? options.activeEmployeeFilters : options.employeeFilters}
            known={knownPeople}
            hint={personHint}
            required={creating}
            disabled={readOnly}
          />
        )}
        <YearField
          control={form.control}
          name="year"
          label="Year"
          required={creating}
          disabled={readOnly}
          max={currentLeaveYear(settings.data)}
        />
        <TwoWaySwitchField
          control={form.control}
          name="mode"
          label="Type"
          ariaLabel="Type"
          options={[
            { value: 'payroll', label: 'Payroll' },
            { value: 'manual', label: 'Manually' },
          ]}
          disabled={readOnly}
        />
        <SelectField
          control={form.control}
          name="basis"
          label="Amount Per Leave"
          options={ENCASHMENT_BASES.map((value) => ({
            value,
            label: ENCASHMENT_BASIS_LABELS[value],
          }))}
          disabled={readOnly}
        />
        {basis !== 'earned_salary' && (
          <RsField
            control={form.control}
            name="amountPerLeave"
            label="Amount"
            required
            readOnly={readOnly}
          />
        )}
        {detail && (
          <p className="text-sm text-muted-foreground">
            {detail.employees.length === 1
              ? '1 person'
              : `${String(detail.employees.length)} people`}
            , {String(detail.totalDays ?? 0)} days, {formatRs(detail.totalAmount ?? 0)} in all.
          </p>
        )}
      </form>
    </PayrollDialog>
  )
}
