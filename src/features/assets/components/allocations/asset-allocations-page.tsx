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
import { cn } from '@/lib/utils'

import { ALLOCATION_STATUS_META, ASSET_PAGE_SIZE } from '../../constants'
import { useAllocations, useAssetLookups } from '../../hooks/use-assets'
import type { AllocationRow } from '../../types/assets.types'
import { AllocationDialog } from './allocation-dialog'
import { DeallocateDialog } from './deallocate-dialog'

const routeApi = getRouteApi('/_app/assets/allocations')

type Dialog =
  { type: 'allocate' | 'filters' } | { type: 'view' | 'deallocate'; row: AllocationRow } | null

const columns: DataTableColumn<AllocationRow>[] = [
  { id: 'company', header: 'Company', cell: (row) => row.company },
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'asset', header: 'Asset', cell: (row) => row.asset },
  { id: 'number', header: 'Identification Number', cell: (row) => row.identificationNumber },
  {
    id: 'allocated',
    header: 'Allocation Date',
    align: 'center',
    cell: (row) => (
      <span className="block max-w-28 whitespace-normal">{formatLong(row.allocationDate)}</span>
    ),
  },
  {
    id: 'deallocated',
    header: 'Deallocation Date',
    align: 'center',
    cell: (row) =>
      row.deallocationDate ? (
        <span className="block max-w-28 whitespace-normal">{formatLong(row.deallocationDate)}</span>
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
  const lookups = useAssetLookups()
  const [filters, setFilters] = useFilters('asset-allocations')
  const [dialog, setDialog] = useState<Dialog>(null)
  const list = useAllocations({
    page,
    pageSize: ASSET_PAGE_SIZE,
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
  const data = lookups.data
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employee',
      options: (data?.employees ?? []).map((person) => ({
        value: person.id,
        label: person.name,
        hint: person.code,
      })),
    },
    {
      kind: 'select',
      key: 'assetTypeId',
      label: 'Asset Type',
      placeholder: 'Select an Option',
      options: (data?.assetTypes ?? []).map((type) => ({ value: type.id, label: type.name })),
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
      options: (data?.assets ?? []).map((asset) => ({
        value: asset.id,
        label: `${asset.name} (${asset.identificationNumber})`,
        hint: asset.code,
      })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  const close = () => {
    setDialog(null)
  }

  return (
    <PayrollCard
      title="Asset Allocations"
      actions={
        <>
          <Button
            onClick={() => {
              setDialog({ type: 'allocate' })
            }}
            className={cn(toolbarButton, btn.blue, 'min-w-24')}
          >
            Allocate
          </Button>
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
            label={`Actions for ${row.asset} (${row.identificationNumber}), ${row.employee.name}`}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
              ...(row.status === 'allocated'
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
          preset="asset-allocations"
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
