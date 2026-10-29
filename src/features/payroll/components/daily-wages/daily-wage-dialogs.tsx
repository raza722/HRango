import { type SyntheticEvent, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { FieldLayoutContext, TextField } from '@/components/form'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAYSLIP_STATUS_META, VOUCHER_STATUS_LABELS } from '../../constants'
import {
  useCreateDailyWage,
  useDailyWage,
  useDailyWageErrors,
  useDailyWageVouchers,
  useSetDailyWageEmployees,
  useTimeSlotLookup,
  useUpdateDailyWage,
} from '../../hooks/use-payroll'
import { personHint } from '../../hooks/use-payroll-records'
import type { DailyWageDetail } from '../../types/payroll.types'
import { amountInWords, clock, formatAmount, formatLong, formatRs, hours } from '../../utils/format'
import {
  btn,
  dialogFieldType,
  footerButton,
  payrollTableClass,
  personNameText,
} from '../../utils/styles'
import { RsInput, SectionTitle } from '../balances/list-parts'
import { RunErrorsTable } from '../monthly/payroll-dialogs'
import { DateField } from '../shared/date-input'
import { EmployeeMultiSearchSelect } from '../shared/employee-search-select'
import { NoRecord } from '../shared/no-record'
import { SearchSelectField } from '../shared/search-select'
import { downloadDailyWage, timeSlotLabel } from './daily-wage-csv'

/** The Edit dialog's values and the Create form's required mark, as Daily Wages draws them. */
const editValue = 'font-inter text-sm text-grey sm:text-base'
const createType = cn(
  dialogFieldType,
  '[&_[data-slot=label]_[aria-hidden=true]]:text-xl [&_[data-slot=label]_[aria-hidden=true]]:font-medium',
)
/** "RS" in the Edit rows: Inter Medium 16 #000000. */
const editPrefix = 'text-base font-medium text-heading sm:text-base'
/** Details table: Inter Medium 14 #000000 headings, Inter Regular 14 #000000 cells. */
const detailsTable = '[&_td]:font-inter [&_td]:text-heading [&_th]:font-inter [&_th]:text-heading'

const failure = (reason: unknown, fallback: string) =>
  reason instanceof ApiError ? reason.message : fallback

/** The wizard's two progress bars: green once a step is reached. */
function Steps({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`Step ${step} of 2`} role="img">
      <span className="h-1.5 w-12 rounded-full bg-[#2CBD4D]" />
      <span
        className={cn('h-1.5 w-12 rounded-full', step === 2 ? 'bg-[#2CBD4D]' : 'bg-[#D9D9D9]')}
      />
    </div>
  )
}

const stepOneSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(200, 'Keep it under 200 characters'),
  workDate: z.string().min(1, 'Choose the date'),
  timeSlotId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the time slot' }),
})
type StepOne = z.infer<typeof stepOneSchema>

/**
 * "Create" in Payrolls Daily Wages (`POST /daily-wages`): step 1 Name, Date and Time Slot
 * (Next), step 2 "Select Employee" (Save). Wages are worked out on Process.
 */
export function DailyWageCreateDialog({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const slots = useTimeSlotLookup()
  const create = useCreateDailyWage()
  const [step, setStep] = useState<1 | 2>(1)
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const form = useForm<StepOne>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: { name: '', workDate: '', timeSlotId: null },
  })

  const next = form.handleSubmit(() => {
    setStep(2)
  })

  const save = async () => {
    if (employeeIds.length === 0) {
      setError('Select at least one employee.')
      return
    }
    const values = form.getValues()
    setError(null)
    try {
      await create.mutateAsync({
        name: values.name.trim(),
        workDate: values.workDate,
        timeSlotId: values.timeSlotId ?? '',
        employeeIds,
      })
      onClose()
    } catch (reason) {
      setError(failure(reason, 'Could not create the payroll.'))
    }
  }

  return (
    <AppDialog
      title={step === 1 ? 'Create Daily Wage Payroll' : 'Select Employee'}
      hideTitle={step === 1}
      onRequestClose={onClose}
      className={step === 1 ? cn('max-w-3xl', createType) : 'max-w-3xl'}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {error}
            </p>
          )}
          {step === 1 ? (
            <Button type="submit" form={formId} className={cn(footerButton, btn.purple)}>
              Next
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1)
                }}
                className={footerButton}
              >
                Back
              </Button>
              <Button
                onClick={() => void save()}
                disabled={create.isPending}
                className={cn(footerButton, btn.green)}
              >
                Save
              </Button>
            </>
          )}
          <Button onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-6">
        <Steps step={step} />
        {step === 1 ? (
          <FieldLayoutContext value="horizontal">
            <form
              id={formId}
              noValidate
              onSubmit={(event: SyntheticEvent) => void next(event)}
              className="grid gap-5"
            >
              <TextField
                control={form.control}
                name="name"
                label="Name"
                placeholder="Name"
                required
              />
              <DateField
                control={form.control}
                name="workDate"
                label="Date"
                required
                maxDate={new Date()}
              />
              <SearchSelectField
                control={form.control}
                name="timeSlotId"
                label="Time Slot"
                placeholder="Select Time Slot"
                options={(slots.data ?? []).map((slot) => ({
                  value: slot.id,
                  label: timeSlotLabel(slot),
                }))}
                required
              />
            </form>
          </FieldLayoutContext>
        ) : (
          <div className="grid gap-2">
            <EmployeeMultiSearchSelect
              aria-label="Employees"
              value={employeeIds}
              onChange={(ids) => {
                setEmployeeIds(ids)
                setError(null)
              }}
              filters={{ permission: 'payroll.daily_wages.create' }}
              hint={personHint}
              placeholder="Select Employees"
            />
            <p className="text-xs text-muted-foreground">{employeeIds.length} selected</p>
          </div>
        )}
      </div>
    </AppDialog>
  )
}

/** "Employees" of a daily-wage run (`PUT /daily-wages/{id}/employees`), before it is closed. */
export function DailyWageEmployeesDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useDailyWage(id)
  return detail.data ? (
    <EmployeesForm detail={detail.data} onClose={onClose} />
  ) : (
    <AppDialog title="Employees" onRequestClose={onClose} className="max-w-3xl">
      <Skeleton className="h-24 w-full" />
    </AppDialog>
  )
}

function EmployeesForm({ detail, onClose }: { detail: DailyWageDetail; onClose: () => void }) {
  const save = useSetDailyWageEmployees()
  const [ids, setIds] = useState(() => detail.rows.map((row) => row.employeeId))
  const [error, setError] = useState<string | null>(null)
  return (
    <AppDialog
      title="Employees"
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={save.isPending}
            onClick={() => {
              setError(null)
              save.mutate(
                { id: detail.id, employeeIds: ids },
                {
                  onSuccess: onClose,
                  onError: (reason) => {
                    setError(failure(reason, 'The employees could not be saved.'))
                  },
                },
              )
            }}
            className={cn(footerButton, btn.green)}
          >
            Save
          </Button>
          <Button onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <EmployeeMultiSearchSelect
        aria-label="Employees"
        value={ids}
        onChange={setIds}
        filters={{ permission: 'payroll.daily_wages.edit' }}
        known={detail.rows.map((row) => ({
          value: row.employeeId,
          label: row.employeeName,
          hint: row.employeeCode,
        }))}
        hint={personHint}
        placeholder="Select Employees"
      />
    </AppDialog>
  )
}

/**
 * "Daily Wage Payroll Edit" (`PUT /daily-wages/{id}`): the name, then per person earnings and
 * deductions (wage slips must have been processed). The wage itself is not editable on the API.
 */
export function DailyWageEditDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useDailyWage(id)
  return detail.data ? (
    <EditForm detail={detail.data} onClose={onClose} />
  ) : (
    <AppDialog title="Daily Wage Payroll Edit" onRequestClose={onClose} className="max-w-4xl">
      <Skeleton className="h-40 w-full" />
    </AppDialog>
  )
}

function EditForm({ detail, onClose }: { detail: DailyWageDetail; onClose: () => void }) {
  const nameId = useId()
  const update = useUpdateDailyWage()
  const [name, setName] = useState(detail.name)
  const [rows, setRows] = useState(() =>
    detail.rows
      .filter((row) => row.payslipId !== null)
      .map((row) => ({
        employeeId: row.employeeId,
        name: row.employeeName,
        totalEarnings: String(row.totalEarnings ?? 0),
        totalDeductions: String(row.totalDeductions ?? 0),
      })),
  )
  const [error, setError] = useState<string | null>(null)

  const set = (index: number, key: 'totalEarnings' | 'totalDeductions', value: string) => {
    setRows((current) => current.map((row, at) => (at === index ? { ...row, [key]: value } : row)))
    setError(null)
  }

  const save = async () => {
    if (!name.trim()) {
      setError('Enter a name.')
      return
    }
    const parsed = rows.map((row) => ({
      employeeId: row.employeeId,
      totalEarnings: Number(row.totalEarnings.replace(/,/g, '')),
      totalDeductions: Number(row.totalDeductions.replace(/,/g, '')),
    }))
    if (
      parsed.some((row) =>
        [row.totalEarnings, row.totalDeductions].some(
          (value) => !Number.isFinite(value) || value < 0,
        ),
      )
    ) {
      setError('Amounts must be numbers of 0 or more.')
      return
    }
    try {
      await update.mutateAsync({
        id: detail.id,
        input: { name: name.trim(), rows: parsed, rowVersion: detail.rowVersion },
      })
      onClose()
    } catch (reason) {
      setError(failure(reason, 'Could not save the payroll.'))
    }
  }

  return (
    <AppDialog
      title="Daily Wage Payroll Edit"
      onRequestClose={onClose}
      className="max-w-4xl"
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            onClick={() => void save()}
            disabled={update.isPending}
            className={cn(footerButton, btn.green)}
          >
            Save
          </Button>
          <Button onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-6">
        <div className="grid gap-2 @xl:grid-cols-[8rem_minmax(0,1fr)] @xl:items-center">
          <label htmlFor={nameId} className="font-inter text-sm text-heading sm:text-base">
            Name
          </label>
          <Input
            id={nameId}
            className={editValue}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
          />
        </div>
        <SectionTitle>Details</SectionTitle>
        {rows.length === 0 ? (
          <NoRecord>Process the payroll first: there are no wage slips to edit yet.</NoRecord>
        ) : (
          <div className="grid gap-3">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,1fr))] gap-4 font-inter text-sm font-medium text-heading sm:text-base @3xl:grid">
              <span>Employee Name</span>
              <span>Total Earnings</span>
              <span>Total Deductions</span>
            </div>
            {rows.map((row, index) => (
              <div
                key={row.employeeId}
                className="grid gap-3 rounded-md border p-3 @3xl:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,1fr))] @3xl:gap-4 @3xl:border-0 @3xl:p-0"
              >
                <Input
                  value={row.name}
                  readOnly
                  aria-label="Employee Name"
                  className={cn('bg-card', editValue)}
                />
                <RsInput
                  aria-label={`Total Earnings, ${row.name}`}
                  value={row.totalEarnings}
                  onChange={(value) => {
                    set(index, 'totalEarnings', value)
                  }}
                  prefixClassName={editPrefix}
                  inputClassName={editValue}
                />
                <RsInput
                  aria-label={`Total Deductions, ${row.name}`}
                  value={row.totalDeductions}
                  onChange={(value) => {
                    set(index, 'totalDeductions', value)
                  }}
                  prefixClassName={editPrefix}
                  inputClassName={editValue}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppDialog>
  )
}

/** "Errors" of a daily-wage run (`GET /daily-wages/{id}/errors`). */
export function DailyWageErrorsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const errors = useDailyWageErrors(id)
  const entries = errors.data ?? []
  return (
    <AppDialog
      title="Daily Wage Errors"
      onRequestClose={onClose}
      className="max-w-4xl"
      footer={
        <Button onClick={onClose} className={cn(footerButton, btn.red)}>
          Cancel
        </Button>
      }
    >
      {errors.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : entries.length === 0 ? (
        <NoRecord />
      ) : (
        <RunErrorsTable caption="Errors of the daily wage run" entries={entries} />
      )}
    </AppDialog>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 font-inter text-sm text-heading sm:grid-cols-[10rem_minmax(0,1fr)] sm:text-base">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * "Daily Wages Details" (`GET /daily-wages/{id}`): the run's facts, then each person's check
 * in, check out, wage, hours, earnings, deductions, net pay and voucher; Back, Voucher (a
 * closed run: `POST /daily-wages/{id}/vouchers`) and Download Excel.
 */
export function DailyWageDetailsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useDailyWage(id)
  const vouchers = useDailyWageVouchers()
  const canVoucher = useCan('payroll.vouchers.create')
  const [error, setError] = useState<string | null>(null)
  const data = detail.data
  // People with pay and no voucher yet; once everyone has one, Voucher has nothing left to do.
  const due = (data?.rows ?? []).filter((row) => row.payslipId && row.netPayable && !row.voucherId)
  const made = (data?.rows ?? []).filter((row) => row.voucherId).length
  const voucherNote =
    data?.status !== 'closed'
      ? null
      : due.length === 0
        ? made > 0
          ? `Vouchers made for everyone (${String(made)}). See them on Vouchers.`
          : 'Nobody on this payroll has an amount to pay.'
        : made > 0
          ? `${String(made)} made; Voucher makes the other ${String(due.length)}.`
          : null
  return (
    <AppDialog
      title={
        <span className="grid gap-2">
          <span>Daily Wages Details</span>
          <span className="text-base font-medium text-heading">Daily Wage Payroll</span>
        </span>
      }
      onRequestClose={onClose}
      className="max-w-5xl"
      footer={
        <>
          {error ? (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {error}
            </p>
          ) : (
            canVoucher &&
            voucherNote && (
              <p
                id={`${id}-voucher-note`}
                role="status"
                className="mr-auto self-center text-sm text-muted-foreground"
              >
                {voucherNote}
              </p>
            )
          )}
          <Button onClick={onClose} className={cn(footerButton, btn.orange)}>
            Back
          </Button>
          {canVoucher && data?.status === 'closed' && (
            <Button
              disabled={vouchers.isPending || due.length === 0}
              aria-describedby={voucherNote ? `${id}-voucher-note` : undefined}
              onClick={() => {
                setError(null)
                vouchers.mutate(id, {
                  onError: (reason) => {
                    setError(failure(reason, 'The vouchers could not be created.'))
                  },
                })
              }}
              className={cn(footerButton, btn.purple)}
            >
              Voucher
            </Button>
          )}
          <Button
            disabled={!data}
            onClick={() => {
              if (data) downloadDailyWage(data)
            }}
            className={cn(footerButton, btn.green)}
          >
            Download Excel
          </Button>
        </>
      }
    >
      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-6">
          <dl className="grid gap-x-10 gap-y-4 border-t pt-6 @2xl:grid-cols-2">
            <Fact label="Name" value={data.name} />
            <Fact label="Time Slot" value={data.timeSlotName ?? '—'} />
            <Fact label="Date" value={data.workDate ? formatLong(data.workDate) : '—'} />
            <Fact label="Total Employees" value={String(data.employeeCount)} />
            <Fact label="Net Payable" value={formatAmount(data.netPayable)} />
            <Fact label="In words" value={amountInWords(data.netPayable)} />
          </dl>
          <SectionTitle>Details</SectionTitle>
          {data.rows.length === 0 ? (
            <NoRecord />
          ) : (
            <div className="overflow-x-auto">
              <table
                className={cn('w-full min-w-[60rem] text-left', payrollTableClass, detailsTable)}
              >
                <caption className="sr-only">Daily wage details</caption>
                <thead>
                  <tr>
                    {[
                      'Employee',
                      'Check In',
                      'Check Out',
                      'Wage',
                      'Worked Hours',
                      'Expected Hours',
                      'Total Earnings',
                      'Total Deductions',
                      'Net Payable',
                      'Slip',
                      'Voucher',
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.employeeId}>
                      <td>
                        <span className="flex items-center gap-2">
                          <EmployeeAvatar
                            name={row.employeeName}
                            photoUrl={null}
                            className="size-6"
                          />
                          <span className={cn('font-sans', personNameText)}>
                            {row.employeeName}
                          </span>
                        </span>
                      </td>
                      <td>{row.checkIn ? clock(row.checkIn) : '—'}</td>
                      <td>{row.checkOut ? clock(row.checkOut) : '—'}</td>
                      <td>{row.wage === null ? '—' : formatRs(row.wage)}</td>
                      <td>{row.workedMinutes === null ? '—' : hours(row.workedMinutes)}</td>
                      <td>{hours(row.expectedMinutes)}</td>
                      <td>{row.totalEarnings === null ? '—' : formatRs(row.totalEarnings)}</td>
                      <td>{row.totalDeductions === null ? '—' : formatRs(row.totalDeductions)}</td>
                      <td>{row.netPayable === null ? '—' : formatRs(row.netPayable)}</td>
                      <td>
                        {row.payslipStatus ? PAYSLIP_STATUS_META[row.payslipStatus].label : '—'}
                      </td>
                      <td>
                        {row.voucherNo
                          ? `${row.voucherNo}${row.voucherStatus ? ` (${VOUCHER_STATUS_LABELS[row.voucherStatus]})` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppDialog>
  )
}
