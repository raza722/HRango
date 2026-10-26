import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  activeCount,
  btn,
  type FilterField,
  FiltersButton,
  FiltersDialog,
  formatLong,
  ListFooter,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  PersonCell,
  StatusChip,
  toolbarButton,
  useFilters,
} from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ALLOCATION_STATUS_META, ASSET_PAGE_SIZE } from '../../constants'
import { useAllocations, useAssetOptions, useAssetTypeOptions } from '../../hooks/use-assets'
import type { Allocation } from '../../types/assets.types'
import { AllocationDialog } from './allocation-dialog'
import { DeallocateDialog } from './deallocate-dialog'

const routeApi = getRouteApi('/_app/assets/allocations')

type Dialog =
  { type: 'allocate' | 'filters' } | { type: 'view' | 'deallocate'; row: Allocation } | null

const assetLabel = (row: Pick<Allocation, 'assetName' | 'identificationNo'>) =>
  row.identificationNo ? `${row.assetName} (${row.identificationNo})` : row.assetName

const columns: DataTableColumn<Allocation>[] = [
  { id: 'company', header: 'Company', cell: (row) => row.companyName },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => (
      <PersonCell person={{ name: row.employeeName ?? row.employeeId, photoUrl: null }} />
    ),
  },
  { id: 'asset', header: 'Asset', cell: (row) => row.assetName },
  { id: 'number', header: 'Identification Number', cell: (row) => row.identificationNo ?? '—' },
  {
    id: 'allocated',
    header: 'Allocation Date',
    align: 'center',
    cell: (row) => (
      <span className="block max-w-28 whitespace-normal">{formatLong(row.allocatedOn)}</span>
    ),
  },
  {
    id: 'deallocated',
    header: 'Deallocation Date',
    align: 'center',
    cell: (row) =>
      row.deallocatedOn ? (
        <span className="block max-w-28 whitespace-normal">{formatLong(row.deallocatedOn)}</span>
      ) : (
        '—'
      ),
  },
  {
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (row) => <StatusChip {...ALLOCATION_STATUS_META[row.status]} />,
  },
]

/**
 * Asset Allocations: who holds which asset since when (Company, Employee,
 * Asset, Identification Number, Allocation and Deallocation Date, Status),
 * with Allocate, Filters, and View / Deallocate on each row.
 */
export function AssetAllocationsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canAssign = useCan('assets.allocations.assign')
  const [filters, setFilters] = useFilters('asset-allocations-v2')
  const [dialog, setDialog] = useState<Dialog>(null)
  const types = useAssetTypeOptions()
  const assets = useAssetOptions({})
  const list = useAllocations({
    page,
    pageSize: ASSET_PAGE_SIZE,
    q: filters.q,
    employeeId: filters.employeeId,
    assetTypeId: filters.assetTypeId,
    status: filters.status,
    assetId: filters.assetId,
    from: filters.from,
    to: filters.to,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'employee',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employee',
      filters: { permission: 'assets.allocations.view', includeInactive: true },
      // The listed people, so a saved filter keeps its name before the lookup reads them.
      known: (list.data?.data ?? []).map((row) => ({
        value: row.employeeId,
        label: row.employeeName ?? row.employeeId,
      })),
    },
    {
      kind: 'select',
      key: 'assetTypeId',
      label: 'Asset Type',
      placeholder: 'Select an Option',
      options: (types.data ?? []).map((type) => ({ value: type.id, label: type.name })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Is Allocated',
      placeholder: 'Select an Option',
      options: [
        { value: 'allocated', label: 'Allocated' },
        { value: 'deallocated', label: 'Deallocated' },
      ],
    },
    {
      kind: 'select',
      key: 'assetId',
      label: 'Assets',
      placeholder: 'Select an Option',
      options: (assets.data ?? []).map((asset) => ({
        value: asset.id,
        label: assetLabel({ assetName: asset.name, identificationNo: asset.identificationNo }),
        hint: asset.code,
      })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
    { kind: 'text', key: 'q', label: 'Search', placeholder: 'Employee or asset' },
  ]
  const close = () => {
    setDialog(null)
  }

  return (
    <PayrollCard
      title="Asset Allocations"
      actions={
        <>
          {canAssign && (
            <Button
              onClick={() => {
                setDialog({ type: 'allocate' })
              }}
              className={cn(toolbarButton, btn.blue, 'min-w-24')}
            >
              Allocate
            </Button>
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
        caption="Asset allocations"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${assetLabel(row)}, ${row.employeeName ?? row.employeeId}`}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
              ...(row.status === 'allocated' && canAssign
                ? [
                    {
                      label: 'Deallocate',
                      onSelect: () => {
                        setDialog({ type: 'deallocate', row })
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="allocations"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'allocate' && <AllocationDialog id={null} onClose={close} />}
      {dialog?.type === 'view' && <AllocationDialog id={dialog.row.id} onClose={close} />}
      {dialog?.type === 'deallocate' && <DeallocateDialog row={dialog.row} onClose={close} />}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="asset-allocations-v2"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
    </PayrollCard>
  )
}
