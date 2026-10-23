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
import { cn } from '@/lib/utils'

import {
  useDelegations,
  useRequestSettingsLookups,
  useSetDelegationsActive,
} from '../../hooks/use-request-settings'
import {
  DELEGATION_STATUS_META,
  MAROON_BUTTON,
  SETTINGS_PAGE_SIZE,
  SETTINGS_REQUEST_TYPE_LABELS,
} from '../../settings.constants'
import type { RequestDelegationRow } from '../../types/request-settings.types'
import { DelegationDialog } from './delegation-dialog'
import { REQUEST_TYPE_OPTIONS, useTicks } from './settings-helpers'
import { CreateButton } from './settings-parts'

const routeApi = getRouteApi('/_app/requests/settings/delegation')

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'bulk'; active: boolean }
  | { type: 'view' | 'toggle'; row: RequestDelegationRow }
  | null

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'In Active' },
]

/**
 * Delegations: whose approvals pass to whom, per request type. Tick rows to
 * make several Active or In Active at once.
 */
export function DelegationsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const lookups = useRequestSettingsLookups()
  const [filters, setFilters] = useFilters('request-delegations')
  const [dialog, setDialog] = useState<Dialog>(null)
  const { ticked, setTicked, toggle, clear } = useTicks()
  const setActive = useSetDelegationsActive()
  const list = useDelegations({
    page,
    pageSize: SETTINGS_PAGE_SIZE,
    delegatorId: filters.delegatorId,
    delegateeId: filters.delegateeId,
    status: filters.status,
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
  const describe = (row: RequestDelegationRow) =>
    `${row.delegator.name}'s ${SETTINGS_REQUEST_TYPE_LABELS[row.requestType]} delegation`

  const change = (ids: string[], active: boolean) => {
    setActive.mutate(
      { ids, active },
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

  const columns: DataTableColumn<RequestDelegationRow>[] = [
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
    { id: 'delegator', header: 'Delegator', mobile: 'heading', cell: (row) => row.delegator.name },
    { id: 'delegatee', header: 'Delegatee', cell: (row) => row.delegatee.name },
    { id: 'type', header: 'Type', cell: (row) => SETTINGS_REQUEST_TYPE_LABELS[row.requestType] },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="block max-w-56 truncate" title={row.description}>
          {row.description || '—'}
        </span>
      ),
    },
    {
      id: 'active',
      header: 'Active',
      align: 'center',
      cell: (row) => <StatusChip {...DELEGATION_STATUS_META[row.active ? 'active' : 'inactive']} />,
    },
  ]

  const people = (lookups.data?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'delegatorId',
      label: 'Delegator',
      placeholder: 'Select Delegator',
      options: people,
    },
    {
      kind: 'select',
      key: 'delegateeId',
      label: 'Delegatee',
      placeholder: 'Select Delegatee',
      options: people,
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select an Option',
      options: STATUS_OPTIONS,
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
        ticked.size > 0 ? (
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
              In Active
            </Button>
          </>
        ) : (
          <>
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
              {
                label: row.active ? 'Disable' : 'Enable',
                onSelect: () => {
                  setDialog({ type: 'toggle', row })
                },
              },
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
              : dialog?.type === 'toggle' && !dialog.row.active
          )
            ? 'Make the delegations active'
            : 'Make the delegations in active'
        }
        message="Are you sure you want to Perform this action?"
        onConfirm={() => {
          if (dialog?.type === 'bulk') change([...ticked], dialog.active)
          if (dialog?.type === 'toggle') change([dialog.row.id], !dialog.row.active)
        }}
      />
    </PayrollCard>
  )
}
