import { useId, useState } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAYSLIP_STATUS_META } from '../../constants'
import {
  useAddPayrollEmployees,
  useOrganisationLookup,
  useOtherPayrollMembers,
  usePayrollEmployees,
  usePayrollErrors,
  usePayrollHistory,
  useSetPayrollEmployees,
} from '../../hooks/use-payroll'
import { personHint } from '../../hooks/use-payroll-records'
import type { PayrollError, PayrollRow } from '../../types/payroll.types'
import { formatJoining, formatMonth, formatRs, formatStamp } from '../../utils/format'
import { btn, fieldValueText, footerButton, toolbarButton } from '../../utils/styles'
import { EmployeeMultiSearchSelect } from '../shared/employee-search-select'
import { NoRecord } from '../shared/no-record'
import { type SearchOption, SearchSelect } from '../shared/search-select'

function CancelOnly({ onClose }: { onClose: () => void }) {
  return (
    <Button onClick={onClose} className={cn(footerButton, btn.red)}>
      Cancel
    </Button>
  )
}

/** The bordered tables of the run dialogs (Employments, History, Errors). */
export function BorderedTable({
  caption,
  head,
  children,
}: {
  caption: string
  head: string[]
  children: React.ReactNode
}) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-heading/70 dark:border-border">
      <table className="w-full min-w-[30rem] text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-heading/70 font-inter text-base text-heading sm:text-xl dark:border-border">
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-5 py-3.5 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const KIND_LABELS: Record<string, string> = {
  run: 'Run',
  recalculate: 'Recalculate',
  close: 'Closed',
  process: 'Processed',
}

/** "Payrolls History" (`GET /payrolls/{id}/history`): runs, recalculations and the close. */
export function PayrollHistoryDialog({
  payroll,
  onClose,
}: {
  payroll: PayrollRow
  onClose: () => void
}) {
  const history = usePayrollHistory(payroll.id)
  const entries = history.data ?? []
  return (
    <AppDialog
      title="Payrolls History"
      onRequestClose={onClose}
      className="max-w-4xl"
      footer={<CancelOnly onClose={onClose} />}
    >
      {history.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : entries.length === 0 ? (
        <NoRecord />
      ) : (
        <BorderedTable
          caption={`History of ${payroll.name}`}
          head={['Action', 'Performed At', 'Payslips', 'Errors', 'Performed By']}
        >
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-b text-sm font-medium text-person last:border-b-0 sm:text-base"
            >
              <td className="px-5 py-3">{KIND_LABELS[entry.kind] ?? entry.kind}</td>
              <td className="px-5 py-3">{entry.startedAt ? formatStamp(entry.startedAt) : '—'}</td>
              <td className="px-5 py-3">{entry.processedCount ?? '—'}</td>
              <td className="px-5 py-3">{entry.errorCount ?? 0}</td>
              <td className="px-5 py-3">{entry.runByName ?? '—'}</td>
            </tr>
          ))}
        </BorderedTable>
      )}
    </AppDialog>
  )
}

/** The error table both kinds of run show. */
export function RunErrorsTable({ caption, entries }: { caption: string; entries: PayrollError[] }) {
  return (
    <BorderedTable caption={caption} head={['Employee', 'Error']}>
      {entries.map((entry) => (
        <tr key={entry.id} className="border-b last:border-b-0">
          <td className="px-5 py-4 font-inter text-base text-heading sm:text-lg">
            {entry.employeeName ?? '—'}
            {entry.employeeCode && (
              <span className="block text-xs text-muted-foreground">{entry.employeeCode}</span>
            )}
          </td>
          <td className="px-5 py-4 font-inter text-base text-heading sm:text-lg">
            {entry.message}
          </td>
        </tr>
      ))}
    </BorderedTable>
  )
}

/** "Payrolls History Error" (`GET /payrolls/{id}/errors`): who could not be paid, and why. */
export function PayrollErrorsDialog({
  payroll,
  onClose,
}: {
  payroll: PayrollRow
  onClose: () => void
}) {
  const errors = usePayrollErrors(payroll.id)
  const entries = errors.data ?? []
  return (
    <AppDialog
      title="Payrolls History Error"
      onRequestClose={onClose}
      className="max-w-4xl"
      footer={<CancelOnly onClose={onClose} />}
    >
      {errors.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : entries.length === 0 ? (
        <NoRecord />
      ) : (
        <RunErrorsTable caption={`Errors in the runs of ${payroll.name}`} entries={entries} />
      )}
    </AppDialog>
  )
}

/**
 * "Employments" (`GET /payrolls/{id}/employees`): the people on the payroll with their
 * payslip, a search; Add opens a picker that saves the whole list (`PUT`), or adds everyone
 * of a branch / department (`POST …/employees/add`).
 */
export function EmploymentsDialog({
  payroll,
  onClose,
}: {
  payroll: PayrollRow
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const debounced = useDebouncedValue(search, 250)
  const employments = usePayrollEmployees(payroll.id, debounced)
  const everyone = usePayrollEmployees(payroll.id, '')
  const canEdit = useCan('payroll.payrolls.edit') && payroll.status !== 'closed'
  const rows = employments.data ?? []

  return (
    <>
      <AppDialog
        title="Employments"
        onRequestClose={onClose}
        className="max-w-4xl"
        footer={<CancelOnly onClose={onClose} />}
      >
        <div className="grid gap-5">
          {canEdit && (
            <div className="flex justify-end">
              <Button
                disabled={everyone.isPending}
                onClick={() => {
                  setAdding(true)
                }}
                className={cn(toolbarButton, btn.history, 'px-8 text-sm')}
              >
                Add
              </Button>
            </div>
          )}
          <Input
            type="search"
            aria-label="Search employments"
            placeholder="Search"
            className={cn(fieldValueText, 'placeholder:text-field-value sm:text-base')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
          />
          {employments.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <NoRecord>{debounced ? 'No employees match the search' : 'No Record Found'}</NoRecord>
          ) : (
            <BorderedTable
              caption={`Employees on ${payroll.name}`}
              head={['Employee', 'Joining Date', 'Branch', 'Department', 'Payslip']}
            >
              {rows.map((row) => (
                <tr
                  key={row.employeeId}
                  className="border-b text-sm font-medium text-person last:border-b-0 sm:text-base"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <EmployeeAvatar name={row.employeeName} photoUrl={null} className="size-7" />
                      <span>
                        {row.employeeName}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {row.employeeCode}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {row.joiningDate ? formatJoining(row.joiningDate) : '—'}
                  </td>
                  <td className="px-5 py-3">{row.branchName ?? '—'}</td>
                  <td className="px-5 py-3">{row.departmentName ?? '—'}</td>
                  <td className="px-5 py-3">
                    {row.payslipStatus
                      ? `${PAYSLIP_STATUS_META[row.payslipStatus].label}${row.netPayable === null ? '' : ` · ${formatRs(row.netPayable)}`}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </BorderedTable>
          )}
        </div>
      </AppDialog>
      {adding && (
        <AddEmployeesDialog
          payroll={payroll}
          current={(everyone.data ?? []).map((row) => row.employeeId)}
          known={(everyone.data ?? []).map((row) => ({
            value: row.employeeId,
            label: row.employeeName,
            hint: row.employeeCode,
          }))}
          onClose={() => {
            setAdding(false)
          }}
        />
      )}
    </>
  )
}

function AddEmployeesDialog({
  payroll,
  current,
  known,
  onClose,
}: {
  payroll: PayrollRow
  current: string[]
  /** Names of the people already on the payroll. */
  known: readonly SearchOption[]
  onClose: () => void
}) {
  const branches = useOrganisationLookup('branches')
  const departments = useOrganisationLookup('departments')
  const setEmployees = useSetPayrollEmployees()
  const addByFilter = useAddPayrollEmployees()
  const others = useOtherPayrollMembers(payroll)
  const hintId = useId()
  const errorId = useId()
  const [ids, setIds] = useState<string[]>(current)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = setEmployees.isPending || addByFilter.isPending || others.isLoading
  const fail = (failure: unknown) => {
    setError(failure instanceof ApiError ? failure.message : 'The employees could not be saved.')
  }
  const month = payroll.payrollMonth ? formatMonth(payroll.payrollMonth) : 'this month'
  /** People newly picked who are on another payroll of the month (one payroll a month each). */
  const clashes = ids.flatMap((id) => {
    const other = current.includes(id) ? undefined : others.taken.get(id)
    return other ? [`${other.employeeName} is already on ${other.payroll.name} for ${month}.`] : []
  })

  return (
    <AppDialog
      title={<span className="text-xl font-medium sm:text-2xl">Select Employees</span>}
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
            disabled={pending}
            onClick={() => {
              setError(null)
              if (clashes.length > 0) {
                setError(clashes.join(' '))
                return
              }
              setEmployees.mutate(
                { id: payroll.id, employeeIds: ids },
                { onSuccess: onClose, onError: fail },
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
      <div className="grid gap-6">
        <div className="grid gap-2">
          <p className="font-inter text-sm text-heading">Employees on the payroll</p>
          <EmployeeMultiSearchSelect
            aria-label="Employees"
            aria-describedby={clashes.length > 0 ? `${hintId} ${errorId}` : hintId}
            aria-invalid={clashes.length > 0}
            value={ids}
            onChange={(next) => {
              setIds(next)
              setError(null)
            }}
            filters={{ permission: 'payroll.payrolls.edit' }}
            known={known}
            include={(row) => !others.taken.has(row.id)}
            hint={personHint}
            placeholder="Select Employees"
          />
          <p id={hintId} className="text-xs text-muted-foreground">
            {ids.length} selected
            {others.taken.size > 0 &&
              ` · ${String(others.taken.size)} ${others.taken.size === 1 ? 'person is' : 'people are'} on another payroll for ${month} and not listed`}
          </p>
          {clashes.length > 0 && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {clashes.join(' ')}
            </p>
          )}
        </div>
        <div className="grid gap-2 rounded-lg border p-4">
          <p className="font-inter text-sm text-heading">
            Or add everyone of a branch / department
          </p>
          <p className="text-xs text-muted-foreground">
            People already on another payroll for {month} are skipped.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchSelect
              aria-label="Branch"
              value={branchId}
              onChange={setBranchId}
              clearable
              options={(branches.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
              placeholder="Any branch"
            />
            <SearchSelect
              aria-label="Department"
              value={departmentId}
              onChange={setDepartmentId}
              clearable
              options={(departments.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              placeholder="Any department"
            />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={pending || (!branchId && !departmentId)}
              onClick={() => {
                setError(null)
                addByFilter.mutate(
                  { id: payroll.id, filter: { branchId, departmentId, employeeStatus: 'active' } },
                  { onSuccess: onClose, onError: fail },
                )
              }}
              className={cn(toolbarButton, btn.navy, 'px-6')}
            >
              Add Matching
            </Button>
          </div>
        </div>
      </div>
    </AppDialog>
  )
}
