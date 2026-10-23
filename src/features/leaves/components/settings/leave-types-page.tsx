import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Switch } from '@/components/ui/switch'

import { LEAVES_PAGE_SIZE } from '../../constants'
import { useDeleteLeaveType, useLeaveTypes, useSaveLeaveType } from '../../hooks/use-leaves'
import { leaveTypeInput } from '../../schemas/leave-forms.schema'
import type { LeaveType } from '../../types/leaves.types'
import { balanceDays, serial } from '../../utils/format'
import { leaveTableClass, listSwitchClass } from '../../utils/styles'
import { EditPencilIcon } from '../leave-icons'
import { LeaveTypeDialog } from './leave-type-dialog'

const routeApi = getRouteApi('/_app/leaves/settings/leave-types')

/**
 * Settings → Leave Types (frame 4428:90291): the list under the tabs with
 * Sr#., Type, No. of Leaves, Leave Encashment and Status as navy switches,
 * and the pencil in Actions that opens the type; "+ Add New" in the title row
 * opens "Add Leave Types". A type in use cannot be deleted.
 */
export function LeaveTypesPage() {
  const { page, dialog } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [editing, setEditing] = useState<LeaveType | null>(null)
  const [deleting, setDeleting] = useState<LeaveType | null>(null)
  const list = useLeaveTypes({ page, pageSize: LEAVES_PAGE_SIZE })
  const save = useSaveLeaveType()
  const remove = useDeleteLeaveType()
  const closeAdd = () => {
    void navigate({ search: (prev) => ({ ...prev, dialog: undefined }) })
  }
  const toggle = (row: LeaveType, patch: Partial<LeaveType>) => {
    save.mutate({ id: row.id, input: { ...leaveTypeInput(row), ...patch } })
  }

  const columns: DataTableColumn<LeaveType>[] = [
    {
      id: 'serial',
      header: 'Sr#.',
      mobile: 'hidden',
      cell: (_row, index) => serial(list.data?.meta.page ?? page, LEAVES_PAGE_SIZE, index),
    },
    { id: 'type', header: 'Type', mobile: 'heading', cell: (row) => row.title },
    { id: 'leaves', header: 'No. of Leaves', cell: (row) => balanceDays(row.leavesAllowed) },
    {
      id: 'encashment',
      header: 'Leave Encashment',
      cell: (row) => (
        <Switch
          aria-label={`Leave encashment for ${row.title}`}
          checked={row.encashment}
          disabled={save.isPending}
          onCheckedChange={(checked) => {
            toggle(row, { encashment: checked })
          }}
          className={listSwitchClass}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <Switch
          aria-label={`Status of ${row.title}`}
          checked={row.active}
          disabled={save.isPending}
          onCheckedChange={(checked) => {
            toggle(row, { active: checked })
          }}
          className={listSwitchClass}
        />
      ),
    },
  ]

  return (
    <section aria-label="Leave Types" className="grid gap-4">
      {list.error && !list.data ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => {
            void list.refetch()
          }}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          getRowId={(row) => row.id}
          caption="Leave Types"
          className={leaveTableClass}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          rowActionsHeader="Actions"
          emptyState={<p className="py-10 text-center text-sm text-grey">No leave types yet.</p>}
          rowActions={(row) => (
            <button
              type="button"
              aria-label={`Edit ${row.title}`}
              onClick={() => {
                setEditing(row)
              }}
              className="inline-flex size-7 items-center justify-center rounded-sm text-sidebar outline-none hover:bg-sidebar/10 focus-visible:ring-2 focus-visible:ring-ring/50 dark:text-heading"
            >
              <EditPencilIcon className="size-5" />
            </button>
          )}
        />
      )}
      {list.data && list.data.meta.total > 0 && (
        <Pagination
          page={list.data.meta.page}
          totalPages={list.data.meta.totalPages}
          disabled={list.isFetching}
          onPageChange={(next) => {
            void navigate({ search: (prev) => ({ ...prev, page: next }) })
          }}
          className="justify-end"
        />
      )}

      {dialog === 'add' && <LeaveTypeDialog mode="create" type={null} onClose={closeAdd} />}
      {editing && (
        <LeaveTypeDialog
          mode="edit"
          type={editing}
          onClose={() => {
            setEditing(null)
          }}
          onDelete={() => {
            setDeleting(editing)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={deleting ? `Delete ${deleting.title}` : 'Delete'}
        description={
          deleting && deleting.inUse > 0
            ? `${deleting.title} is used by ${String(deleting.inUse)} leave application${deleting.inUse === 1 ? '' : 's'}; the server will refuse this. Are you sure you want to Delete this?`
            : 'Are you sure you want to Delete this?'
        }
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSuccess: () => {
                setEditing(null)
              },
              onSettled: () => {
                setDeleting(null)
              },
            })
          }
        }}
      />
    </section>
  )
}
