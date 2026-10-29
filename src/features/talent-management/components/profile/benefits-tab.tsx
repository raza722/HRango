import { Link } from '@tanstack/react-router'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { ACCOUNT_CATEGORY_LABELS, type AccountBalance } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { usePayrollAccounts } from '../../hooks/use-profile-related'
import type { Employee } from '../../types/employees.types'
import { formatAmount } from '../../utils/format'
import { sectionLinkClass, sectionTableClass } from '../../utils/styles'
import { EmptyNote, LoadingRows, SectionCard } from '../shared/parts'

/**
 * Benefits (2423:18769). The Employee Benefits table is drawn with Benefit Name, Employee
 * Contributions, Company Contributions and Total, but the Benefits API keeps no contributions per
 * person (only plans, enrollment windows and elections), so the table says so and View Details
 * opens Benefits → Employees. Below it, what the app does keep of this person's benefits: their
 * Payroll accounts (benefit and pay-item accounts, `GET /payroll/payslips/summary`).
 */
export function BenefitsTab({ employee }: { employee: Employee }) {
  const accounts = usePayrollAccounts(employee.id)
  const benefitColumns: DataTableColumn<never>[] = [
    { id: 'name', header: 'Benefit Name', cell: () => null },
    { id: 'employee', header: 'Employee Contributions', cell: () => null },
    { id: 'company', header: 'Company Contributions', cell: () => null },
    { id: 'total', header: 'Total', cell: () => null },
  ]
  const accountColumns: DataTableColumn<AccountBalance>[] = [
    { id: 'account', header: 'Account', cell: (row) => row.accountName },
    {
      id: 'category',
      header: 'Type',
      cell: (row) => ACCOUNT_CATEGORY_LABELS[row.category],
    },
    { id: 'credit', header: 'Credit', align: 'right', cell: (row) => formatAmount(row.credit) },
    { id: 'debit', header: 'Debit', align: 'right', cell: (row) => formatAmount(row.debit) },
    { id: 'balance', header: 'Balance', align: 'right', cell: (row) => formatAmount(row.balance) },
  ]
  const rows = (accounts.data?.accounts ?? []).filter((row) => row.category !== 'leave_quota')

  return (
    <div className="@container grid gap-4">
      <SectionCard
        title="Employee Benefits"
        footer={
          <Link to="/benefits/employees" className={sectionLinkClass}>
            View Details
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <DataTable
            caption="Employee Benefits"
            columns={benefitColumns}
            data={[]}
            getRowId={() => ''}
            className={cn(sectionTableClass, 'md:min-w-[30rem]')}
            emptyState="Contributions per employee are not shown here yet. View Details opens the employees’ benefits."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Benefit Accounts"
        footer={
          <Link to="/payroll/balances/employee-accounts" className={sectionLinkClass}>
            Employee Accounts
          </Link>
        }
      >
        {accounts.isPending ? (
          <LoadingRows rows={2} label="benefit accounts" />
        ) : accounts.isError ? (
          <EmptyNote>The accounts could not be loaded: {accounts.error.message}</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              caption="Benefit Accounts"
              columns={accountColumns}
              data={rows}
              getRowId={(row) => row.accountTypeId}
              className={cn(sectionTableClass, 'md:min-w-[30rem]')}
              emptyState="No benefit or pay-item accounts in Payroll for this employee."
            />
          </div>
        )}
      </SectionCard>
    </div>
  )
}
