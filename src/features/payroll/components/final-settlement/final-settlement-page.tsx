import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  EmployeeAvatar,
  Pagination,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { locationResource, useOrgList } from '@/features/settings'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { EMPLOYMENT_STATUS_OPTIONS, FINAL_SETTLEMENT_STATUS_META } from '../../constants'
import {
  useFinalSettlementAction,
  useFinalSettlementPayslip,
  useFinalSettlements,
  usePayrollLookups,
} from '../../hooks/use-payroll'
import type { FinalSettlementRow } from '../../types/payroll.types'
import { type FilterField, useFilters } from '../../utils/filters'
import { btn, payrollTableClass, personNameText, toolbarButton } from '../../utils/styles'
import { PayslipDocumentDialog } from '../payslips/payslip-document'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { PayrollCard } from '../shared/payroll-card'
import { StatusChip } from '../shared/status-chip'
import { FinalSettlementView } from './final-settlement-view'

const routeApi = getRouteApi('/_app/payroll/final-settlement')
const PAGE_SIZE = 10

type Dialog =
  | { type: 'view' | 'payslip'; id: string }
  | { type: 'confirm'; action: 'recalculate' | 'close'; row: FinalSettlementRow }
  | { type: 'filters' }
  | null

function SettlementPayslip({ id, onClose }: { id: string; onClose: () => void }) {
  const slip = useFinalSettlementPayslip(id)
  return <PayslipDocumentDialog slip={slip.data} isError={slip.isError} onClose={onClose} />
}

const columns: DataTableColumn<FinalSettlementRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => (
      <span className="flex items-center gap-2">
        <EmployeeAvatar
          name={row.employee.name}
          photoUrl={row.employee.photoUrl}
          className="size-6"
        />
        <span className={personNameText}>{row.employee.name}</span>
      </span>
    ),
  },
  { id: 'department', header: 'Department', cell: (row) => row.employee.department },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <StatusChip {...FINAL_SETTLEMENT_STATUS_META[row.status]} />,
  },
]

/**
 * Final Settlement: people who are leaving, Pending until the settlement is
 * closed. Pending: View, Payslip, Recalculate, Close FS; Completed: View,
 * Payslip. Filters: Location, Branch, Department, Employees, Employment
 * Status, Month.
 */
export function FinalSettlementPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filters, setFilters] = useFilters('final-settlement')
  const [dialog, setDialog] = useState<Dialog>(null)
  const lookups = usePayrollLookups()
  const locations = useOrgList(locationResource, { page: 1, pageSize: 100 })
  const action = useFinalSettlementAction()
  // The people filters ride along with the page (the API takes them all).
  const params = {
    page,
    pageSize: PAGE_SIZE,
    locationId: filters.locationId,
    branchId: filters.branchId,
    department: filters.department,
    employeeId: filters.employeeId,
    employmentStatus: filters.employmentStatus === 'all' ? undefined : filters.employmentStatus,
    month: filters.month,
  }
  const list = useFinalSettlements(params)
  const meta = list.data?.meta

  const actions = (row: FinalSettlementRow): RowAction[] => {
    const base: RowAction[] = [
      {
        label: 'View',
        onSelect: () => {
          setDialog({ type: 'view', id: row.id })
        },
      },
      {
        label: 'Payslip',
        onSelect: () => {
          setDialog({ type: 'payslip', id: row.id })
        },
      },
    ]
    if (row.status === 'completed') return base
    return [
      ...base,
      {
        label: 'Recalculate',
        onSelect: () => {
          setDialog({ type: 'confirm', action: 'recalculate', row })
        },
      },
      {
        label: 'Close FS',
        onSelect: () => {
          setDialog({ type: 'confirm', action: 'close', row })
        },
      },
    ]
  }

  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'locationId',
      label: 'Location',
      placeholder: 'Select Location',
      options: (locations.data?.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: (lookups.data?.branches ?? []).map((item) => ({ value: item.id, label: item.name })),
    },
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: (lookups.data?.departments ?? []).map((item) => ({ value: item, label: item })),
    },
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employees',
      options: (lookups.data?.employees ?? []).map((person) => ({
        value: person.id,
        label: person.name,
        hint: person.code,
      })),
    },
    {
      kind: 'select',
      key: 'employmentStatus',
      label: 'Employment Status',
      placeholder: 'Select an Option',
      options: EMPLOYMENT_STATUS_OPTIONS,
    },
    { kind: 'month', key: 'month', label: 'Month' },
  ]

  const confirmed = dialog?.type === 'confirm' ? dialog : null

  return (
    <PayrollCard
      title="Final Settlement"
      actions={
        <Button
          onClick={() => {
            setDialog({ type: 'filters' })
          }}
          className={cn(toolbarButton, btn.orange)}
        >
          Filters
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Final settlements"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState="No final settlements match."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.employee.name}`}
            actions={actions(row)}
          />
        )}
      />
      {meta && meta.totalPages > 1 && (
        <div className="flex justify-end">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            disabled={list.isFetching}
            onPageChange={(next) => {
              void navigate({ search: { page: next } })
            }}
          />
        </div>
      )}

      {dialog?.type === 'filters' && (
        <FiltersDialog
          preset="final-settlement"
          fields={fields}
          value={filters}
          onApply={(values) => {
            setFilters(values)
            void navigate({ search: { page: 1 } })
          }}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'view' && (
        <FinalSettlementView
          id={dialog.id}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog?.type === 'payslip' && (
        <SettlementPayslip
          id={dialog.id}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmAction
        open={confirmed !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        message="Are you sure you want to Perform this action?"
        title={
          confirmed
            ? `${confirmed.action === 'close' ? 'Close FS' : 'Recalculate'}, ${confirmed.row.employee.name}`
            : undefined
        }
        onConfirm={() => {
          if (!confirmed) return
          action.mutate(
            { id: confirmed.row.id, action: confirmed.action },
            {
              onError: (error) => {
                toast.error(error instanceof ApiError ? error.message : 'That could not be done.')
              },
            },
          )
        }}
      />
    </PayrollCard>
  )
}
