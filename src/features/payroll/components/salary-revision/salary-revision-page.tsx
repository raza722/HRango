import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  useDeleteSalaryRevision,
  useImportSalaryRevisions,
  useSalaryRevisions,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { SalaryRevisionRow } from '../../types/payroll.types'
import { parseCsv, toNumber } from '../../utils/csv'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatLong, formatRs } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { ImportButton } from '../shared/menu-button'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import {
  SalaryRevisionCreateDialog,
  SalaryRevisionEditDialog,
  SalaryRevisionViewDialog,
} from './salary-revision-dialogs'

const routeApi = getRouteApi('/_app/payroll/salary-revision')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete'; row: SalaryRevisionRow }
  | null

const columns: DataTableColumn<SalaryRevisionRow>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'effective', header: 'Effective Date', cell: (row) => formatLong(row.effectiveDate) },
  { id: 'previous', header: 'Previous Salary', cell: (row) => formatRs(row.previousSalary) },
  { id: 'salary', header: 'Salary', cell: (row) => formatRs(row.salary) },
]

/** Salary Revision: a new salary from a date; payroll runs use it from then on. */
export function SalaryRevisionPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions()
  const [filters, setFilters] = useFilters('salary-revision')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteSalaryRevision()
  const importFile = useImportSalaryRevisions()
  const list = useSalaryRevisions({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    department: filters.department,
    from: filters.from,
    to: filters.to,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      options: options.employees,
    },
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: options.departments,
    },
    { kind: 'date', key: 'from', label: 'Effective From' },
    { kind: 'date', key: 'to', label: 'Effective To' },
  ]
  const close = () => {
    setDialog(null)
  }

  return (
    <PayrollCard
      title="Salary Revision"
      actions={
        <>
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={cn(toolbarButton, btn.blue, 'min-w-24')}
          >
            Create
          </Button>
          <ImportButton
            choices={[{ key: 'salary-revision', label: 'Salary Revision' }]}
            onFile={(_kind, text) =>
              importFile.mutateAsync(
                parseCsv(text, 'employee').map((cells) => {
                  const salary = toNumber(cells[2])
                  return {
                    employeeCode: cells[0] ?? '',
                    effectiveDate: cells[1] ?? '',
                    salary: Number.isFinite(salary) ? salary : 0,
                  }
                }),
              )
            }
          />
          <FiltersButton
            count={activeCount(filters)}
            onClick={() => {
              setDialog({ type: 'filters' })
            }}
          />
        </>
      }
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Salary revisions"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.code}, ${row.employee.name}`}
            actions={[
              {
                label: 'Edit',
                onSelect: () => {
                  setDialog({ type: 'edit', row })
                },
              },
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onSelect: () => {
                  setDialog({ type: 'delete', row })
                },
              },
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="revisions"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <SalaryRevisionCreateDialog onClose={close} />}
      {dialog?.type === 'edit' && <SalaryRevisionEditDialog id={dialog.row.id} onClose={close} />}
      {dialog?.type === 'view' && <SalaryRevisionViewDialog id={dialog.row.id} onClose={close} />}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="salary-revision"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete salary revision"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type === 'delete') {
            remove.mutate(dialog.row.id, {
              onError: () => {
                toast.error('Could not delete the revision.')
              },
            })
          }
        }}
      />
    </PayrollCard>
  )
}
