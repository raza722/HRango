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

import { ASSET_AVAILABILITY_META, ASSET_PAGE_SIZE, ASSET_STATUS_LABELS } from '../../constants'
import {
  useAssets,
  useAssetTypeOptions,
  useDeleteAsset,
  useSetAssetActive,
} from '../../hooks/use-assets'
import { type Asset, ASSET_AVAILABILITIES, ASSET_STATUSES } from '../../types/assets.types'
import { AssetDialog } from './asset-dialog'
import { AssetHistoryDialog } from './asset-history-dialog'

const routeApi = getRouteApi('/_app/assets/company-assets')

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'history' | 'delete'; row: Asset }
  | null

const columns: DataTableColumn<Asset>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => row.name },
  {
    id: 'number',
    header: 'Identification Number',
    cell: (row) => row.identificationNo ?? '—',
  },
  {
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (row) => <StatusChip {...ASSET_AVAILABILITY_META[row.availability]} />,
  },
]

/**
 * Company Assets: Code, Name, Identification Number and Status (available /
 * allocated / unavailable), with Create and Filters; each row's menu has Edit,
 * View, Delete, History and Deactivate (Activate once it is not active).
 */
export function CompanyAssetsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const types = useAssetTypeOptions()
  const [filters, setFilters] = useFilters('company-assets-v2')
  const canCreate = useCan('assets.company_assets.create')
  const canEdit = useCan('assets.company_assets.edit')
  const canDelete = useCan('assets.company_assets.delete')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteAsset()
  const setActive = useSetAssetActive()
  const list = useAssets({
    page,
    pageSize: ASSET_PAGE_SIZE,
    q: filters.q,
    availability: filters.availability,
    status: filters.status,
    assetTypeId: filters.assetTypeId,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'availability',
      label: 'Availability',
      placeholder: 'Select Availability',
      options: ASSET_AVAILABILITIES.map((value) => ({
        value,
        label: ASSET_AVAILABILITY_META[value].label,
      })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Asset Status',
      placeholder: 'Select Asset Status',
      options: ASSET_STATUSES.map((value) => ({ value, label: ASSET_STATUS_LABELS[value] })),
    },
    {
      kind: 'text',
      key: 'q',
      label: 'Search',
      placeholder: 'Name, code or identification number',
    },
    {
      kind: 'select',
      key: 'assetTypeId',
      label: 'Asset Type',
      placeholder: 'Select Asset Type',
      options: (types.data ?? []).map((type) => ({ value: type.id, label: type.name })),
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
              ...(canDelete
                ? [
                    {
                      label: 'Delete',
                      variant: 'destructive' as const,
                      onSelect: () => {
                        setDialog({ type: 'delete', row })
                      },
                    },
                  ]
                : []),
              {
                label: 'History',
                onSelect: () => {
                  setDialog({ type: 'history', row })
                },
              },
              ...(canEdit
                ? [
                    row.status === 'active'
                      ? {
                          label: 'Deactivate',
                          onSelect: () => {
                            setActive.mutate(
                              { record: row, active: false },
                              { onError: failed('Could not deactivate the asset.') },
                            )
                          },
                        }
                      : {
                          label: 'Activate',
                          onSelect: () => {
                            setActive.mutate(
                              { record: row, active: true },
                              { onError: failed('Could not activate the asset.') },
                            )
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
          preset="company-assets-v2"
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
            remove.mutate(dialog.row, { onError: failed('Could not delete the asset.') })
          }
        }}
      />
    </PayrollCard>
  )
}
