import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Switch } from '@/components/ui/switch'

import { LEAVES_PAGE_SIZE, POLICY_LEVEL_LABELS } from '../../constants'
import { useDeleteLeavePolicy, useLeavePolicies, useSaveLeavePolicy } from '../../hooks/use-leaves'
import { leavePolicyInput } from '../../schemas/leave-forms.schema'
import type { LeavePolicy } from '../../types/leaves.types'
import { serial } from '../../utils/format'
import { leaveTableClass, listSwitchClass } from '../../utils/styles'
import { EditPencilIcon } from '../leave-icons'
import { EnrollEmployeesDialog, LeavePolicyDialog } from './leave-policy-dialogs'

const routeApi = getRouteApi('/_app/leaves/settings/policies')

/**
 * Settings → Leave Policies (frame 4428:90410): Sr#., Leave Policy, Enroll
 * Employee (how many people the policy covers; on an employee level policy it
 * opens Enroll Employee), Policy Level, the Leave Policy and Status switches,
 * and the pencil in Actions. "+ Add New" in the title row opens Add Policy.
 */
export function LeavePoliciesPage() {
  const { page, dialog } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [editing, setEditing] = useState<LeavePolicy | null>(null)
  const [enrolling, setEnrolling] = useState<LeavePolicy | null>(null)
  const [deleting, setDeleting] = useState<LeavePolicy | null>(null)
  const list = useLeavePolicies({ page, pageSize: LEAVES_PAGE_SIZE })
  const save = useSaveLeavePolicy()
  const remove = useDeleteLeavePolicy()
  const closeAdd = () => {
    void navigate({ search: (prev) => ({ ...prev, dialog: undefined }) })
  }
  const toggle = (row: LeavePolicy, patch: Partial<LeavePolicy>) => {
    save.mutate({ id: row.id, input: { ...leavePolicyInput(row), ...patch } })
  }

  const columns: DataTableColumn<LeavePolicy>[] = [
    {
      id: 'serial',
      header: 'Sr#.',
      mobile: 'hidden',
      cell: (_row, index) => serial(list.data?.meta.page ?? page, LEAVES_PAGE_SIZE, index),
    },
    { id: 'title', header: 'Leave Policy', mobile: 'heading', cell: (row) => row.title },
    {
      id: 'enrolled',
      header: 'Enroll Employee',
      cell: (row) =>
        row.level === 'employee' ? (
          <button
            type="button"
            aria-label={`Enroll employees in ${row.title} (${String(row.enrolledCount)} enrolled)`}
            onClick={() => {
              setEnrolling(row)
            }}
            className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {String(row.enrolledCount)}
          </button>
        ) : (
          String(row.enrolledCount)
        ),
    },
    { id: 'level', header: 'Policy Level', cell: (row) => POLICY_LEVEL_LABELS[row.level] },
    {
      id: 'enforced',
      header: 'Leave Policy',
      cell: (row) => (
        <Switch
          aria-label={`${row.title} in force`}
          checked={row.enforced}
          disabled={save.isPending}
          onCheckedChange={(checked) => {
            toggle(row, { enforced: checked })
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
    <section aria-label="Leave Policies" className="grid gap-4">
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
          caption="Leave Policy"
          className={leaveTableClass}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          rowActionsHeader="Actions"
          emptyState={<p className="py-10 text-center text-sm text-grey">No policies yet.</p>}
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

      {dialog === 'add' && <LeavePolicyDialog mode="create" policy={null} onClose={closeAdd} />}
      {editing && (
        <LeavePolicyDialog
          mode="edit"
          policy={editing}
          onClose={() => {
            setEditing(null)
          }}
          onDelete={() => {
            setDeleting(editing)
          }}
        />
      )}
      {enrolling && (
        <EnrollEmployeesDialog
          policy={enrolling}
          onClose={() => {
            setEnrolling(null)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={deleting ? `Delete ${deleting.title}` : 'Delete'}
        description="Are you sure you want to Delete this?"
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
