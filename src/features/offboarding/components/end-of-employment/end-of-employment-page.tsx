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
  assetsApi,
  ClearanceFormDialog,
  type ClearancePrefillProps,
  useOrgLookup,
} from '@/features/assets'
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

import { EOE_SCOPE_LABELS, EOE_STATUS_META, OFFBOARDING_PAGE_SIZE } from '../../constants'
import {
  useCompleteEndOfEmployment,
  useDeleteEndOfEmployment,
  useEndOfEmployments,
} from '../../hooks/use-offboarding'
import type { EndOfEmployment, EndOfEmploymentRow, EoeScope } from '../../types/offboarding.types'
import { EndOfEmploymentDialog } from './end-of-employment-dialog'
import { RehireDialog } from './rehire-dialog'

const ROUTES = {
  all: getRouteApi('/_app/end-of-employment/all'),
  completed: getRouteApi('/_app/end-of-employment/completed'),
  pending: getRouteApi('/_app/end-of-employment/pending'),
} as const

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete' | 'rehire'; row: EndOfEmploymentRow }
  | { type: 'clearance'; prefill: ClearancePrefillProps }
  | null

const day = (iso: string) => formatWeekday(iso.slice(0, 10))
const nameOf = (row: EndOfEmploymentRow) => row.employeeName ?? row.employeeCode ?? row.employeeId

const columns: DataTableColumn<EndOfEmploymentRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={{ name: nameOf(row), photoUrl: null }} />,
  },
  { id: 'branch', header: 'Branch', cell: (row) => row.branchName ?? '—' },
  { id: 'location', header: 'Location', cell: (row) => row.locationName ?? '—' },
  { id: 'department', header: 'Department', cell: (row) => row.departmentName ?? '—' },
  { id: 'designation', header: 'Designation', cell: (row) => row.designationName ?? '—' },
  { id: 'date', header: 'Date', cell: (row) => formatWeekday(row.lastWorkingDate) },
  { id: 'created', header: 'Creation Date', cell: (row) => day(row.createdAt) },
  {
    id: 'completed',
    header: 'Completion Date',
    cell: (row) => (row.completedAt ? day(row.completedAt) : ''),
  },
  {
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (row) => <StatusChip {...EOE_STATUS_META[row.status]} />,
  },
]

const orgOptions = (items: readonly { id: string; name: string }[] | undefined) =>
  (items ?? []).map((item) => ({ value: item.id, label: item.name }))

/**
 * End of Employment (All / Completed / Pending in the sidebar): who is
 * leaving, and whether their settlement, clearance and checklist are done.
 */
export function EndOfEmploymentPage({ scope }: { scope: EoeScope }) {
  const route = ROUTES[scope]
  const { page } = route.useSearch()
  const navigate = route.useNavigate()
  const canCreate = useCan('offboarding.end_of_employment.create')
  const canEdit = useCan('offboarding.end_of_employment.edit')
  const canDelete = useCan('offboarding.end_of_employment.delete')
  const canRehire = useCan('offboarding.rehire.process')
  const canClear = useCan('assets.clearance.create')
  const [filters, setFilters] = useFilters('end-of-employment-v2')
  const [dialog, setDialog] = useState<Dialog>(null)
  const locations = useOrgLookup('locations')
  const branches = useOrgLookup('branches')
  const departments = useOrgLookup('departments')
  const designations = useOrgLookup('designations')
  const remove = useDeleteEndOfEmployment()
  const complete = useCompleteEndOfEmployment()
  const list = useEndOfEmployments({
    page,
    pageSize: OFFBOARDING_PAGE_SIZE,
    q: filters.q,
    status: scope === 'all' ? filters.status : scope,
    locationId: filters.locationId,
    branchId: filters.branchId,
    departmentId: filters.departmentId,
    employeeId: filters.employeeId,
    designationId: filters.designationId,
    serveNotice: filters.serveNotice ? filters.serveNotice === 'yes' : undefined,
    from: filters.from,
    to: filters.to,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const close = () => {
    setDialog(null)
  }
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'locationId',
      label: 'Location',
      placeholder: 'Select Location',
      options: orgOptions(locations.data),
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: orgOptions(branches.data),
    },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: orgOptions(departments.data),
    },
    {
      kind: 'employee',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employee',
      filters: { permission: 'offboarding.end_of_employment.view', includeInactive: true },
      // The listed people, so a saved filter keeps its name before the lookup reads them.
      known: (list.data?.data ?? []).map((row) => ({
        value: row.employeeId,
        label: row.employeeName ?? row.employeeId,
      })),
    },
    {
      kind: 'select',
      key: 'designationId',
      label: 'Designation',
      placeholder: 'Select Designation',
      options: orgOptions(designations.data),
    },
    ...(scope === 'all'
      ? [
          {
            kind: 'select' as const,
            key: 'status',
            label: 'Status',
            placeholder: 'Select Status',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'completed', label: 'Completed' },
            ],
          },
        ]
      : []),
    {
      kind: 'select',
      key: 'serveNotice',
      label: 'Notice Period',
      placeholder: 'Notice Period',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
    { kind: 'text', key: 'q', label: 'Search', placeholder: 'Employee name or code' },
  ]

  /** Asset Clearance ticked: open the person's clearance form next, filled in with what they hold. */
  const afterSave = (record: EndOfEmployment) => {
    if (!record.needsAssetClearance || record.clearanceId || !canClear) return
    const name = record.employeeName ?? 'This employee'
    void assetsApi
      .clearancePrefill(record.employeeId)
      .then((prefill) => {
        if (prefill.items.length === 0) {
          toast.info(`${name} holds no company assets; nothing to clear.`)
          return
        }
        setDialog({
          type: 'clearance',
          prefill: {
            employeeId: record.employeeId,
            endOfEmploymentId: record.id,
            clearanceDate: record.lastWorkingDate,
          },
        })
      })
      .catch(() => {
        toast.error('The clearance form could not be opened.')
      })
  }

  const failed = (fallback: string) => (error: unknown) => {
    toast.error(error instanceof ApiError ? error.message : fallback)
  }

  return (
    <PayrollCard
      title={
        <>
          End of Employment
          {scope !== 'all' && <span className="sr-only"> ({EOE_SCOPE_LABELS[scope]})</span>}
        </>
      }
      actions={
        <>
          {canCreate && (
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButton, btn.blue, 'min-w-28')}
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
        caption="End of employment records"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActionsHeader="Action"
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${nameOf(row)}`}
            actions={
              row.status === 'pending'
                ? [
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
                            label: 'Complete',
                            onSelect: () => {
                              complete.mutate(row, {
                                onError: failed('Could not complete the record.'),
                              })
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
                  ]
                : [
                    {
                      label: 'View',
                      onSelect: () => {
                        setDialog({ type: 'view', row })
                      },
                    },
                    ...(row.isRehired || !canRehire
                      ? []
                      : [
                          {
                            label: 'Rehire',
                            onSelect: () => {
                              setDialog({ type: 'rehire', row })
                            },
                          },
                        ]),
                  ]
            }
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="records"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && (
        <EndOfEmploymentDialog id={null} mode="create" onClose={close} onSaved={afterSave} />
      )}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <EndOfEmploymentDialog
          id={dialog.row.id}
          mode={dialog.type}
          onClose={close}
          onSaved={afterSave}
        />
      )}
      {dialog?.type === 'rehire' && <RehireDialog id={dialog.row.id} onClose={close} />}
      {dialog?.type === 'clearance' && (
        <ClearanceFormDialog id={null} mode="create" prefill={dialog.prefill} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="end-of-employment-v2"
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
        title="Delete end of employment record"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(dialog.row, { onError: failed('Could not delete the record.') })
        }}
      />
    </PayrollCard>
  )
}
