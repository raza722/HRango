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
  formatWeekday,
  ListFooter,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  PersonCell,
  StatusChip,
  toolbarButton,
  useFilters,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { useOrgLookup } from '../../api/lookups.api'
import { ASSET_PAGE_SIZE, CLEARANCE_STATUS_META } from '../../constants'
import { useClearances, useDeleteClearance, useSetClearancesApproved } from '../../hooks/use-assets'
import { CLEARANCE_STATUSES, type ClearanceRow } from '../../types/assets.types'
import { ClearanceFormDialog } from './clearance-form-dialog'

const routeApi = getRouteApi('/_app/assets/clearance-form')

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'approve' | 'unapprove' }
  | { type: 'edit' | 'view' | 'delete'; row: ClearanceRow }
  | null

/** The bulk buttons under Create / Filters, as drawn: navy Approved, maroon Unapproved. */
const bulk = {
  approved: 'bg-[#17263A] text-white hover:bg-[#17263A]/90 dark:bg-primary',
  unapproved: 'bg-[#7B254A] text-white hover:bg-[#7B254A]/90',
}

const nameOf = (row: ClearanceRow) => row.employeeName ?? row.employeeCode ?? row.employeeId

/**
 * Asset Clearance Form: who is handing assets back, and whether HR has
 * approved it. Tick rows, then Approved / Unapproved.
 */
export function ClearanceFormsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const departments = useOrgLookup('departments')
  const canCreate = useCan('assets.clearance.create')
  const canEdit = useCan('assets.clearance.edit')
  const canDelete = useCan('assets.clearance.delete')
  const canApprove = useCan('assets.clearance.approve')
  const [filters, setFilters] = useFilters('asset-clearance-v2')
  const [dialog, setDialog] = useState<Dialog>(null)
  /** Ticked forms, with the rowVersion they were listed with. */
  const [selected, setSelected] = useState<ReadonlyMap<string, string>>(new Map())
  const remove = useDeleteClearance()
  const setApproved = useSetClearancesApproved()
  const list = useClearances({
    page,
    pageSize: ASSET_PAGE_SIZE,
    q: filters.q,
    status: filters.status,
    departmentId: filters.departmentId,
  })
  const rows = list.data?.data ?? []

  const goTo = (next: number) => {
    setSelected(new Map())
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const close = () => {
    setDialog(null)
  }
  const toggle = (row: ClearanceRow, on: boolean) => {
    setSelected((current) => {
      const next = new Map(current)
      if (on) next.set(row.id, row.rowVersion)
      else next.delete(row.id)
      return next
    })
  }
  const allTicked = rows.length > 0 && rows.every((row) => selected.has(row.id))

  const columns: DataTableColumn<ClearanceRow>[] = [
    ...(canApprove
      ? [
          {
            id: 'select',
            header: (
              <Checkbox
                tone="navy"
                aria-label="Select all clearance forms on this page"
                checked={allTicked}
                disabled={rows.length === 0}
                onCheckedChange={(checked) => {
                  setSelected(
                    checked === true
                      ? new Map(rows.map((row) => [row.id, row.rowVersion]))
                      : new Map(),
                  )
                }}
              />
            ),
            className: 'w-10',
            mobile: 'hidden' as const,
            cell: (row: ClearanceRow) => (
              <Checkbox
                tone="navy"
                aria-label={`Select ${nameOf(row)}'s clearance form`}
                checked={selected.has(row.id)}
                onCheckedChange={(checked) => {
                  toggle(row, checked === true)
                }}
              />
            ),
          },
        ]
      : []),
    { id: 'code', header: 'Employee ID', cell: (row) => row.employeeCode ?? '—' },
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) => (
        <span className="flex items-center gap-2">
          {canApprove && (
            <Checkbox
              tone="navy"
              aria-hidden="true"
              tabIndex={-1}
              checked={selected.has(row.id)}
              onCheckedChange={(checked) => {
                toggle(row, checked === true)
              }}
              className="md:hidden"
            />
          )}
          <PersonCell person={{ name: nameOf(row), photoUrl: null }} />
        </span>
      ),
    },
    {
      id: 'department',
      header: 'Department',
      cell: (row) => (
        <span className="block max-w-32 whitespace-normal">{row.departmentName ?? '—'}</span>
      ),
    },
    { id: 'date', header: 'Clearance Date', cell: (row) => formatWeekday(row.clearanceDate) },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <StatusChip {...CLEARANCE_STATUS_META[row.status]} />,
    },
  ]

  const fields: FilterField[] = [
    { kind: 'text', key: 'q', label: 'Search', placeholder: 'Employee ID or name' },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: CLEARANCE_STATUSES.map((value) => ({
        value,
        label: CLEARANCE_STATUS_META[value].label,
      })),
    },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: (departments.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    },
  ]

  const runBulk = (approved: boolean) => {
    const forms = [...selected].map(([id, rowVersion]) => ({ id, rowVersion }))
    setApproved.mutate(
      { forms, approved },
      {
        onSuccess: () => {
          setSelected(new Map())
        },
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'The forms could not be updated.')
        },
      },
    )
  }

  const askBulk = (type: 'approve' | 'unapprove') => {
    if (selected.size === 0) {
      toast.error('Tick the clearance forms first.')
      return
    }
    setDialog({ type })
  }

  return (
    <PayrollCard
      title="Asset Clearance Form"
      actions={
        <div className="grid justify-items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2.5">
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
          </div>
          {canApprove && (
            <div className="flex flex-wrap justify-end gap-1">
              <Button
                disabled={setApproved.isPending}
                onClick={() => {
                  askBulk('approve')
                }}
                className={cn(toolbarButton, bulk.approved, 'px-3 text-sm')}
              >
                Approved
              </Button>
              <Button
                disabled={setApproved.isPending}
                onClick={() => {
                  askBulk('unapprove')
                }}
                className={cn(toolbarButton, bulk.unapproved, 'px-4 text-sm')}
              >
                Unapproved
              </Button>
            </div>
          )}
        </div>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption="Asset clearance forms"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActionsHeader="Action"
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${nameOf(row)}'s clearance form`}
            actions={[
              ...(row.status === 'in_progress' && canEdit
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
              // An approved form is final (the server refuses to delete it), as for Edit.
              ...(row.status === 'in_progress' && canDelete
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
        noun="clearance forms"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <ClearanceFormDialog id={null} mode="create" onClose={close} />}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <ClearanceFormDialog id={dialog.row.id} mode={dialog.type} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="asset-clearance-v2"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'approve' || dialog?.type === 'unapprove'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={
          dialog?.type === 'unapprove' ? 'Unapprove clearance forms' : 'Approve clearance forms'
        }
        message={`${dialog?.type === 'unapprove' ? 'Unapprove' : 'Approve'} ${String(selected.size)} clearance ${selected.size === 1 ? 'form' : 'forms'}?`}
        onConfirm={() => {
          runBulk(dialog?.type === 'approve')
        }}
      />
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete clearance form"
        message={`Delete the clearance form of ${dialog?.type === 'delete' ? (dialog.row.employeeName ?? 'this employee') : 'this employee'}?`}
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(dialog.row, {
            onError: (error) => {
              toast.error(
                error instanceof ApiError ? error.message : 'Could not delete the clearance form.',
              )
            },
          })
        }}
      />
    </PayrollCard>
  )
}
