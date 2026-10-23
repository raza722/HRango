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
import { cn } from '@/lib/utils'

import {
  useDeleteRestrictions,
  useRequestSettingsLookups,
  useRestrictions,
} from '../../hooks/use-request-settings'
import { SETTINGS_PAGE_SIZE } from '../../settings.constants'
import type { RequestRestrictionRow } from '../../types/request-settings.types'
import { RestrictionDialog } from './restriction-dialog'
import { REQUEST_TYPE_OPTIONS, useTicks } from './settings-helpers'
import { CreateButton } from './settings-parts'

const routeApi = getRouteApi('/_app/requests/settings/restrictions')

type Dialog =
  | { type: 'create' | 'filters' | 'bulk-delete' }
  | { type: 'view' | 'delete'; row: RequestRestrictionRow }
  | null

/**
 * Request Restriction: request types closed for a company between two
 * dates. Tick rows to delete several at once.
 */
export function RestrictionsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const lookups = useRequestSettingsLookups()
  const [filters, setFilters] = useFilters('request-restrictions')
  const [dialog, setDialog] = useState<Dialog>(null)
  const { ticked, setTicked, toggle, clear } = useTicks()
  const remove = useDeleteRestrictions()
  const list = useRestrictions({
    page,
    pageSize: SETTINGS_PAGE_SIZE,
    companyId: filters.companyId,
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
  const allTicked = rows.length > 0 && rows.every((row) => ticked.has(row.id))

  const deleteRows = (ids: string[]) => {
    remove.mutate(ids, {
      onSuccess: () => {
        clear()
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'Could not delete the restriction.')
      },
    })
  }

  const columns: DataTableColumn<RequestRestrictionRow>[] = [
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
    { id: 'company', header: 'Company', mobile: 'heading', cell: (row) => row.company },
    { id: 'start', header: 'Start Date', cell: (row) => formatLong(row.startDate) },
    { id: 'end', header: 'End Date', cell: (row) => formatLong(row.endDate) },
  ]

  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'companyId',
      label: 'Company',
      placeholder: 'Select Company',
      options: (lookups.data?.companies ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    },
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
          {ticked.size > 0 && (
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
          <CreateButton
            onClick={() => {
              setDialog({ type: 'create' })
            }}
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
              {
                label: 'Delete',
                variant: 'destructive' as const,
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
        noun="restrictions"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <RestrictionDialog id={null} onClose={close} />}
      {dialog?.type === 'view' && <RestrictionDialog id={dialog.row.id} onClose={close} />}
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
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type === 'delete') deleteRows([dialog.row.id])
          if (dialog?.type === 'bulk-delete') deleteRows([...ticked])
        }}
      />
    </PayrollCard>
  )
}
