import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { PAYROLL_CODES } from '../../constants'
import {
  useDeleteSalaryRevision,
  useImportSalaryRevisions,
  useSalaryRevisions,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import type { SalaryRevisionRow } from '../../types/payroll.types'
import { activeCount, type FilterField, numberOf, useFilters } from '../../utils/filters'
import { formatAmount, formatLong, formatRs } from '../../utils/format'
import { btn, payrollTableClass, toolbarButton } from '../../utils/styles'
import { downloadImportTemplate } from '../balances/balance-csv'
import { CsvImportButton } from '../balances/csv-import-button'
import { FiltersButton, ListFooter, PersonCell } from '../balances/list-parts'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import {
  SalaryRevisionCreateDialog,
  SalaryRevisionEditDialog,
  SalaryRevisionViewDialog,
} from './salary-revision-dialogs'

const routeApi = getRouteApi('/_app/payroll/salary-revision')
const PAGE_SIZE = 10
const CODE = PAYROLL_CODES.salaryRevision

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete'; row: SalaryRevisionRow }
  | null

const change = (row: SalaryRevisionRow) =>
  row.changeValue === null
    ? '—'
    : row.changeType === 'percent'
      ? `${formatAmount(row.changeValue)}%`
      : formatRs(row.changeValue)

const columns: DataTableColumn<SalaryRevisionRow>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.employeeCode },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.employeeName, photoUrl: null }} />,
  },
  { id: 'effective', header: 'Effective Date', cell: (row) => formatLong(row.effectiveDate) },
  {
    id: 'previous',
    header: 'Previous Salary',
    cell: (row) => (row.previousAmount === null ? '—' : formatRs(row.previousAmount)),
  },
  { id: 'change', header: 'Change', cell: change },
  { id: 'salary', header: 'Salary', cell: (row) => formatRs(row.amount) },
]

/**
 * Salary Revision (`/payroll/salary-revisions`): a salary from a date, flat or percentage on the
 * previous one; payroll runs use it from then on. Joining salaries and imports are listed too
 * (`canEdit` false for rows the screen may not change).
 */
export function SalaryRevisionPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const options = usePayrollOptions('payroll.salary_revision.view')
  const can = {
    create: useCan(`${CODE}.create`),
    edit: useCan(`${CODE}.edit`),
    delete: useCan(`${CODE}.delete`),
    import: useCan(`${CODE}.import`),
  }
  const [filters, setFilters] = useFilters('salary-revision')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteSalaryRevision()
  const importFile = useImportSalaryRevisions()
  const list = useSalaryRevisions({
    page,
    pageSize: PAGE_SIZE,
    employeeId: filters.employeeId,
    from: filters.from,
    to: filters.to,
    salaryFrom: numberOf(filters.salaryFrom),
    salaryTo: numberOf(filters.salaryTo),
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'employee',
      key: 'employeeId',
      label: 'Employee',
      placeholder: 'Select Employee',
      filters: options.employeeFilters,
    },
    { kind: 'date', key: 'from', label: 'Effective From' },
    { kind: 'date', key: 'to', label: 'Effective To' },
    { kind: 'range', key: 'salary', label: 'Salary', from: 'salaryFrom', to: 'salaryTo' },
  ]
  const close = () => {
    setDialog(null)
  }
  const actions = (row: SalaryRevisionRow): RowAction[] => {
    const items: (RowAction | false)[] = [
      can.edit &&
        row.canEdit && {
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
      can.delete &&
        row.canEdit && {
          label: 'Delete',
          variant: 'destructive',
          onSelect: () => {
            setDialog({ type: 'delete', row })
          },
        },
      // A promotion's salary is undone by cancelling the promotion, not here.
      (can.edit || can.delete) &&
        !row.canEdit &&
        row.source === 'promotion' && {
          label: 'From a promotion: cancel it in Requests to undo',
          disabled: true,
          onSelect: () => undefined,
        },
    ]
    return items.filter((item): item is RowAction => item !== false)
  }

  return (
    <PayrollCard
      title="Salary Revision"
      actions={
        <>
          {can.create && (
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButton, btn.blue, 'min-w-24')}
            >
              Create
            </Button>
          )}
          {can.import && (
            <>
              <Button
                onClick={() => {
                  void options.sampleEmployeeCode().then((code) => {
                    downloadImportTemplate('salary-revision', code)
                  })
                }}
                className={cn(toolbarButton, btn.green)}
              >
                Sample Import
              </Button>
              <CsvImportButton onImport={(fileId) => importFile.mutateAsync({ fileId })} />
            </>
          )}
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
            label={`Actions for ${row.employeeName}, ${formatLong(row.effectiveDate)}`}
            actions={actions(row)}
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
            remove.mutate(
              { id: dialog.row.id, rowVersion: dialog.row.rowVersion },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof ApiError ? error.message : 'Could not delete the revision.',
                  )
                },
              },
            )
          }
        }}
      />
    </PayrollCard>
  )
}
