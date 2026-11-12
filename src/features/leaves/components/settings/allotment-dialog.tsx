import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { SelectField, TextField } from '@/components/form'
import { EmployeeSearchSelectField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import { LEAVE_CODES } from '../../constants'
import {
  useAllLeaveTypes,
  useProcessAllotment,
  useProcessCarryForward,
} from '../../hooks/use-leaves'
import { balanceDays } from '../../utils/format'

const RUNS = {
  allotment: 'Allot leave for the year',
  carry: 'Carry forward to the next year',
} as const

const EMPLOYEE_FILTERS = { permission: LEAVE_CODES.allotment }

const schema = z.object({
  run: z.enum(['allotment', 'carry']),
  fiscalYear: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100,
      'Enter a year from 2000 to 2100',
    ),
  leaveTypeId: z.string().nullable(),
  employeeId: z.string().nullable(),
})
type Values = z.infer<typeof schema>

/** Why one person can get nothing from a run (the backend's rules, `lv.usp_leave_allotment_process`). */
const NOTHING_FOR_ONE =
  'already has this year’s leave, or no leave type applies to them: check their leave policy, and the leave types’ gender, marital status and probation rules.'

/**
 * "Allotment" (no frame; the backend's runs): allots each active Auto Allotment type to the
 * people its policies cover for a leave year (`POST /leaves/allotment/process`, idempotent, so
 * it is safe to run again: people already allotted are skipped and new joiners get theirs;
 * earned balances are topped up to today), or carries the year's unused days into the next
 * one (`POST /leaves/carry-forward/process`). Both run for everyone, or for one employee.
 * Without a run nobody has a balance to apply against.
 *
 * From an employee's profile it opens with `employee` fixed (Allot Leave), and `defaultYear`
 * as their current leave year (the company's fiscal year may not start in January).
 */
export function AllotmentDialog({
  onClose,
  employee,
  defaultYear,
}: {
  onClose: () => void
  employee?: { id: string; name: string } | undefined
  defaultYear?: number | undefined
}) {
  const formId = useId()
  const types = useAllLeaveTypes()
  const allot = useProcessAllotment()
  const carry = useProcessCarryForward()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      run: 'allotment',
      fiscalYear: String(defaultYear ?? new Date().getFullYear()),
      leaveTypeId: null,
      employeeId: employee?.id ?? null,
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const year = Number(values.fiscalYear)
    const forOne = values.employeeId !== null
    try {
      if (values.run === 'allotment') {
        const result = await allot.mutateAsync({
          fiscalYear: year,
          leaveTypeId: values.leaveTypeId,
          employeeId: values.employeeId,
        })
        if (forOne && result.allotted === 0 && result.earned === 0) {
          toast.info(
            `Nothing to allot for ${String(result.fiscalYear)}: ${employee?.name ?? 'this employee'} ${NOTHING_FOR_ONE}`,
          )
        } else {
          toast.success(
            `Allotted ${String(result.allotted)} balance${result.allotted === 1 ? '' : 's'} and ${String(result.earned)} earned (${balanceDays(result.days)} days) for ${String(result.fiscalYear)}`,
          )
        }
      } else {
        const result = await carry.mutateAsync({
          fromFiscalYear: year,
          leaveTypeId: values.leaveTypeId,
          employeeId: values.employeeId,
        })
        toast.success(
          `Carried ${balanceDays(result.days)} days for ${String(result.carried)} balance${result.carried === 1 ? '' : 's'} from ${String(result.fromFiscalYear)}`,
        )
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        const yearError = failure.fieldErrors.fiscalYear ?? failure.fieldErrors.fromFiscalYear
        if (yearError) form.setError('fiscalYear', { message: yearError })
        else if (failure.fieldErrors.employeeId) {
          form.setError('employeeId', { message: failure.fieldErrors.employeeId })
        } else form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  return (
    <PayrollDialog
      title={employee ? `Allot Leave · ${employee.name}` : 'Allotment'}
      onClose={onClose}
      formId={formId}
      saveLabel="Run"
      pending={allot.isPending || carry.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-2xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        <SelectField
          control={form.control}
          name="run"
          label="Run"
          required
          options={(Object.keys(RUNS) as (keyof typeof RUNS)[]).map((value) => ({
            value,
            label: RUNS[value],
          }))}
        />
        <TextField
          control={form.control}
          name="fiscalYear"
          label="Leave Year"
          required
          inputMode="numeric"
          maxLength={4}
          description="The year the leave year starts in (the company's fiscal year)."
        />
        {!employee && (
          <EmployeeSearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee"
            placeholder="Everyone"
            clearable
            filters={EMPLOYEE_FILTERS}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="leaveTypeId"
          label="Leave Type"
          placeholder="Every leave type"
          clearable
          options={(types.data?.data ?? []).map((type) => ({
            value: type.id,
            label: type.title,
            hint: type.shortCode,
          }))}
        />
        <p className="text-xs text-muted-foreground">
          Safe to run again: leave already given is never given twice, so new employees get theirs
          and nobody else changes. On Pro Rated leave types, people who joined during the year get
          the months left in it.
        </p>
      </form>
    </PayrollDialog>
  )
}
