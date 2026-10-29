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
import { Checkbox } from '@/components/ui/checkbox'
import {
  activeCount,
  btn,
  ConfirmAction,
  type FilterField,
  FiltersButton,
  FiltersDialog,
  formatLong,
  ListFooter,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  toolbarButton,
  useFilters,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { useDeleteRestrictions, useRestrictions } from '../../hooks/use-request-settings'
import { SETTINGS_PAGE_SIZE } from '../../settings.constants'
import type { RequestRestriction } from '../../types/request-settings.types'
import { RestrictionDialog } from './restriction-dialog'
import { REQUEST_TYPE_OPTIONS, useTicks } from './settings-helpers'
import { CreateButton } from './settings-parts'

const routeApi = getRouteApi('/_app/requests/settings/restrictions')

type Dialog =
  | { type: 'create' | 'filters' | 'bulk-delete' }
  | { type: 'view' | 'edit' | 'delete'; row: RequestRestriction }
  | null

/**
 * Request Restriction: request types closed for the company between two
 * dates (`/requests/settings/restrictions`). Tick rows to delete several at
 * once (deleted one by one). A request whose dates touch the period is refused.
 */
export function RestrictionsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan('requests.settings.restrictions.create')
  const canEdit = useCan('requests.settings.restrictions.edit')
  const canDelete = useCan('requests.settings.restrictions.delete')
  const [filters, setFilters] = useFilters('request-restrictions')
  const [dialog, setDialog] = useState<Dialog>(null)
  const { ticked, setTicked, toggle, clear } = useTicks()
  const remove = useDeleteRestrictions()
  const list = useRestrictions({
    page,
    pageSize: SETTINGS_PAGE_SIZE,
    requestType: filters.requestType,
    startFrom: filters.startFrom,
    startTo: filters.startTo,
    endFrom: filters.endFrom,
    endTo: filters.endTo,
  })
  const rows = list.data?.data ?? []

  const goTo = (next: number) => {
    clear()
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const close = () => {
    setDialog(null)
  }
  const tickedCount = rows.filter((row) => ticked.has(row.id)).length
  const allTicked = rows.length > 0 && rows.every((row) => ticked.has(row.id))

  const deleteRows = (picked: readonly RequestRestriction[]) => {
    remove.mutate(picked, {
      onSuccess: () => {
        clear()
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'Could not delete the restriction.')
      },
    })
  }

  const columns: DataTableColumn<RequestRestriction>[] = [
    {
      id: 'select',
      header: (
        <Checkbox
          tone="navy"
          aria-label="Select all restrictions on this page"
          checked={allTicked}
          disabled={rows.length === 0}
          onCheckedChange={(checked) => {
            setTicked(checked === true ? new Set(rows.map((row) => row.id)) : new Set())
          }}
        />
      ),
      className: 'w-10',
      mobile: 'hidden',
      cell: (row) => (
        <Checkbox
          tone="navy"
          aria-label={`Select the restriction from ${formatLong(row.startDate)}`}
          checked={ticked.has(row.id)}
          onCheckedChange={(checked) => {
            toggle(row.id, checked === true)
          }}
        />
      ),
    },
    { id: 'company', header: 'Company', cell: (row) => row.companyName },
    { id: 'type', header: 'Request Type', mobile: 'heading', cell: (row) => row.requestTypeName },
    { id: 'start', header: 'Start Date', cell: (row) => formatLong(row.startDate) },
    { id: 'end', header: 'End Date', cell: (row) => formatLong(row.endDate) },
  ]

  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'requestType',
      label: 'Request Types',
      placeholder: 'Select Request Types',
      options: REQUEST_TYPE_OPTIONS,
    },
    { kind: 'date', key: 'startFrom', label: 'Start Date From' },
    { kind: 'date', key: 'startTo', label: 'Start Date To' },
    { kind: 'date', key: 'endFrom', label: 'End Date From' },
    { kind: 'date', key: 'endTo', label: 'End Date To' },
  ]

  return (
    <PayrollCard
      title="Request Restriction"
      actions={
        <>
          {canDelete && ticked.size > 0 && (
            <Button
              disabled={remove.isPending}
              onClick={() => {
                setDialog({ type: 'bulk-delete' })
              }}
              className={cn(toolbarButton, btn.red)}
            >
              Delete
            </Button>
          )}
          {canCreate && (
            <CreateButton
              onClick={() => {
                setDialog({ type: 'create' })
              }}
            />
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
        data={rows}
        getRowId={(row) => row.id}
        caption="Request restrictions"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActionsHeader="Actions"
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for the restriction from ${formatLong(row.startDate)}`}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
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
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="restrictions"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <RestrictionDialog id={null} onClose={close} />}
      {dialog?.type === 'view' && <RestrictionDialog id={dialog.row.id} onClose={close} />}
      {dialog?.type === 'edit' && <RestrictionDialog id={dialog.row.id} edit onClose={close} />}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="request-restrictions"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'delete' || dialog?.type === 'bulk-delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={
          dialog?.type === 'bulk-delete' ? 'Delete the ticked restrictions' : 'Delete restriction'
        }
        message={
          dialog?.type === 'bulk-delete'
            ? `Are you sure you want to delete the ${String(tickedCount)} ticked ${tickedCount === 1 ? 'restriction' : 'restrictions'}?`
            : 'Are you sure you want to delete this restriction?'
        }
        onConfirm={() => {
          if (dialog?.type === 'delete') deleteRows([dialog.row])
          if (dialog?.type === 'bulk-delete') deleteRows(rows.filter((row) => ticked.has(row.id)))
        }}
      />
    </PayrollCard>
  )
}
