import { useState } from 'react'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import {
  activeCount,
  ConfirmAction,
  type FilterField,
  FiltersButton,
  FiltersDialog,
  ListFooter,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  StatusChip,
  useFilters,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'

import { useAuthorities, useDeleteAuthority } from '../../hooks/use-request-settings'
import {
  DELEGATION_STATUS_META,
  FLOW_AUTHORITY_LABELS,
  SETTINGS_PAGE_SIZE,
} from '../../settings.constants'
import type { RequestAuthority } from '../../types/request-settings.types'
import { employeeFilterField } from '../shared/request-employee'
import { AuthorityDialog } from './authority-dialog'
import { AUTHORITY_OPTIONS, REQUEST_TYPE_OPTIONS } from './settings-helpers'
import { CreateButton, PersonWithCode } from './settings-parts'

type Dialog =
  { type: 'create' | 'filters' } | { type: 'edit' | 'delete'; row: RequestAuthority } | null

/**
 * Authorities (`/requests/settings/authorities`): who holds HR Manager,
 * Finance Manager, IT Administrator … — for every request type, branch and
 * department, or for one of each. A flow's authority node goes to the holder
 * that matches the request (the FRD's "assign an authority to an employee").
 */
export function AuthoritiesPanel() {
  const canCreate = useCan('requests.settings.authorities.create')
  const canEdit = useCan('requests.settings.authorities.edit')
  const canDelete = useCan('requests.settings.authorities.delete')
  const [filters, setFilters] = useFilters('request-authorities')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteAuthority()
  const list = useAuthorities({
    page,
    pageSize: SETTINGS_PAGE_SIZE,
    authority: filters.authority,
    requestType: filters.requestType,
    employeeId: filters.employeeId,
  })
  const rows = list.data?.data ?? []
  const close = () => {
    setDialog(null)
  }
  const describe = (row: RequestAuthority) =>
    `${FLOW_AUTHORITY_LABELS[row.authority]} held by ${row.employeeName ?? row.employeeCode}`

  const columns: DataTableColumn<RequestAuthority>[] = [
    {
      id: 'authority',
      header: 'Authority',
      mobile: 'heading',
      cell: (row) => FLOW_AUTHORITY_LABELS[row.authority],
    },
    {
      id: 'employee',
      header: 'Employee',
      cell: (row) => (
        <PersonWithCode
          person={{ id: row.employeeId, name: row.employeeName ?? '—', code: row.employeeCode }}
        />
      ),
    },
    { id: 'type', header: 'Request Type', cell: (row) => row.requestTypeName ?? 'All types' },
    { id: 'branch', header: 'Branch', cell: (row) => row.branchName ?? 'All branches' },
    {
      id: 'department',
      header: 'Department',
      cell: (row) => row.departmentName ?? 'All departments',
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

  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'authority',
      label: 'Authority',
      placeholder: 'Select Authority',
      options: AUTHORITY_OPTIONS,
    },
    {
      kind: 'select',
      key: 'requestType',
      label: 'Request Type',
      placeholder: 'Select Request Type',
      options: REQUEST_TYPE_OPTIONS,
    },
    employeeFilterField('requests.settings.authorities.view'),
  ]

  return (
    <PayrollCard
      title="Authorities"
      actions={
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
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        caption="Authorities"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
        rowActionsHeader="Actions"
        rowActions={(row) =>
          canEdit || canDelete ? (
            <RowActionsMenu
              itemClassName={rowMenuItemClass.inter}
              label={`Actions for ${describe(row)}`}
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
          ) : null
        }
      />
      <ListFooter
        meta={list.data?.meta}
        noun="authorities"
        disabled={list.isFetching}
        onPageChange={setPage}
      />

      {dialog?.type === 'create' && <AuthorityDialog authority={null} onClose={close} />}
      {dialog?.type === 'edit' && <AuthorityDialog authority={dialog.row} onClose={close} />}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="request-authorities"
          onApply={(next) => {
            setFilters(next)
            setPage(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete authority"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(dialog.row, {
            onError: (error) => {
              toast.error(
                error instanceof ApiError ? error.message : 'Could not delete the authority.',
              )
            },
          })
        }}
      />
    </PayrollCard>
  )
}
