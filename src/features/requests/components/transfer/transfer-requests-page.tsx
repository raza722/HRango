import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { AppDialog } from '@/components/feedback/app-dialog'
import { DataTable, Pagination, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  activeCount,
  btn,
  ConfirmAction,
  type FilterField,
  FiltersDialog,
  type FilterValues,
  footerButton,
  toolbarButton,
  useFilters,
} from '@/features/payroll'
import { cn } from '@/lib/utils'

import { typePermission } from '../../api/backend'
import { ACTION_LABELS, REQUEST_PAGE_SIZE, TRANSFER_STATUS_META } from '../../constants'
import {
  permits,
  useApprovalList,
  useBulkDecide,
  useRequestList,
  useRequestPermissions,
  useTransferLookups,
} from '../../hooks/use-requests'
import type { RequestSearch } from '../../routing'
import {
  REQUEST_STATUSES,
  type RequestAction,
  type RequestFilters,
  type RequestPage,
  type TransferRequest,
} from '../../types/requests.types'
import {
  CancelRequestDialog,
  DeleteRequestDialog,
  ForwardRequestDialog,
  RequestFlowDialog,
  RequestHistoryDialog,
} from '../dialogs/request-dialogs'
import { RequestTabs } from '../shared/request-controls'
import { employeeFilterField } from '../shared/request-employee'
import { createButtonText, requestTitleClass, transferTableClass } from '../shared/request-styles'
import { selectColumn, transferApprovalColumns, transferRequestColumns } from './transfer-columns'
import { TransferDecisionDialog } from './transfer-decision-dialog'
import { ApprovalPills, BulkButtons, FilterButton, TransferStatusTabs } from './transfer-parts'
import { TransferRequestDialog } from './transfer-request-dialog'
import { bulkButton } from './transfer-styles'

const routeApi = getRouteApi('/_app/requests/transfer')

type Dialog =
  | { type: 'create' | 'filters' | 'approve' | 'unapprove' }
  | {
      type:
        'edit' | 'view' | 'decide' | 'review' | 'flow' | 'history' | 'cancel' | 'delete' | 'forward'
      request: TransferRequest
    }
  | null

/** Requests tab: pending requests can be edited, deleted or withdrawn; decided ones have History and Cancel. */
const REQUEST_ACTIONS: readonly RequestAction[] = ['edit', 'view', 'delete', 'history', 'cancel']
/** Approvals: Approve/Reject, Flow, View, as drawn; Forward passes the step on. */
const APPROVAL_ACTIONS: readonly RequestAction[] = ['decide', 'forward', 'flow', 'view']

/** The filters the API reads (`from` / `to` match the effective date). */
const FILTER_KEYS = [
  'q',
  'employeeId',
  'locationId',
  'branchId',
  'departmentId',
  'delegatorId',
  'from',
  'to',
] as const

const toFilters = (values: FilterValues): RequestFilters =>
  Object.fromEntries(FILTER_KEYS.map((key) => [key, values[key]]))

const statusOf = (value: string | undefined) => REQUEST_STATUSES.find((status) => status === value)

/** "Unapproved": the ticked requests are rejected with one reason. */
function UnapproveDialog({
  count,
  pending,
  onConfirm,
  onClose,
}: {
  count: number
  pending: boolean
  onConfirm: (remarks: string) => void
  onClose: () => void
}) {
  const [remarks, setRemarks] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <AppDialog
      title="Unapprove requests"
      description={`${String(count)} ticked request${count === 1 ? '' : 's'} will be rejected.`}
      onRequestClose={onClose}
      className="max-w-xl"
      footer={
        <>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!remarks.trim()) {
                setError('Give a reason for rejecting')
                return
              }
              onConfirm(remarks.trim())
            }}
            className={cn(footerButton, bulkButton.unapproved)}
          >
            Unapprove
          </Button>
          <Button type="button" onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <label htmlFor="transfer-unapprove-reason" className="font-inter text-base text-heading">
          Reason
          <span aria-hidden="true" className="ml-1 text-[#D80027] dark:text-destructive">
            *
          </span>
        </label>
        <Textarea
          id="transfer-unapprove-reason"
          rows={3}
          maxLength={500}
          value={remarks}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'transfer-unapprove-error' : undefined}
          onChange={(event) => {
            setRemarks(event.target.value)
            if (error) setError(null)
          }}
        />
        {error && (
          <p id="transfer-unapprove-error" role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}

/**
 * Transfer: Requests (everyone's transfer requests, Filter, Create, and
 * Approved / Unapproved for the ticked ones) and Approvals (Requested,
 * Delegates) with Approve/Reject, Flow and View.
 */
export function TransferRequestsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const can = useRequestPermissions('transfer')
  const lookups = useTransferLookups()
  const bulk = useBulkDecide()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [requestFilters, setRequestFilters] = useFilters('transfer-requests')
  const [requestedFilters, setRequestedFilters] = useFilters('transfer-requested')
  const [delegateFilters, setDelegateFilters] = useFilters('transfer-delegates')

  const isRequest = search.tab === 'request' || !can.approvals
  // Transfer's Approvals: Requested, Delegates and Cancellations (no consent steps are drawn).
  const view =
    search.view === 'delegates' || search.view === 'cancellations' ? search.view : 'requested'
  const status = search.status
  const update = (patch: Partial<RequestSearch>) => {
    setSelected(new Set())
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const requests = useRequestList('transfer', {
    scope: 'all',
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    status,
    filters: toFilters(requestFilters),
  })
  const approvals = useApprovalList('transfer', {
    view,
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    status,
    filters: toFilters(view === 'delegates' ? delegateFilters : requestedFilters),
  })
  const list = isRequest ? requests : approvals
  const page: RequestPage<TransferRequest> | undefined = list.data
  const rows = page?.data ?? []
  const filters = isRequest
    ? requestFilters
    : view === 'delegates'
      ? delegateFilters
      : requestedFilters
  const setFilters = isRequest
    ? setRequestFilters
    : view === 'delegates'
      ? setDelegateFilters
      : setRequestedFilters

  const permission = typePermission('transfer', 'create')
  const statusField: FilterField = {
    kind: 'select',
    key: 'status',
    label: 'Status',
    placeholder: view === 'delegates' && !isRequest ? 'Select an Option' : 'Select Status',
    options: REQUEST_STATUSES.map((value) => ({
      value,
      label: TRANSFER_STATUS_META[value].label,
    })),
  }
  const placeFields: FilterField[] = [
    { kind: 'text', key: 'q', label: 'Search', placeholder: 'Code or employee' },
    employeeFilterField(permission),
    {
      kind: 'select',
      key: 'locationId',
      label: 'Location',
      placeholder: 'Select Location',
      options: (lookups.data?.locations ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    },
    {
      kind: 'select',
      key: 'branchId',
      label: 'Branch',
      placeholder: 'Select Branch',
      options: (lookups.data?.branches ?? []).map((item) => ({
        value: item.id,
        label: item.name,
        hint: lookups.data?.locations.find((location) => location.id === item.locationId)?.name,
      })),
    },
    {
      kind: 'select',
      key: 'departmentId',
      label: 'Department',
      placeholder: 'Select Department',
      options: (lookups.data?.departments ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    },
    { kind: 'date', key: 'from', label: 'Effective From' },
    { kind: 'date', key: 'to', label: 'Effective To' },
    statusField,
  ]
  const delegateFields: FilterField[] = [
    employeeFilterField(permission),
    statusField,
    employeeFilterField(permission, {
      key: 'delegatorId',
      label: 'Delegator',
      placeholder: 'Select Delegator',
    }),
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]

  const decidable = rows.filter((row) => selected.has(row.id) && row.actions.includes('decide'))
  const askBulk = (type: 'approve' | 'unapprove') => {
    if (decidable.length === 0) {
      toast.error('Tick the requests waiting for your decision first.')
      return
    }
    setDialog({ type })
  }
  const runBulk = (decision: 'approve' | 'reject', remarks: string) => {
    bulk.mutate(
      {
        items: decidable.map((row) => ({ id: row.id, rowVersion: row.rowVersion })),
        decision,
        remarks,
      },
      {
        onSuccess: ({ done, failed }) => {
          const verb = decision === 'approve' ? 'approved' : 'rejected'
          toast.success(
            `${String(done)} request${done === 1 ? '' : 's'} ${verb}${failed > 0 ? `; ${String(failed)} could not be` : ''}`,
          )
          setSelected(new Set())
          setDialog(null)
        },
        onError: (failure) => {
          toast.error(failure.message || 'The requests could not be updated.')
        },
      },
    )
  }

  const allowed = isRequest ? REQUEST_ACTIONS : APPROVAL_ACTIONS
  const close = () => {
    setDialog(null)
  }
  const meta = page?.meta

  return (
    <section
      aria-labelledby="transfer-heading"
      className="overflow-hidden rounded-xl bg-card shadow-xs"
    >
      <h1 id="transfer-heading" className="sr-only">
        Transfer {isRequest ? 'Requests' : 'Approvals'}
      </h1>
      <RequestTabs
        value={isRequest ? 'request' : 'approvals'}
        approvals={can.approvals}
        onChange={(tab) => {
          update({ tab, page: 1, status: undefined })
        }}
      />
      <div className="grid gap-4 px-4 pt-6 pb-5 sm:px-6">
        {isRequest ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className={requestTitleClass}>Transfer Request</h2>
              <div className="flex flex-wrap gap-2.5">
                <FilterButton
                  count={activeCount(requestFilters)}
                  onClick={() => {
                    setDialog({ type: 'filters' })
                  }}
                />
                {can.create && (
                  <Button
                    onClick={() => {
                      setDialog({ type: 'create' })
                    }}
                    className={cn(toolbarButton, btn.navy, 'min-w-24 gap-1', createButtonText)}
                  >
                    <Plus aria-hidden="true" className="size-3.5" /> Create
                  </Button>
                )}
              </div>
            </div>
            <h3 className="text-sm font-medium text-sidebar dark:text-heading">All Request</h3>
          </>
        ) : (
          <>
            <h2 className={requestTitleClass}>Transfer Approvals</h2>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ApprovalPills
                value={view}
                onChange={(next) => {
                  update({ view: next, page: 1 })
                }}
              />
              <div className="grid justify-items-end gap-2.5">
                <FilterButton
                  count={activeCount(view === 'delegates' ? delegateFilters : requestedFilters)}
                  onClick={() => {
                    setDialog({ type: 'filters' })
                  }}
                />
                {(can.approve || can.reject) && (
                  <BulkButtons
                    disabled={bulk.isPending}
                    onApprove={() => {
                      askBulk('approve')
                    }}
                    onUnapprove={() => {
                      askBulk('unapprove')
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
        <TransferStatusTabs
          value={status}
          counts={page?.counts}
          onChange={(next) => {
            update({ status: next, page: 1 })
          }}
        />
        <DataTable
          columns={[
            selectColumn(rows, selected, setSelected),
            ...(isRequest ? transferRequestColumns : transferApprovalColumns),
          ]}
          data={rows}
          getRowId={(row) => row.id}
          caption={isRequest ? 'Transfer requests' : 'Transfer approvals'}
          className={transferTableClass}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          rowActionsHeader="Actions"
          emptyState={
            <p className="py-10 text-center text-sm text-muted-foreground">
              {status || activeCount(filters) > 0
                ? 'No transfer requests match.'
                : 'No transfer requests yet.'}
            </p>
          }
          rowActions={(row) => {
            const actions = allowed.filter(
              (action) =>
                row.actions.includes(action) &&
                permits(action, can) &&
                !(action === 'history' && row.status === 'pending'),
            )
            return (
              <RowActionsMenu
                itemClassName={rowMenuItemClass.poppins}
                label={`Actions for ${row.code}`}
                actions={actions.map((action) => ({
                  label:
                    action === 'decide' && row.status === 'cancelling'
                      ? 'Approve/Reject Cancellation'
                      : action === 'cancel' && row.status === 'pending'
                        ? 'Withdraw'
                        : ACTION_LABELS[action],
                  variant: action === 'delete' ? 'destructive' : 'default',
                  onSelect: () => {
                    // Requests → View is the greyed form; Approvals → View is the Approve popup.
                    if (action === 'view') {
                      setDialog({ type: isRequest ? 'view' : 'review', request: row })
                    } else if (action !== 'consent') {
                      setDialog({ type: action, request: row })
                    }
                  },
                }))}
              />
            )
          }}
        />
        {meta && meta.total > 0 && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            disabled={list.isFetching}
            onPageChange={(next) => {
              update({ page: next })
            }}
            className="justify-end"
          />
        )}
      </div>

      {dialog?.type === 'create' && <TransferRequestDialog mode="create" onClose={close} />}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <TransferRequestDialog mode={dialog.type} request={dialog.request} onClose={close} />
      )}
      {(dialog?.type === 'decide' || dialog?.type === 'review') && (
        <TransferDecisionDialog
          id={dialog.request.id}
          mode={dialog.type === 'decide' ? 'decide' : 'view'}
          via={isRequest ? 'request' : 'approvals'}
          onClose={close}
        />
      )}
      {dialog?.type === 'flow' && (
        <RequestFlowDialog
          kind="transfer"
          id={dialog.request.id}
          via={isRequest ? 'request' : 'approvals'}
          onClose={close}
        />
      )}
      {dialog?.type === 'history' && (
        <RequestHistoryDialog
          kind="transfer"
          id={dialog.request.id}
          via={isRequest ? 'request' : 'approvals'}
          onClose={close}
        />
      )}
      {dialog?.type === 'forward' && (
        <ForwardRequestDialog request={dialog.request} onClose={close} />
      )}
      {dialog?.type === 'cancel' && (
        <CancelRequestDialog request={dialog.request} onClose={close} />
      )}
      {dialog?.type === 'delete' && (
        <DeleteRequestDialog request={dialog.request} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={isRequest || view === 'requested' ? placeFields : delegateFields}
          value={{ ...filters, status }}
          preset={isRequest ? 'transfer-requests' : `transfer-${view}`}
          onApply={(next) => {
            const { status: picked, ...rest } = next
            setFilters(rest)
            update({ status: statusOf(picked), page: 1 })
          }}
          onClose={close}
        />
      )}
      {dialog?.type === 'unapprove' && (
        <UnapproveDialog
          count={decidable.length}
          pending={bulk.isPending}
          onConfirm={(remarks) => {
            runBulk('reject', remarks)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'approve'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Approve the ticked requests"
        message="Are you sure you want to Perform this action?"
        onConfirm={() => {
          runBulk('approve', '')
        }}
      />
    </section>
  )
}
