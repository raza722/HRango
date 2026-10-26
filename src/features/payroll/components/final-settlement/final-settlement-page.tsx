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
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { useCan } from '@/lib/permissions'

import {
  EMPLOYMENT_STATUS_OPTIONS,
  FINAL_SETTLEMENT_STATUS_META,
  PAYROLL_CODES,
} from '../../constants'
import {
  useCloseFinalSettlement,
  useFinalSettlementPayslip,
  useFinalSettlements,
  useRecalculateFinalSettlement,
} from '../../hooks/use-payroll'
import { usePayrollOptions } from '../../hooks/use-payroll-records'
import { FINAL_SETTLEMENT_STATUSES, type FinalSettlementRow } from '../../types/payroll.types'
import { activeCount, type FilterField, useFilters } from '../../utils/filters'
import { formatLong, formatRs, monthStart } from '../../utils/format'
import { payrollTableClass } from '../../utils/styles'
import { FiltersButton, ListFooter, PersonCell, ReadOnlyRow } from '../balances/list-parts'
import { PayslipDocumentDialog } from '../payslips/payslip-document'
import { ConfirmAction } from '../shared/confirm-action'
import { FiltersDialog } from '../shared/filters-dialog'
import { NoRecord } from '../shared/no-record'
import { PayrollCard } from '../shared/payroll-card'
import { PayrollDialog } from '../shared/payroll-dialog'
import { StatusChip } from '../shared/status-chip'
import { UploadField } from '../shared/upload-field'
import { FinalSettlementView } from './final-settlement-view'

const routeApi = getRouteApi('/_app/payroll/final-settlement')
const PAGE_SIZE = 10
const CODE = PAYROLL_CODES.finalSettlement

type Dialog =
  | { type: 'view' | 'payslip'; id: string }
  | { type: 'recalculate' | 'close'; row: FinalSettlementRow }
  | { type: 'filters' }
  | null

function SettlementPayslip({ id, onClose }: { id: string; onClose: () => void }) {
  const slip = useFinalSettlementPayslip(id)
  return <PayslipDocumentDialog slip={slip.data} isError={slip.isError} onClose={onClose} />
}

/** "Close FS": optionally attach the signed settlement letter, then close (irreversible). */
function CloseDialog({ row, onClose }: { row: FinalSettlementRow; onClose: () => void }) {
  const [file, setFile] = useState<FileRef | null>(row.file)
  const [error, setError] = useState<string | null>(null)
  const close = useCloseFinalSettlement()
  return (
    <PayrollDialog
      title="Close Final Settlement"
      onClose={onClose}
      saveLabel="Close FS"
      pending={close.isPending}
      error={error}
      className="max-w-2xl"
      onSave={() => {
        setError(null)
        close.mutate(
          { id: row.id, input: { rowVersion: row.rowVersion ?? '', fileId: file?.id ?? null } },
          {
            onSuccess: onClose,
            onError: (reason) => {
              setError(reason instanceof ApiError ? reason.message : 'That could not be done.')
            },
          },
        )
      }}
    >
      <div className="grid gap-4">
        <ReadOnlyRow label="Employee" value={`${row.employeeName} (${row.employeeCode})`} />
        <ReadOnlyRow label="Last Working Date" value={formatLong(row.lastWorkingDate)} />
        <ReadOnlyRow
          label="Net Payable"
          value={row.netPayable === null ? '—' : formatRs(row.netPayable)}
        />
        <UploadField label="Signed Settlement Letter" value={file} onChange={setFile} />
        <p className="text-sm text-muted-foreground">
          Closing releases the settlement payslip. It cannot be undone.
        </p>
      </div>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<FinalSettlementRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: row.employeeName, photoUrl: null }} />,
  },
  { id: 'department', header: 'Department', cell: (row) => row.departmentName ?? '—' },
  { id: 'last', header: 'Last Working Date', cell: (row) => formatLong(row.lastWorkingDate) },
  {
    id: 'net',
    header: 'Net Payable',
    cell: (row) => (row.netPayable === null ? '—' : formatRs(row.netPayable)),
  },
  {
    id: 'status',
    header: 'Status',
    cell: (row) => <StatusChip {...FINAL_SETTLEMENT_STATUS_META[row.status]} />,
  },
]

/**
 * Final Settlement (`/payroll/final-settlements`): leavers whose end of employment needs a
 * settlement. Pending → Recalculate works it out (Calculated) → Close FS releases its payslip
 * (Completed). Filters: Location, Branch, Department, Employees, Employment Status, Month, Status.
 */
export function FinalSettlementPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filters, setFilters] = useFilters('final-settlement')
  const [dialog, setDialog] = useState<Dialog>(null)
  const options = usePayrollOptions('payroll.final_settlement.view')
  const canProcess = useCan(`${CODE}.process`)
  const canClose = useCan(`${CODE}.close`)
  const recalculate = useRecalculateFinalSettlement()
  const list = useFinalSettlements({
    page,
    pageSize: PAGE_SIZE,
    status: filters.status,
    locationId: filters.locationId,
    branchId: filters.branchId,
    departmentId: filters.departmentId,
    employmentStatus: filters.employmentStatus === 'all' ? undefined : filters.employmentStatus,
    month: filters.month ? monthStart(filters.month) : undefined,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }

  const actions = (row: FinalSettlementRow): RowAction[] => {
    const items: (RowAction | false)[] = [
      {
        label: 'View',
        onSelect: () => {
          setDialog({ type: 'view', id: row.id })
        },
      },
      row.payslipId !== null && {
        label: 'Payslip',
        onSelect: () => {
          setDialog({ type: 'payslip', id: row.id })
        },
      },
      canProcess &&
        row.status !== 'closed' && {
          label: 'Recalculate',
          onSelect: () => {
            setDialog({ type: 'recalculate', row })
          },
        },
      canClose &&
        row.status === 'open' && {
          label: 'Close FS',
          onSelect: () => {
            setDialog({ type: 'close', row })
          },
        },
    ]
    return items.filter((item): item is RowAction => item !== false)
  }

  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'locationId',
      label: 'Location',
      placeholder: 'Select Location',
      options: options.locations,
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: options.branches,
    },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: options.departments,
    },
    {
      kind: 'select',
      key: 'employmentStatus',
      label: 'Employment Status',
      placeholder: 'Select an Option',
      options: EMPLOYMENT_STATUS_OPTIONS,
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: FINAL_SETTLEMENT_STATUSES.map((value) => ({
        value,
        label: FINAL_SETTLEMENT_STATUS_META[value].label,
      })),
    },
    { kind: 'month', key: 'month', label: 'Month' },
  ]
  const close = () => {
    setDialog(null)
  }
  const recalculating = dialog?.type === 'recalculate' ? dialog.row : null

  return (
    <PayrollCard
      title="Final Settlement"
      actions={
        <FiltersButton
          count={activeCount(filters)}
          onClick={() => {
            setDialog({ type: 'filters' })
          }}
        />
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
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.employeeName}`}
            actions={actions(row)}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="settlements"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'filters' && (
        <FiltersDialog
          preset="final-settlement"
          fields={fields}
          value={filters}
          onApply={(values) => {
            setFilters(values)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      {dialog?.type === 'view' && <FinalSettlementView id={dialog.id} onClose={close} />}
      {dialog?.type === 'payslip' && <SettlementPayslip id={dialog.id} onClose={close} />}
      {dialog?.type === 'close' && <CloseDialog row={dialog.row} onClose={close} />}
      <ConfirmAction
        open={recalculating !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        message="Are you sure you want to Perform this action?"
        title={recalculating ? `Recalculate, ${recalculating.employeeName}` : undefined}
        onConfirm={() => {
          if (!recalculating) return
          recalculate.mutate(recalculating.id, {
            onError: (error) => {
              toast.error(error instanceof ApiError ? error.message : 'That could not be done.')
            },
          })
        }}
      />
    </PayrollCard>
  )
}
