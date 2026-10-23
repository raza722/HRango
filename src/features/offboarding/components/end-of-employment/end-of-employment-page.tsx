import { useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { format } from 'date-fns'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { assetsApi, ClearanceFormDialog, type ClearancePrefillProps } from '@/features/assets'
import {
  activeCount,
  btn,
  ConfirmAction,
  downloadText,
  type FilterField,
  FiltersButton,
  FiltersDialog,
  formatWeekday,
  ListFooter,
  NoRecord,
  parseCsv,
  PayrollCard,
  payrollTableClass,
  PersonCell,
  StatusChip,
  toBoolean,
  toCsv,
  toolbarButton,
  useFilters,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { EOE_SCOPE_LABELS, EOE_STATUS_META, OFFBOARDING_PAGE_SIZE } from '../../constants'
import {
  useDeleteEndOfEmployment,
  useEndOfEmployments,
  useImportEndOfEmployments,
  useOffboardingLookups,
} from '../../hooks/use-offboarding'
import type {
  EndOfEmploymentDetail,
  EndOfEmploymentRow,
  EoeScope,
} from '../../types/offboarding.types'
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

const IMPORT_HEADER = [
  'Employee Code',
  'Reason',
  'Last Working Date',
  'Notice Period',
  'Final Settlement',
  'Asset Clearance',
] as const

const day = (iso: string) => formatWeekday(iso.slice(0, 10))

const columns: DataTableColumn<EndOfEmploymentRow>[] = [
  {
    id: 'employee',
    header: 'Employee',
    mobile: 'heading',
    cell: (row) => <PersonCell person={row.employee} />,
  },
  { id: 'branch', header: 'Branch', cell: (row) => row.branch ?? '—' },
  { id: 'location', header: 'Location', cell: (row) => row.location ?? '—' },
  { id: 'department', header: 'Department', cell: (row) => row.department },
  { id: 'designation', header: 'Designation', cell: (row) => row.designation },
  { id: 'date', header: 'Date', cell: (row) => formatWeekday(row.date) },
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

/**
 * End of Employment (All / Completed / Pending in the sidebar): who is
 * leaving, and whether their settlement, clearance and checklist are done.
 */
export function EndOfEmploymentPage({ scope }: { scope: EoeScope }) {
  const route = ROUTES[scope]
  const { page } = route.useSearch()
  const navigate = route.useNavigate()
  const lookups = useOffboardingLookups()
  const [filters, setFilters] = useFilters('end-of-employment')
  const [dialog, setDialog] = useState<Dialog>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const remove = useDeleteEndOfEmployment()
  const importFile = useImportEndOfEmployments()
  const list = useEndOfEmployments({
    page,
    pageSize: OFFBOARDING_PAGE_SIZE,
    scope,
    locationId: filters.locationId,
    branchId: filters.branchId,
    department: filters.department,
    employeeId: filters.employeeId,
    designation: filters.designation,
    status: filters.status,
    noticePeriod: filters.noticePeriod,
    from: filters.from,
    to: filters.to,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const close = () => {
    setDialog(null)
  }
  const data = lookups.data
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'locationId',
      label: 'Location',
      placeholder: 'Select Location',
      options: (data?.locations ?? []).map((item) => ({ value: item.id, label: item.name })),
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: (data?.branches ?? []).map((item) => ({ value: item.id, label: item.name })),
    },
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: (data?.departments ?? []).map((value) => ({ value, label: value })),
    },
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employee',
      options: (data?.employees ?? []).map((item) => ({
        value: item.id,
        label: item.name,
        hint: item.code,
      })),
    },
    {
      kind: 'select',
      key: 'designation',
      label: 'Designation',
      placeholder: 'Select Designation',
      options: (data?.designations ?? []).map((value) => ({ value, label: value })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'completed', label: 'Completed' },
      ],
    },
    {
      kind: 'select',
      key: 'noticePeriod',
      label: 'Notice Period',
      placeholder: 'Notice Period',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]

  const downloadSample = () => {
    const code = data?.employees.find((item) => item.status === 'active')?.code ?? 'RI-00001'
    downloadText(
      toCsv(IMPORT_HEADER, [
        [code, 'Resignation', format(new Date(), 'yyyy-MM-dd'), 'Yes', 'Yes', 'No'],
      ]),
      'end-of-employment-sample.csv',
    )
  }

  const importText = async (text: string) => {
    const rows = parseCsv(text, 'employee').map((cells) => ({
      employeeCode: cells[0] ?? '',
      reason: cells[1] ?? '',
      lastWorkingDate: cells[2] ?? '',
      noticePeriod: toBoolean(cells[3]),
      finalSettlement: toBoolean(cells[4]),
      assetClearance: toBoolean(cells[5]),
    }))
    if (rows.length === 0) {
      toast.error('The file has no rows.', {
        action: { label: 'Sample file', onClick: downloadSample },
      })
      return
    }
    try {
      const result = await importFile.mutateAsync(rows)
      if (result.errors.length > 0) {
        toast.error(result.errors.slice(0, 3).join('\n'), {
          description: `Columns: ${IMPORT_HEADER.join(', ')}`,
          action: { label: 'Sample file', onClick: downloadSample },
        })
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The file could not be imported.')
    }
  }

  /** Asset Clearance ticked: open the person's clearance form next, filled in with what they hold. */
  const afterSave = (record: EndOfEmploymentDetail) => {
    if (!record.assetClearance || record.clearanceId) return
    void assetsApi
      .clearancePrefill(record.employeeId)
      .then((prefill) => {
        if (prefill.lines.length === 0) {
          toast.info(`${record.card.name} holds no company assets; nothing to clear.`)
          return
        }
        setDialog({
          type: 'clearance',
          prefill: {
            employeeId: record.employeeId,
            endOfEmploymentId: record.id,
            clearanceDate: record.lastWorkingDate ?? format(new Date(), 'yyyy-MM-dd'),
          },
        })
      })
      .catch(() => {
        toast.error('The clearance form could not be opened.')
      })
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
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={cn(toolbarButton, btn.blue, 'min-w-28')}
          >
            Create
          </Button>
          <Button
            disabled={importFile.isPending}
            onClick={() => fileInput.current?.click()}
            className={cn(toolbarButton, btn.green, 'min-w-24')}
          >
            Import File
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            aria-label="Import File (CSV)"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void file.text().then(importText)
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
            label={`Actions for ${row.employee.name}`}
            actions={
              row.status === 'pending'
                ? [
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
                  ]
                : [
                    {
                      label: 'View',
                      onSelect: () => {
                        setDialog({ type: 'view', row })
                      },
                    },
                    ...(row.rehired
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
          preset="end-of-employment"
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
          remove.mutate(dialog.row.id, {
            onError: (error) => {
              toast.error(
                error instanceof ApiError ? error.message : 'Could not delete the record.',
              )
            },
          })
        }}
      />
    </PayrollCard>
  )
}
