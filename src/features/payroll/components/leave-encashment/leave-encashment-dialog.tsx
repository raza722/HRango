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
  usePayrollSettings,
  useSaveLeaveEncashment,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import {
  ENCASHMENT_BASES,
  ENCASHMENT_TYPES,
  type LeaveEncashmentDetail,
} from '../../types/payroll.types'
import { formatMonth } from '../../utils/format'
import { currentLeaveYear } from '../../utils/leave-year'
import { MultiSearchSelectField } from '../shared/multi-search-select'
import { PayrollDialog } from '../shared/payroll-dialog'
import { TwoWaySwitchField } from '../shared/two-way-switch'
import { YearField } from '../shared/year-picker'

const schema = z
  .object({
    leaveTypeId: z.string().min(1, 'Choose the leave type'),
    allEmployees: z.boolean(),
    employeeIds: z.array(z.string()),
    year: z.string().min(1, 'Choose the year'),
    type: z.enum(ENCASHMENT_TYPES),
    basis: z.enum(ENCASHMENT_BASES),
  })
  .refine((value) => value.allEmployees || value.employeeIds.length > 0, {
    message: 'Choose the employees',
    path: ['employeeIds'],
  })
type Values = z.infer<typeof schema>

const toValues = (detail: LeaveEncashmentDetail | undefined): Values => ({
  leaveTypeId: detail?.leaveTypeId ?? '',
  allEmployees: detail?.allEmployees ?? false,
  employeeIds: detail?.employeeIds ?? [],
  year: detail ? String(detail.year) : '',
  type: detail?.type ?? 'payroll',
  basis: detail?.basis ?? 'overtime',
})

type Mode = 'create' | 'edit' | 'view'

const TITLES: Record<Mode, string> = {
  create: 'Leave Encashment Create',
  edit: 'Leave Encashment Edit',
  view: 'Leave Encashment View',
}

const FIELDS = ['leaveTypeId', 'employeeIds', 'year', 'basis'] as const

/** View draws its drop-downs and the year as grey boxes, not faded white ones. */
const viewFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted',
)

/**
 * "Leave Encashment Create" / Edit / View: Leave Type, All Employees (or the
 * chosen Employees), Year, and Type Payroll or Manually; Manually adds the
 * "Amount Per Leave" basis.
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
  const options = usePayrollOptions()
  const settings = usePayrollSettings()
  const save = useSaveLeaveEncashment()
  // A payroll encashment in a released pay slip can only be looked at.
  const locked = mode === 'edit' && detail?.paid === true
  const readOnly = mode === 'view' || locked
  const creating = mode === 'create'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(detail) })
  const [allEmployees, type] = useWatch({ control: form.control, name: ['allEmployees', 'type'] })
  const leaveTypes = (options.lookups?.accountTypes ?? [])
    .filter((item) => item.category === 'leave-quotas')
    .map((item) => ({ value: item.id, label: item.name }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: detail?.id,
        input: {
          leaveTypeId: values.leaveTypeId,
          allEmployees: values.allEmployees,
          employeeIds: values.allEmployees ? [] : values.employeeIds,
          year: Number(values.year),
          type: values.type,
          basis: values.type === 'manual' ? values.basis : null,
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
          ? `This encashment was paid in the ${formatMonth(detail.payMonth)} payroll and cannot be changed.`
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
          options={leaveTypes}
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
          <MultiSearchSelectField
            control={form.control}
            name="employeeIds"
            label="Employees"
            placeholder="Select Employees"
            options={creating ? options.activeEmployees : options.employees}
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
          max={currentLeaveYear(settings.data?.leave)}
        />
        <TwoWaySwitchField
          control={form.control}
          name="type"
          label="Type"
          ariaLabel="Type"
          options={[
            { value: 'payroll', label: 'Payroll' },
            { value: 'manual', label: 'Manually' },
          ]}
          disabled={readOnly}
        />
        {type === 'manual' && (
          <SelectField
            control={form.control}
            name="basis"
            label="Amount Per Leave"
            options={ENCASHMENT_BASES.map((basis) => ({
              value: basis,
              label: ENCASHMENT_BASIS_LABELS[basis],
            }))}
            disabled={readOnly}
          />
        )}
      </form>
    </PayrollDialog>
  )
}
