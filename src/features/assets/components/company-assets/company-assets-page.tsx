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
import { cn } from '@/lib/utils'

import { ASSET_PAGE_SIZE, ASSET_STATUS_META } from '../../constants'
import {
  useAssetLookups,
  useAssets,
  useDeleteAsset,
  useSetAssetActive,
} from '../../hooks/use-assets'
import { ASSET_STATUSES, type AssetRow } from '../../types/assets.types'
import { AssetDialog } from './asset-dialog'
import { AssetHistoryDialog } from './asset-history-dialog'
import { AssetImportButton } from './asset-import-button'

const routeApi = getRouteApi('/_app/assets/company-assets')

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'history' | 'delete'; row: AssetRow }
  | null

const columns: DataTableColumn<AssetRow>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => row.name },
  {
    id: 'number',
    header: 'Identification Number',
    cell: (row) => row.identificationNumber,
  },
  {
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (row) => <StatusChip {...ASSET_STATUS_META[row.status]} />,
  },
]

/**
 * Company Assets: Code, Name, Identification Number and Status, with Create,
 * Import File and Filters; each row's menu has Edit, View, Delete, History and
 * Deactivate (Activate once it is unavailable).
 */
export function CompanyAssetsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const lookups = useAssetLookups()
  const [filters, setFilters] = useFilters('company-assets')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteAsset()
  const setActive = useSetAssetActive()
  const list = useAssets({
    page,
    pageSize: ASSET_PAGE_SIZE,
    status: filters.status,
    name: filters.name,
    code: filters.code,
    identificationNumber: filters.identificationNumber,
    assetTypeId: filters.assetTypeId,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'status',
      label: 'Asset Status',
      placeholder: 'Select Asset Status',
      options: ASSET_STATUSES.map((status) => ({
        value: status,
        label: ASSET_STATUS_META[status].label,
      })),
    },
    { kind: 'text', key: 'name', label: 'Name', placeholder: 'Asset name' },
    { kind: 'text', key: 'code', label: 'Code', placeholder: 'AST-00001' },
    { kind: 'text', key: 'identificationNumber', label: 'Identification Number' },
    {
      kind: 'select',
      key: 'assetTypeId',
      label: 'Asset Type',
      placeholder: 'Select Asset Type',
      options: (lookups.data?.assetTypes ?? []).map((type) => ({
        value: type.id,
        label: type.name,
      })),
    },
  ]
  const close = () => {
    setDialog(null)
  }
  const failed = (fallback: string) => (error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : fallback)
  }

  return (
    <PayrollCard
      title="Company Assets"
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
          <AssetImportButton />
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
        caption="Company assets"
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
              {
                label: 'History',
                onSelect: () => {
                  setDialog({ type: 'history', row })
                },
              },
              row.status === 'unavailable'
                ? {
                    label: 'Activate',
                    onSelect: () => {
                      setActive.mutate(
                        { id: row.id, active: true },
                        { onError: failed('Could not activate the asset.') },
                      )
                    },
                  }
                : {
                    label: 'Deactivate',
                    onSelect: () => {
                      setActive.mutate(
                        { id: row.id, active: false },
                        { onError: failed('Could not deactivate the asset.') },
                      )
                    },
                  },
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="assets"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <AssetDialog id={null} mode="create" onClose={close} />}
      {dialog?.type === 'edit' && <AssetDialog id={dialog.row.id} mode="edit" onClose={close} />}
      {dialog?.type === 'view' && (
        <AssetDialog
          id={dialog.row.id}
          mode="view"
          onClose={close}
          onHistory={() => {
            setDialog({ type: 'history', row: dialog.row })
          }}
        />
      )}
      {dialog?.type === 'history' && (
        <AssetHistoryDialog assetId={dialog.row.id} assetName={dialog.row.name} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="company-assets"
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
        title="Delete asset"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type === 'delete') {
            remove.mutate(dialog.row.id, { onError: failed('Could not delete the asset.') })
          }
        }}
      />
    </PayrollCard>
  )
}
