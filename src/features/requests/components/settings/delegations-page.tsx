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

import {
  useDelegations,
  useDeleteDelegations,
  useSetDelegationsActive,
} from '../../hooks/use-request-settings'
import { DELEGATION_STATUS_META, MAROON_BUTTON, SETTINGS_PAGE_SIZE } from '../../settings.constants'
import type { RequestDelegation } from '../../types/request-settings.types'
import { DelegationDialog } from './delegation-dialog'
import { ACTIVE_OPTIONS, REQUEST_TYPE_OPTIONS, useTicks } from './settings-helpers'
import { CreateButton } from './settings-parts'

const routeApi = getRouteApi('/_app/requests/settings/delegation')

type Dialog =
  | { type: 'create' | 'filters' | 'bulk-delete' }
  | { type: 'bulk'; active: boolean }
  | { type: 'view' | 'toggle' | 'delete'; row: RequestDelegation }
  | null

/**
 * Delegations (`/requests/settings/delegations`): whose approvals pass to
 * whom, per request type. Tick rows to make several Active or Inactive at
 * once (PATCHed one by one). There are no start / end dates.
 */
export function DelegationsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan('requests.settings.delegations.create')
  const canEdit = useCan('requests.settings.delegations.edit')
  const canDelete = useCan('requests.settings.delegations.delete')
  const remove = useDeleteDelegations()
  const [filters, setFilters] = useFilters('request-delegations')
  const [dialog, setDialog] = useState<Dialog>(null)
  const { ticked, setTicked, toggle, clear } = useTicks()
  const setActive = useSetDelegationsActive()
  const list = useDelegations({
    page,
    pageSize: SETTINGS_PAGE_SIZE,
    delegatorId: filters.delegatorId,
    delegateeId: filters.delegateeId,
    isActive: filters.isActive,
    requestType: filters.requestType,
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
  const describe = (row: RequestDelegation) =>
    `${row.delegatorName ?? 'Unknown'}'s ${row.requestTypeName} delegation`

  const change = (picked: readonly RequestDelegation[], active: boolean) => {
    setActive.mutate(
      { rows: picked, active },
      {
        onSuccess: () => {
          clear()
        },
        onError: (error) => {
          toast.error(
            error instanceof ApiError ? error.message : 'The delegations could not be changed.',
          )
        },
      },
    )
  }

  const deleteRows = (picked: readonly RequestDelegation[]) => {
    remove.mutate(picked, {
      onSuccess: () => {
        clear()
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'Could not delete the delegation.')
      },
    })
  }

  const columns: DataTableColumn<RequestDelegation>[] = [
    {
      id: 'select',
      header: (
        <Checkbox
          tone="navy"
          aria-label="Select all delegations on this page"
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
          aria-label={`Select ${describe(row)}`}
          checked={ticked.has(row.id)}
          onCheckedChange={(checked) => {
            toggle(row.id, checked === true)
          }}
        />
      ),
    },
    {
      id: 'delegator',
      header: 'Delegator',
      mobile: 'heading',
      cell: (row) => row.delegatorName ?? '—',
    },
    { id: 'delegatee', header: 'Delegatee', cell: (row) => row.delegateeName ?? '—' },
    { id: 'type', header: 'Type', cell: (row) => row.requestTypeName },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="block max-w-56 truncate" title={row.description ?? undefined}>
          {row.description === null || row.description === '' ? '—' : row.description}
        </span>
      ),
    },
    {
      id: 'active',
      header: 'Active',
      align: 'center',
      cell: (row) => (
        <StatusChip {...DELEGATION_STATUS_META[row.isActive ? 'active' : 'inactive']} />
      ),
    },
  ]

  // People from `GET /employees/lookup` (searched on the server, paged), former staff too.
  const people = { permission: 'requests.settings.delegations.view', includeInactive: true }
  const fields: FilterField[] = [
    {
      kind: 'employee',
      key: 'delegatorId',
      label: 'Delegator',
      placeholder: 'Select Delegator',
      filters: people,
    },
    {
      kind: 'employee',
      key: 'delegateeId',
      label: 'Delegatee',
      placeholder: 'Select Delegatee',
      filters: people,
    },
    {
      kind: 'select',
      key: 'isActive',
      label: 'Status',
      placeholder: 'Select an Option',
      options: ACTIVE_OPTIONS,
    },
    {
      kind: 'select',
      key: 'requestType',
      label: 'Delegation Types',
      placeholder: 'Select Request Types',
      options: REQUEST_TYPE_OPTIONS,
    },
  ]

  return (
    <PayrollCard
      title="Delegations"
      actions={
        (canEdit || canDelete) && ticked.size > 0 ? (
          <>
            {canDelete && (
              <Button
                disabled={remove.isPending}
                onClick={() => {
                  setDialog({ type: 'bulk-delete' })
                }}
                className={cn(toolbarButton, btn.red, 'min-w-20 text-sm')}
              >
                Delete
              </Button>
            )}
            {canEdit && (
              <>
                <Button
                  disabled={setActive.isPending}
                  onClick={() => {
                    setDialog({ type: 'bulk', active: true })
                  }}
                  className={cn(toolbarButton, btn.navy, 'min-w-20 text-sm')}
                >
                  Active
                </Button>
                <Button
                  disabled={setActive.isPending}
                  onClick={() => {
                    setDialog({ type: 'bulk', active: false })
                  }}
                  className={cn(toolbarButton, MAROON_BUTTON, 'min-w-20 text-sm')}
                >
                  Inactive
                </Button>
              </>
            )}
          </>
        ) : (
          <>
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
        )
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption="Delegations"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActionsHeader="Actions"
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${describe(row)}`}
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
                      label: row.isActive ? 'Disable' : 'Enable',
                      onSelect: () => {
                        setDialog({ type: 'toggle', row })
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
        noun="delegations"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <DelegationDialog id={null} onClose={close} />}
      {dialog?.type === 'view' && <DelegationDialog id={dialog.row.id} onClose={close} />}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="request-delegations"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'bulk' || dialog?.type === 'toggle'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={
          (
            dialog?.type === 'bulk'
              ? dialog.active
              : dialog?.type === 'toggle' && !dialog.row.isActive
          )
            ? 'Make the delegations active'
            : 'Make the delegations inactive'
        }
        message={
          (
            dialog?.type === 'bulk'
              ? dialog.active
              : dialog?.type === 'toggle' && !dialog.row.isActive
          )
            ? 'Make the delegations active? Their approvals pass to the delegatee again.'
            : 'Make the delegations inactive? Their approvals stop passing to the delegatee.'
        }
        onConfirm={() => {
          if (dialog?.type === 'bulk') {
            change(
              rows.filter((row) => ticked.has(row.id)),
              dialog.active,
            )
          }
          if (dialog?.type === 'toggle') change([dialog.row], !dialog.row.isActive)
        }}
      />
      <ConfirmAction
        open={dialog?.type === 'delete' || dialog?.type === 'bulk-delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={
          dialog?.type === 'bulk-delete' ? 'Delete the ticked delegations' : 'Delete delegation'
        }
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type === 'delete') deleteRows([dialog.row])
          if (dialog?.type === 'bulk-delete') deleteRows(rows.filter((row) => ticked.has(row.id)))
        }}
      />
    </PayrollCard>
  )
}
