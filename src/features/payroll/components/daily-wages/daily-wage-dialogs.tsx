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
import { EmployeeSelector } from '@/features/scheduling'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useCreateDailyWage,
  useDailyWage,
  useDailyWageVouchers,
  useUpdateDailyWage,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { DailyWageDetail } from '../../types/payroll.types'
import {
  amountInWords,
  clock,
  formatAmount,
  formatLong,
  formatRs,
  hours,
  slotLabel,
} from '../../utils/format'
import {
  btn,
  dialogFieldType,
  footerButton,
  payrollTableClass,
  personNameText,
} from '../../utils/styles'
import { RsInput, SectionTitle } from '../balances/list-parts'
import { DateField } from '../shared/date-input'
import { NoRecord } from '../shared/no-record'
import { SearchSelectField } from '../shared/search-select'
import { downloadDailyWage } from './daily-wage-csv'

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
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters'),
  date: z.string().min(1, 'Choose the date'),
  timeSlotId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the time slot' }),
})
type StepOne = z.infer<typeof stepOneSchema>

/**
 * "Create" in Payrolls Daily Wages: step 1 Name, Date and Time Slot (Next),
 * step 2 "Select Employee" (Save).
 */
export function DailyWageCreateDialog({ onClose }: { onClose: () => void }) {
  const formId = useId()
  const options = usePayrollOptions()
  const create = useCreateDailyWage()
  const [step, setStep] = useState<1 | 2>(1)
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const form = useForm<StepOne>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: { name: '', date: '', timeSlotId: null },
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
        date: values.date,
        timeSlotId: values.timeSlotId ?? '',
        employeeIds,
      })
      onClose()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not create the payroll.')
    }
  }

  return (
    <AppDialog
      title={step === 1 ? 'Create Daily Wage Payroll' : 'Select Employee'}
      hideTitle={step === 1}
      onRequestClose={onClose}
      className={step === 1 ? cn('max-w-3xl', createType) : 'max-w-5xl'}
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
                name="date"
                label="Date"
                required
                maxDate={new Date()}
              />
              <SearchSelectField
                control={form.control}
                name="timeSlotId"
                label="Time Slot"
                placeholder="Select Time Slot"
                options={options.timeSlots.map((slot) => ({
                  value: slot.id,
                  label: slotLabel(slot),
                }))}
                required
              />
            </form>
          </FieldLayoutContext>
        ) : (
          <EmployeeSelector
            value={employeeIds}
            onChange={(ids) => {
              setEmployeeIds(ids)
              setError(null)
            }}
            filters={['employee', 'location', 'branch', 'department', 'grade', 'group']}
          />
        )}
      </div>
    </AppDialog>
  )
}

/** "Daily Wage Payroll Edit": the name, then per person earnings, deductions and wage. */
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
    detail.rows.map((row) => ({
      employeeId: row.employee.id,
      name: row.employee.name,
      totalEarnings: String(row.totalEarnings),
      totalDeductions: String(row.totalDeductions),
      wage: String(row.wage),
    })),
  )
  const [error, setError] = useState<string | null>(null)

  const set = (index: number, key: 'totalEarnings' | 'totalDeductions' | 'wage', value: string) => {
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
      wage: Number(row.wage.replace(/,/g, '')),
    }))
    if (
      parsed.some((row) =>
        [row.totalEarnings, row.totalDeductions, row.wage].some(
          (value) => !Number.isFinite(value) || value < 0,
        ),
      )
    ) {
      setError('Amounts must be numbers of 0 or more.')
      return
    }
    try {
      await update.mutateAsync({ id: detail.id, input: { name: name.trim(), rows: parsed } })
      onClose()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not save the payroll.')
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
        <div className="grid gap-3">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] gap-4 font-inter text-sm font-medium text-heading sm:text-base @3xl:grid">
            <span>Employee Name</span>
            <span>Total Earnings</span>
            <span>Total Deductions</span>
            <span>Total Wage</span>
          </div>
          {rows.map((row, index) => (
            <div
              key={row.employeeId}
              className="grid gap-3 rounded-md border p-3 @3xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))] @3xl:gap-4 @3xl:border-0 @3xl:p-0"
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
              <RsInput
                aria-label={`Total Wage, ${row.name}`}
                value={row.wage}
                onChange={(value) => {
                  set(index, 'wage', value)
                }}
                prefixClassName={editPrefix}
                inputClassName={editValue}
              />
            </div>
          ))}
        </div>
      </div>
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
 * "Daily Wages Details": the batch's facts, then each person's check in,
 * check out, wage, hours, earnings, deductions and net pay; Back, Voucher
 * and Download Excel.
 */
export function DailyWageDetailsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useDailyWage(id)
  const vouchers = useDailyWageVouchers()
  const data = detail.data
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
          <Button onClick={onClose} className={cn(footerButton, btn.orange)}>
            Back
          </Button>
          <Button
            disabled={!data || vouchers.isPending}
            onClick={() => {
              vouchers.mutate(id)
            }}
            className={cn(footerButton, btn.purple)}
          >
            Voucher
          </Button>
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
            <Fact label="Time Slot" value={slotLabel(data.timeSlot)} />
            <Fact label="Date" value={formatLong(data.date)} />
            <Fact label="Total Employees" value={String(data.totalEmployees)} />
            <Fact label="Net Payable" value={formatAmount(data.netPayable)} />
            <Fact label="In words" value={amountInWords(data.netPayable)} />
          </dl>
          <SectionTitle>Details</SectionTitle>
          {data.rows.length === 0 ? (
            <NoRecord />
          ) : (
            <div className="overflow-x-auto">
              <table
                className={cn('w-full min-w-[56rem] text-left', payrollTableClass, detailsTable)}
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
                    ].map((label) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.employee.id}>
                      <td>
                        <span className="flex items-center gap-2">
                          <EmployeeAvatar
                            name={row.employee.name}
                            photoUrl={row.employee.photoUrl}
                            className="size-6"
                          />
                          <span className={cn('font-sans', personNameText)}>
                            {row.employee.name}
                          </span>
                        </span>
                      </td>
                      <td>{row.checkIn ? clock(row.checkIn) : '—'}</td>
                      <td>{row.checkOut ? clock(row.checkOut) : '—'}</td>
                      <td>{formatRs(row.wage)}</td>
                      <td>{row.workedMinutes === null ? '—' : hours(row.workedMinutes)}</td>
                      <td>{hours(row.expectedMinutes)}</td>
                      <td>{formatRs(row.totalEarnings)}</td>
                      <td>{formatRs(row.totalDeductions)}</td>
                      <td>{formatRs(row.netPayable)}</td>
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
