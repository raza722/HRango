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
import {
  activeCount,
  btn,
  ConfirmAction,
  type FilterField,
  FiltersButton,
  FiltersDialog,
  ListFooter,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  StatusChip,
  toolbarButton,
  useFilters,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ASSET_PAGE_SIZE, ASSET_TYPE_STATUS_META } from '../../constants'
import { useAssetTypes, useDeleteAssetType, useSetAssetTypeActive } from '../../hooks/use-assets'
import type { AssetType } from '../../types/assets.types'
import { AssetTypeDialog } from './asset-type-dialog'

const routeApi = getRouteApi('/_app/assets/types')

type Dialog =
  { type: 'create' | 'filters' } | { type: 'edit' | 'view' | 'delete'; row: AssetType } | null

const columns: DataTableColumn<AssetType>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => row.name },
  {
    id: 'description',
    header: 'Description',
    className: 'whitespace-normal',
    cell: (row) => <span className="line-clamp-2 max-w-72">{row.description ?? '—'}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (row) => <StatusChip {...ASSET_TYPE_STATUS_META[row.isActive ? 'active' : 'inactive']} />,
  },
]

const FIELDS: FilterField[] = [
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    placeholder: 'Select an Option',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  { kind: 'text', key: 'q', label: 'Search', placeholder: 'Name or code' },
]

/**
 * Asset Types: Code, Name, Description and Status; Create, Filters and Edit / View, Deactivate
 * (Activate) and Delete (only for a type no asset uses: one in use is deactivated instead).
 */
export function AssetTypesPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filters, setFilters] = useFilters('asset-types-v2')
  const canCreate = useCan('assets.types.create')
  const canEdit = useCan('assets.types.edit')
  const canDelete = useCan('assets.types.delete')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteAssetType()
  const setActive = useSetAssetTypeActive()
  const list = useAssetTypes({
    page,
    pageSize: ASSET_PAGE_SIZE,
    q: filters.q,
    isActive: filters.status ? filters.status === 'active' : undefined,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const close = () => {
    setDialog(null)
  }

  return (
    <PayrollCard
      title="Asset Types"
      actions={
        <>
          {canCreate && (
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButton, btn.blue, 'min-w-24')}
            >
              Create
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
        caption="Asset types"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActionsHeader="Actions"
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.code}, ${row.name}`}
            actions={[
              ...(canEdit
                ? [
                    {
                      label: 'Edit',
                      onSelect: () => {
                        setDialog({ type: 'edit', row })
                      },
                    },
                  ]
                : []),
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
              ...(canEdit
                ? [
                    {
                      label: row.isActive ? 'Deactivate' : 'Activate',
                      onSelect: () => {
                        setActive.mutate(
                          { record: row, active: !row.isActive },
                          {
                            onError: (error) => {
                              toast.error(
                                error instanceof ApiError
                                  ? error.message
                                  : 'Could not change the asset type.',
                              )
                            },
                          },
                        )
                      },
                    },
                  ]
                : []),
              // A type in use cannot be deleted: Deactivate above retires it instead.
              ...(canDelete
                ? [
                    {
                      label:
                        row.assetCount > 0
                          ? `Delete (used by ${String(row.assetCount)} ${row.assetCount === 1 ? 'asset' : 'assets'})`
                          : 'Delete',
                      variant: 'destructive' as const,
                      disabled: row.assetCount > 0,
                      onSelect: () => {
                        setDialog({ type: 'delete', row })
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
        noun="asset types"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <AssetTypeDialog id={null} mode="create" onClose={close} />}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <AssetTypeDialog id={dialog.row.id} mode={dialog.type} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={FIELDS}
          value={filters}
          preset="asset-types-v2"
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
        title="Delete asset type"
        message={`Delete the asset type ${dialog?.type === 'delete' ? `“${dialog.row.name}”` : ''}? This cannot be undone.`}
        onConfirm={() => {
          if (dialog?.type === 'delete') {
            remove.mutate(dialog.row, {
              onError: (error) => {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not delete the asset type.',
                )
              },
            })
          }
        }}
      />
    </PayrollCard>
  )
}
