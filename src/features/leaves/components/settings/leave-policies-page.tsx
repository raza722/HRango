import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Switch } from '@/components/ui/switch'
import { useCan } from '@/lib/permissions'

import {
  LEAVE_CODES,
  LEAVES_PAGE_SIZE,
  POLICY_KIND_LABELS,
  POLICY_LEVEL_LABELS,
} from '../../constants'
import { useDeleteLeavePolicy, useLeavePolicies, useSaveLeavePolicy } from '../../hooks/use-leaves'
import { leavePolicyInput } from '../../schemas/leave-forms.schema'
import type { LeavePolicy } from '../../types/leaves.types'
import { balanceDays, serial } from '../../utils/format'
import { leaveTableClass, listSwitchClass } from '../../utils/styles'
import { EditPencilIcon } from '../leave-icons'
import { EnrollEmployeesDialog, LeavePolicyDialog } from './leave-policy-dialogs'

const routeApi = getRouteApi('/_app/leaves/settings/policies')

/**
 * Settings → Leave Policies (frame 4428:90410, `/leaves/policies`): Sr#., Leave Policy, the
 * policy kind, No. of Leaves (what its leave types add up to), Enroll Employee (how many
 * people the policy covers; on an employee level policy it opens Enroll Employee), Policy
 * Level, the Status switch and the pencil in Actions. "+ Add New" in the title row opens
 * Add Policy. Buttons follow `leaves.settings.policies.*`.
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
  const canCreate = useCan(LEAVE_CODES.policiesCreate)
  const canEdit = useCan(LEAVE_CODES.policiesEdit)
  const canDelete = useCan(LEAVE_CODES.policiesDelete)
  const canEnroll = useCan(LEAVE_CODES.policiesEnroll)
  const closeAdd = () => {
    void navigate({ search: (prev) => ({ ...prev, dialog: undefined }) })
  }
  const toggle = (row: LeavePolicy, patch: { isActive: boolean }) => {
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
      id: 'kind',
      header: 'Policy',
      cell: (row) => (
        <span className="whitespace-nowrap">{POLICY_KIND_LABELS[row.policyKind]}</span>
      ),
    },
    {
      id: 'leaves',
      header: 'No. of Leaves',
      cell: (row) => (row.policyKind === 'distribution' ? balanceDays(row.totalLeaves) : '—'),
    },
    {
      id: 'enrolled',
      header: 'Enroll Employee',
      cell: (row) =>
        row.policyLevel === 'employee' && canEnroll ? (
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
    { id: 'level', header: 'Policy Level', cell: (row) => POLICY_LEVEL_LABELS[row.policyLevel] },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <Switch
          aria-label={`Status of ${row.title}`}
          checked={row.isActive}
          disabled={save.isPending || !canEdit}
          onCheckedChange={(checked) => {
            toggle(row, { isActive: checked })
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
          rowActions={(row) =>
            canEdit && (
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
            )
          }
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

      {dialog === 'add' && canCreate && (
        <LeavePolicyDialog mode="create" policy={null} onClose={closeAdd} />
      )}
      {editing && (
        <LeavePolicyDialog
          mode="edit"
          policy={editing}
          onClose={() => {
            setEditing(null)
          }}
          onDelete={
            canDelete
              ? () => {
                  setDeleting(editing)
                }
              : undefined
          }
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
            remove.mutate(
              { id: deleting.id, rowVersion: deleting.rowVersion },
              {
                onSuccess: () => {
                  setEditing(null)
                },
                onSettled: () => {
                  setDeleting(null)
                },
              },
            )
          }
        }}
      />
    </section>
  )
}
