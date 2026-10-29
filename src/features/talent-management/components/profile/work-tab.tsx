import { type ComponentType, type SVGProps, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { SwitchField, TextField } from '@/components/form'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { PAYSLIP_STATUS_META, type PayslipRow } from '@/features/payroll'
import { type EngineRequest, STATUS_META } from '@/features/requests'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { TM_CODES } from '../../constants'
import { useDeleteChild, useEmployeeChildren, useSaveChild } from '../../hooks/use-employees'
import {
  type LoanDetails,
  thisMonth,
  useAttendanceMonth,
  useLoanRequests,
  usePayslipHistory,
} from '../../hooks/use-profile-related'
import {
  bankAccountFormSchema,
  type BankAccountFormValues,
  bankAccountToForm,
  bankAccountToInput,
  compactAccount,
} from '../../schemas/employee-forms.schema'
import type { BankAccount, Employee } from '../../types/employees.types'
import { showServerErrors } from '../../utils/form-errors'
import { formatAmount, formatDay, formatMonth } from '../../utils/format'
import {
  navySwitchClass,
  outlineButtonClass,
  sectionLinkClass,
  sectionTableClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { FormDialog } from '../shared/form-dialog'
import {
  Chip,
  ConfirmDelete,
  EditDeleteMenu,
  EmptyNote,
  LoadingRows,
  SectionCard,
} from '../shared/parts'
import { AbsentIcon, LeaveAwayIcon, PresentIcon } from '../talent-icons'

type LoanRow = EngineRequest<string, LoanDetails>

/** The small tables of the Work tab: columns from md (scrolling sideways if narrow), stacked below. */
function SmallTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  empty,
}: {
  caption: string
  columns: readonly DataTableColumn<T>[]
  rows: readonly T[]
  getRowId: (row: T) => string
  empty: string
}) {
  return (
    <div className="overflow-x-auto">
      <DataTable
        caption={caption}
        columns={columns}
        data={rows}
        getRowId={getRowId}
        className={cn(sectionTableClass, 'md:min-w-[28rem]')}
        emptyState={empty}
      />
    </div>
  )
}

/** Payroll History (2423:17204): Date, Generated Date, Net Salary, Status; View History. */
function PayrollHistory({ employee }: { employee: Employee }) {
  const slips = usePayslipHistory(employee.id)
  const columns: DataTableColumn<PayslipRow>[] = [
    { id: 'month', header: 'Date', cell: (row) => formatMonth(row.payslipMonth) },
    {
      id: 'generated',
      header: 'Generated Date',
      cell: (row) => formatDay(row.releasedAt ?? row.createdAt),
    },
    { id: 'net', header: 'Net Salary', cell: (row) => formatAmount(row.netPayable) },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.paidAt ? (
          <Chip meta={{ label: 'Paid', className: PAYSLIP_STATUS_META.released.className }} />
        ) : (
          <Chip meta={PAYSLIP_STATUS_META[row.status]} />
        ),
    },
  ]
  return (
    <SectionCard
      title="Payroll History"
      footer={
        <Link to="/payroll/pay-slips/all" className={sectionLinkClass}>
          View History
        </Link>
      }
    >
      {slips.isPending ? (
        <LoadingRows label="payroll history" />
      ) : slips.isError ? (
        <EmptyNote>The pay slips could not be loaded: {slips.error.message}</EmptyNote>
      ) : (
        <SmallTable
          caption="Payroll History"
          columns={columns}
          rows={slips.data.data}
          getRowId={(row) => row.id}
          empty="No pay slips yet."
        />
      )}
    </SectionCard>
  )
}

/** Loan Summary (2423:17204): Loan, Applied On, Reason, Amount, Loan Paid, Status; View More. */
function LoanSummary({ employee }: { employee: Employee }) {
  const loans = useLoanRequests(employee.id)
  // The API filters by person; keeping only theirs again is harmless.
  const rows = (loans.data?.data ?? []).filter((row) => row.employee.id === employee.id)
  const columns: DataTableColumn<LoanRow>[] = [
    { id: 'loan', header: 'Loan', cell: (row) => row.payload.loanTypeName ?? row.code },
    {
      id: 'applied',
      header: 'Applied On',
      cell: (row) => formatDay(row.submittedAt ?? row.createdAt),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'max-w-40 whitespace-normal',
      cell: (row) => (
        <span className="line-clamp-2" title={row.reason ?? undefined}>
          {row.reason ?? '—'}
        </span>
      ),
    },
    { id: 'amount', header: 'Amount', cell: (row) => formatAmount(row.payload.amountRequested) },
    {
      id: 'paid',
      header: 'Loan Paid',
      cell: (row) => formatAmount(row.payload.approvedAmount) || '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => {
        const meta = STATUS_META[row.status]
        return <Chip meta={row.status === 'completed' ? { ...meta, label: 'Approved' } : meta} />
      },
    },
  ]
  return (
    <SectionCard
      title="Loan Summary"
      footer={
        <Link to="/requests/$type" params={{ type: 'loan-advances' }} className={sectionLinkClass}>
          View More
        </Link>
      }
    >
      {loans.isPending ? (
        <LoadingRows label="loans" />
      ) : loans.isError ? (
        <EmptyNote>The loans could not be loaded: {loans.error.message}</EmptyNote>
      ) : (
        <SmallTable
          caption="Loan Summary"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          empty="No loan requests."
        />
      )}
    </SectionCard>
  )
}

/**
 * Performance Details (2423:17204): Name, Goal Name, Due Date, Status. The goals live in
 * Performance → Goals; View More opens this person's there.
 */
function PerformanceDetails({ employee }: { employee: Employee }) {
  return (
    <SectionCard
      title="Performance Details"
      footer={
        <Link
          to="/performance/goals"
          search={{ tab: 'all', employeeId: employee.id }}
          className={sectionLinkClass}
        >
          View More
        </Link>
      }
    >
      <SmallTable
        caption="Performance Details"
        columns={[
          { id: 'name', header: 'Name', cell: () => null },
          { id: 'goal', header: 'Goal Name', cell: () => null },
          { id: 'due', header: 'Due Date', cell: () => null },
          { id: 'status', header: 'Status', cell: () => null },
        ]}
        rows={[] as readonly never[]}
        getRowId={() => ''}
        empty="Goals are not shown on the profile. View More opens this person’s goals in Performance."
      />
    </SectionCard>
  )
}

const ATTENDANCE_TILES: readonly {
  key: 'present' | 'leave' | 'absent'
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  colour: string
}[] = [
  {
    key: 'present',
    label: 'Present',
    icon: PresentIcon,
    colour: 'border-[#096E38] bg-[#096E38]/10 text-[#096E38] dark:text-green-400',
  },
  {
    key: 'leave',
    label: 'Leave',
    icon: LeaveAwayIcon,
    colour: 'border-[#FE7F00] bg-[#FE7F00]/10 text-[#C25E00] dark:text-orange-300',
  },
  {
    key: 'absent',
    label: 'Absent',
    icon: AbsentIcon,
    colour: 'border-[#D33300] bg-[#D33300]/10 text-[#D33300] dark:text-red-300',
  },
]

/** Attendance (2423:17204): Present, Leave, Absent this month; View Attendance (time sheet). */
function AttendanceSummary({ employee }: { employee: Employee }) {
  const month = useAttendanceMonth(employee.id)
  const range = thisMonth()
  return (
    <SectionCard
      title="Attendance"
      footer={
        <Link
          to="/attendance/time-sheet"
          search={{ scope: 'all', employeeId: employee.id, from: range.from, to: range.to }}
          className={sectionLinkClass}
        >
          View Attendance
        </Link>
      }
    >
      <p className="-mt-2 mb-3 text-xs text-grey">This month</p>
      {month.isError ? (
        <EmptyNote>The attendance could not be loaded: {month.error.message}</EmptyNote>
      ) : (
        <ul aria-label="Attendance this month" className="grid grid-cols-3 gap-3">
          {ATTENDANCE_TILES.map((tile) => {
            const Icon = tile.icon
            return (
              <li
                key={tile.key}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-[10px] border px-2 py-3',
                  tile.colour,
                )}
              >
                <Icon className="h-[1.1rem] w-6" />
                <span className="text-lg leading-6 font-semibold">
                  {month.data ? String(month.data[tile.key]) : '…'}
                </span>
                <span className="text-xs">{tile.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

function BankAccountDialog({
  employee,
  account,
  first,
  onClose,
}: {
  employee: Employee
  account: BankAccount | null
  first: boolean
  onClose: () => void
}) {
  const save = useSaveChild('bank-accounts', 'Bank account')
  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: bankAccountToForm(account, first),
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: account?.id,
        input: {
          ...bankAccountToInput(values),
          ...(account ? { rowVersion: account.rowVersion } : {}),
        },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values))
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title={account ? 'Edit Bank Account' : 'Add Bank Account'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="bankName"
          label="Bank Name"
          required
          placeholder="Enter Bank Name"
        />
        <TextField
          control={form.control}
          name="accountNumber"
          label="Account Number / IBAN"
          required
          placeholder="Enter Account Number"
        />
        <TextField
          control={form.control}
          name="accountHolder"
          label="Account Holder"
          placeholder={employee.name}
        />
        <TextField
          control={form.control}
          name="branchName"
          label="Branch Name"
          placeholder="Enter Branch Name"
        />
        <TextField
          control={form.control}
          name="branchCode"
          label="Branch Code"
          placeholder="Enter Branch Code"
        />
        <TextField
          control={form.control}
          name="taxPayerId"
          label="Tax Payer ID (NTN)"
          placeholder="Enter NTN"
        />
        <SwitchField
          control={form.control}
          name="isPrimary"
          label="Primary account"
          stateLabel={(on) => (on ? 'Salary is paid here' : 'No')}
          className={navySwitchClass}
        />
      </div>
    </FormDialog>
  )
}

/** "•••• 4567": the last four characters of an account number or IBAN, the rest hidden. */
function maskAccount(value: string): string {
  const compact = compactAccount(value)
  return compact.length <= 4 ? compact : `•••• ${compact.slice(-4)}`
}

/**
 * Bank accounts (`/employees/{id}/bank-accounts`): the salary account first. The list shows
 * each number masked (its last four); Edit opens the full number.
 */
function BankAccounts({ employee }: { employee: Employee }) {
  const canEdit = useCan(TM_CODES.records)
  const accounts = useEmployeeChildren(employee.id, 'bank-accounts')
  const remove = useDeleteChild('bank-accounts', 'Bank account')
  const [editing, setEditing] = useState<BankAccount | 'new' | null>(null)
  const [deleting, setDeleting] = useState<BankAccount | null>(null)
  const rows = accounts.data ?? []
  return (
    <SectionCard
      title="Bank Accounts"
      actions={
        canEdit && (
          <Button
            variant="outline"
            onClick={() => {
              setEditing('new')
            }}
            className={cn(toolbarButtonClass, outlineButtonClass, 'gap-1.5 px-3 text-xs')}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add Account
          </Button>
        )
      }
    >
      {accounts.isPending ? (
        <LoadingRows rows={1} label="bank accounts" />
      ) : accounts.isError ? (
        <EmptyNote>The bank accounts could not be loaded.</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No bank account yet.</EmptyNote>
      ) : (
        <ul className="grid gap-2 @lg:grid-cols-2">
          {rows.map((account) => (
            <li
              key={account.id}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-[#E0E0E0] px-3 py-2.5 dark:border-border"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-title">
                  {account.bankName}
                  {account.isPrimary && (
                    <Chip
                      meta={{
                        label: 'Primary',
                        className:
                          'bg-[#EBEFF8] text-[#263871] dark:bg-sky-500/15 dark:text-sky-300',
                      }}
                    />
                  )}
                </p>
                <p className="text-xs break-all text-grey">
                  <span aria-hidden="true">{maskAccount(account.accountNumber)}</span>
                  <span className="sr-only">
                    Account ending {compactAccount(account.accountNumber).slice(-4)}
                  </span>
                </p>
                <p className="text-xs text-grey">
                  {[account.accountHolder, account.branchName].filter(Boolean).join(' | ')}
                </p>
              </div>
              {canEdit && (
                <EditDeleteMenu
                  label={`Actions for ${account.bankName} account ending ${compactAccount(account.accountNumber).slice(-4)}`}
                  onEdit={() => {
                    setEditing(account)
                  }}
                  onDelete={() => {
                    setDeleting(account)
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <BankAccountDialog
          employee={employee}
          account={editing === 'new' ? null : editing}
          first={rows.length === 0}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          what={`the ${deleting.bankName} account`}
          onClose={() => {
            setDeleting(null)
          }}
          onConfirm={() => {
            remove.mutate({
              employeeId: employee.id,
              rowId: deleting.id,
              rowVersion: deleting.rowVersion,
            })
            setDeleting(null)
          }}
        />
      )}
    </SectionCard>
  )
}

/**
 * Work (2423:17204, 2423:17407): Payroll History, Loan Summary, Performance Details and
 * Attendance, read from the Payroll, Requests and Attendance APIs, plus the bank accounts.
 */
export function WorkTab({ employee }: { employee: Employee }) {
  return (
    <div className="@container grid gap-4">
      <div className="grid gap-4 @4xl:grid-cols-2">
        <PayrollHistory employee={employee} />
        <LoanSummary employee={employee} />
        <PerformanceDetails employee={employee} />
        <AttendanceSummary employee={employee} />
      </div>
      <BankAccounts employee={employee} />
    </div>
  )
}
