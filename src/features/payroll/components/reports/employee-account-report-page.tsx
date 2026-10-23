import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { cn } from '@/lib/utils'

import { EMPLOYMENT_STATUS_OPTIONS } from '../../constants'
import { useEmployeeAccountReport } from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { EmployeeAccountReportRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatRs } from '../../utils/format'
import { payrollTableClass } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'

const routeApi = getRouteApi('/_app/payroll/reports/employee-accounts')
const PAGE_SIZE = 10

const columns: DataTableColumn<EmployeeAccountReportRow>[] = [
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  {
    id: 'pf',
    header: 'Provident Fund Deduction',
    align: 'center',
    cell: (row) => formatRs(row.providentFund),
  },
  {
    id: 'rebate',
    header: 'Total Tax Rebate',
    align: 'center',
    cell: (row) => formatRs(row.totalTaxRebate),
  },
  {
    id: 'tax',
    header: 'Total Tax Paid',
    align: 'center',
    cell: (row) => formatRs(row.totalTaxPaid),
  },
]

/** Reports → Employee Accounts: provident fund, tax rebates and tax paid per person. */
export function EmployeeAccountReportPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('employee-account-report')
  const [filtering, setFiltering] = useState(false)
  const status = filters.employmentStatus === 'all' ? undefined : filters.employmentStatus
  const list = useEmployeeAccountReport({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    employmentStatus: status,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employees',
      options: options.employees,
    },
    {
      kind: 'select',
      key: 'employmentStatus',
      label: 'Employment Status',
      placeholder: 'Select an Option',
      options: EMPLOYMENT_STATUS_OPTIONS.map((option) => ({ ...option })),
    },
  ]

  return (
    <PayrollCard
      title="Employee Account Report"
      actions={
        <FiltersButton
          count={activeCount(filters)}
          onClick={() => {
            setFiltering(true)
          }}
        />
      }
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.employee.id}
        caption="Employee account report"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        // Figma: this report's headings are Poppins Medium 16 #303030.
        className={cn(payrollTableClass, '[&_th]:text-base')}
        emptyState={<NoRecord />}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="employees"
        disabled={list.isFetching}
        onPageChange={goTo}
      />
      {filtering && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="employee-account-report"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={() => {
            setFiltering(false)
          }}
        />
      )}
    </PayrollCard>
  )
}
