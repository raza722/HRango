import { useState } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { EmployeeAvatar } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useEmployments,
  usePayrollErrors,
  usePayrollHistory,
  useSetEmployments,
} from '../../hooks/use-payroll'
import type { PayrollRow } from '../../types/payroll.types'
import { formatJoining, formatMonth, formatStamp } from '../../utils/format'
import { btn, fieldValueText, footerButton, toolbarButton } from '../../utils/styles'
import { NoRecord } from '../shared/no-record'
import { SelectEmployeesDialog } from '../shared/select-employees-dialog'

function CancelOnly({ onClose }: { onClose: () => void }) {
  return (
    <Button onClick={onClose} className={cn(footerButton, btn.red)}>
      Cancel
    </Button>
  )
}

/** The bordered tables of the run dialogs (Employments, History Error). */
function BorderedTable({
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
          <tr className="border-b border-heading/70 font-inter text-base text-heading sm:text-2xl dark:border-border">
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

/** "Payrolls History": the payroll's runs, closings and holds, newest first. */
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
          head={['Action', 'Month', 'Performed At', 'Performed By']}
        >
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-b text-sm font-medium text-person last:border-b-0 sm:text-base"
            >
              <td className="px-5 py-3">{entry.action}</td>
              <td className="px-5 py-3">{formatMonth(entry.month)}</td>
              <td className="px-5 py-3">{formatStamp(entry.performedAt)}</td>
              <td className="px-5 py-3">{entry.performedBy}</td>
            </tr>
          ))}
        </BorderedTable>
      )}
    </AppDialog>
  )
}

/** "Payrolls History Error": who could not be paid in the last run, and why. */
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
        <BorderedTable
          caption={`Errors in the last run of ${payroll.name}`}
          head={['Employee', 'Error']}
        >
          {entries.map((entry) => (
            <tr key={entry.employeeId} className="border-b last:border-b-0">
              <td className="px-5 py-4 font-inter text-base text-heading sm:text-2xl">
                {entry.employeeName}
              </td>
              <td className="px-5 py-4 font-inter text-base text-heading sm:text-2xl">
                {entry.message}
              </td>
            </tr>
          ))}
        </BorderedTable>
      )}
    </AppDialog>
  )
}

/** "Employments": the people on the payroll, a search, and Add (Select Employees). */
export function EmploymentsDialog({
  payroll,
  onClose,
}: {
  payroll: PayrollRow
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounced = useDebouncedValue(search, 250)
  const employments = useEmployments(payroll.id, debounced)
  const save = useSetEmployments()
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
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setError(null)
                setAdding(true)
              }}
              className={cn(toolbarButton, btn.history, 'px-8 text-sm')}
            >
              Add
            </Button>
          </div>
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
              head={['Employee', 'Joining Date', 'Branch', 'Designation']}
            >
              {rows.map((row) => (
                <tr
                  key={row.employee.id}
                  className="border-b text-sm font-medium text-person last:border-b-0 sm:text-base"
                >
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-2.5">
                      <EmployeeAvatar
                        name={row.employee.name}
                        photoUrl={row.employee.photoUrl}
                        className="size-7"
                      />
                      <span>{row.employee.name}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3">{formatJoining(row.joiningDate)}</td>
                  <td className="px-5 py-3">{row.branch ?? '—'}</td>
                  <td className="px-5 py-3">{row.employee.designation}</td>
                </tr>
              ))}
            </BorderedTable>
          )}
        </div>
      </AppDialog>
      {adding && (
        <SelectEmployeesDialog
          initial={payroll.employeeIds}
          pending={save.isPending}
          error={error}
          onClose={() => {
            setAdding(false)
          }}
          onSave={(employeeIds) => {
            setError(null)
            save.mutate(
              { id: payroll.id, employeeIds },
              {
                onSuccess: () => {
                  setAdding(false)
                },
                onError: (failure) => {
                  setError(
                    failure instanceof ApiError
                      ? failure.message
                      : 'The employees could not be saved.',
                  )
                },
              },
            )
          }}
        />
      )}
    </>
  )
}
