import { useState } from 'react'
import { toast } from 'sonner'

import { DataTable, Pagination, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { activeCount, ConfirmAction, FiltersDialog, useFilters } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

import { typePermission } from '../api/backend'
import { ACTION_LABELS, REQUEST_PAGE_SIZE } from '../constants'
import { REQUEST_STATUSES, type RequestAction, type RequestPage } from '../types/requests.types'
import { isOwnUndecidable, SELF_BLOCKED_ACTIONS } from './self-decision'
import type {
  StandardApprovalView,
  StandardKindConfig,
  StandardListView,
  StandardRequest,
  StandardTab,
} from './standard.types'
import { selectColumn } from './standard-columns'
import {
  StandardCancelDialog,
  StandardConsentDialog,
  StandardDecisionDialog,
  StandardDeleteDialog,
  StandardFlowDialog,
  StandardForwardDialog,
  StandardHistoryDialog,
  StandardUnapproveDialog,
} from './standard-dialogs'
import {
  StandardBulkButtons,
  StandardCreateButton,
  StandardFilterButton,
  StandardPageTabs,
  StandardPill,
  StandardStatusTabs,
} from './standard-parts'
import type { StandardSearch } from './standard-search'
import { standardTableClass } from './standard-styles'
import {
  useBulkStandard,
  useStandardApprovals,
  useStandardList,
  useStandardLookups,
} from './use-standard'

type Dialog<P> =
  | { type: 'create' | 'filters' | 'approve' | 'unapprove' }
  | {
      type:
        | 'edit'
        | 'view'
        | 'decide'
        | 'review'
        | 'flow'
        | 'history'
        | 'cancel'
        | 'delete'
        | 'consent'
        | 'forward'
      request: StandardRequest<P>
    }
  | null

/** The row menus, as the frames draw them for each list. */
const REQUEST_ACTIONS: readonly RequestAction[] = [
  'view',
  'edit',
  'delete',
  'flow',
  'history',
  'cancel',
]
const APPROVAL_ACTIONS: readonly RequestAction[] = [
  'decide',
  'consent',
  'forward',
  'flow',
  'view',
  'history',
]

const VIEW_LABELS: Record<StandardApprovalView, string> = {
  requested: 'Requested',
  cancellations: 'Cancellations',
  delegates: 'Delegates',
  consents: 'Consents',
}

/**
 * The buttons the user's permissions open (the server checks again). Who may
 * decide a request is set by its flow; these codes only show the buttons.
 */
function usePermissions(kind: StandardRequest['kind']) {
  return {
    create: useCan(typePermission(kind, 'create')),
    cancel: useCan(typePermission(kind, 'cancel')),
    approvals: useCan('requests.approvals.view'),
    approve: useCan('requests.approvals.approve'),
    reject: useCan('requests.approvals.reject'),
  }
}

/** Whether the user's permissions allow a row action at all. */
function permits(action: RequestAction, can: ReturnType<typeof usePermissions>): boolean {
  if (action === 'edit') return can.create
  if (action === 'delete' || action === 'cancel') return can.cancel
  if (action === 'decide') return can.approve || can.reject
  if (action === 'forward') return can.approve
  return true
}

const statusOf = (value: string | undefined) => REQUEST_STATUSES.find((status) => status === value)

/**
 * A request type on the newer Requests frames: Requests (My / All, Filter,
 * Create, Approved / Unapproved, the status tabs and the list) and Approvals
 * (Requested / Cancellations / Delegates) with Approve/Reject, Flow, View and
 * History; optionally a Settings tab. The type supplies its columns, filters,
 * form and the rows of its View / Approve popups.
 */
export function StandardRequestsPage<P>({
  config,
  search,
  onSearch,
}: {
  config: StandardKindConfig<P>
  search: StandardSearch
  onSearch: (patch: Partial<StandardSearch>) => void
}) {
  const { kind } = config
  const myEmployeeId = useAuthStore((state) => state.user?.employeeId ?? null)
  const lookups = useStandardLookups<Record<string, unknown>>(kind)
  const bulk = useBulkStandard()
  const can = usePermissions(kind)
  const [dialog, setDialog] = useState<Dialog<P>>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [requestFilters, setRequestFilters] = useFilters(`${kind}-requests`)
  const [approvalFilters, setApprovalFilters] = useFilters(`${kind}-approvals`)

  const wanted: StandardTab =
    search.tab === 'settings' && !config.settingsTab ? 'request' : search.tab
  const tab: StandardTab = wanted === 'approvals' && !can.approvals ? 'request' : wanted
  const isRequest = tab === 'request'
  // The list the API reads; Subordinates only where the type draws it.
  const listView: StandardListView = !config.scopeLabels
    ? 'all'
    : search.scope === 'subordinates' && !config.scopeLabels.subordinates
      ? 'my'
      : search.scope
  // Columns, filters and forms read Subordinates like All (other people's requests).
  const scope = listView === 'my' ? 'my' : 'all'
  const view: StandardApprovalView = config.approvalViews.includes(search.view)
    ? search.view
    : (config.approvalViews[0] ?? 'requested')
  const status = search.status
  const update = (patch: Partial<StandardSearch>) => {
    setSelected(new Set())
    onSearch(patch)
  }

  const requests = useStandardList<P>(kind, {
    scope: listView,
    status,
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    filters: requestFilters,
  })
  const approvals = useStandardApprovals<P>(kind, {
    view,
    status,
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    filters: approvalFilters,
  })
  const list = isRequest ? requests : approvals
  const page: RequestPage<StandardRequest<P>> | undefined = list.data
  const rows = page?.data ?? []
  const filters = isRequest ? requestFilters : approvalFilters
  const setFilters = isRequest ? setRequestFilters : setApprovalFilters

  // Never the requester's own Promotion or Resignation (see self-decision.ts).
  const ownUndecidable = (row: StandardRequest<P>) => isOwnUndecidable(kind, row, myEmployeeId)
  const canDecide = (row: StandardRequest<P>) =>
    row.actions.includes('decide') && !ownUndecidable(row)
  const decidable = rows.filter((row) => selected.has(row.id) && canDecide(row))
  /** Whether anything on this page can be ticked for Approved / Unapproved. */
  const anyDecidable = rows.some(canDecide)
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

  const close = () => {
    setDialog(null)
  }
  const allowed = isRequest ? REQUEST_ACTIONS : APPROVAL_ACTIONS
  const meta = page?.meta
  const columns = isRequest ? config.requestColumns(scope) : config.approvalColumns(view)
  const tabs = [
    { value: 'request' as const, label: 'Requests' },
    ...(can.approvals ? [{ value: 'approvals' as const, label: 'Approvals' }] : []),
    ...(config.settingsTab
      ? [{ value: 'settings' as const, label: config.settingsTab.label }]
      : []),
  ]
  const { ListHeader, FormDialog } = config
  const SettingsPage = config.settingsTab?.Page

  return (
    <section
      aria-labelledby={`${kind}-heading`}
      className="overflow-hidden rounded-xl bg-card shadow-xs"
    >
      <StandardPageTabs
        tabs={tabs}
        value={tab}
        onChange={(next) => {
          update({ tab: next, page: 1, status: undefined, section: undefined })
        }}
      />
      {tab === 'settings' && SettingsPage ? (
        <SettingsPage search={search} onSearch={onSearch} />
      ) : (
        <div className="grid gap-4 px-4 pt-6 pb-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 id={`${kind}-heading`} className="text-xl font-medium text-title">
              {isRequest ? config.requestsTitle : config.approvalsTitle}
            </h1>
            <div className="flex flex-wrap gap-2.5">
              <StandardFilterButton
                count={activeCount(filters)}
                onClick={() => {
                  setDialog({ type: 'filters' })
                }}
              />
              {isRequest && can.create && (
                <StandardCreateButton
                  onClick={() => {
                    setDialog({ type: 'create' })
                  }}
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            {isRequest ? (
              config.scopeLabels ? (
                <StandardPill
                  label="Whose requests"
                  items={[
                    { value: 'my' as const, label: config.scopeLabels.my },
                    { value: 'all' as const, label: config.scopeLabels.all },
                    ...(config.scopeLabels.subordinates
                      ? [{ value: 'subordinates' as const, label: config.scopeLabels.subordinates }]
                      : []),
                  ]}
                  value={listView}
                  onChange={(next) => {
                    update({ scope: next, page: 1 })
                  }}
                />
              ) : (
                <span />
              )
            ) : (
              <StandardPill
                label="Approvals"
                items={config.approvalViews.map((value) => ({ value, label: VIEW_LABELS[value] }))}
                value={view}
                onChange={(next) => {
                  update({ view: next, page: 1 })
                }}
              />
            )}
            {/* Not on My Requests: nobody decides their own, so nothing there can be ticked. */}
            {config.bulk && (can.approve || can.reject) && !(isRequest && scope === 'my') && (
              <StandardBulkButtons
                disabled={bulk.isPending || !anyDecidable}
                onApprove={() => {
                  askBulk('approve')
                }}
                onUnapprove={() => {
                  askBulk('unapprove')
                }}
              />
            )}
          </div>
          {isRequest && ListHeader && <ListHeader scope={scope} />}
          {config.listHeading && isRequest && (
            <h2 className="text-xl font-medium text-title">{config.listHeading}</h2>
          )}
          {config.statusTabs && (
            <StandardStatusTabs
              config={config}
              value={status}
              counts={page?.counts}
              onChange={(next) => {
                update({ status: next, page: 1 })
              }}
            />
          )}
          <DataTable
            columns={[selectColumn(rows, selected, setSelected, ownUndecidable), ...columns]}
            data={rows}
            getRowId={(row) => row.id}
            caption={isRequest ? config.requestsTitle : config.approvalsTitle}
            className={standardTableClass}
            isLoading={list.isPending}
            isFetching={list.isFetching}
            rowActionsHeader="Actions"
            emptyState={
              <p className="py-10 text-center text-sm text-grey">
                {status || activeCount(filters) > 0 ? 'No requests match.' : 'No requests yet.'}
              </p>
            }
            rowActions={(row) => {
              const own = ownUndecidable(row)
              const actions = allowed.filter(
                (action) =>
                  row.actions.includes(action) &&
                  permits(action, can) &&
                  !(own && SELF_BLOCKED_ACTIONS.some((blocked) => blocked === action)) &&
                  !(action === 'history' && isRequest && row.status === 'pending'),
              )
              return (
                <RowActionsMenu
                  label={`Actions for ${row.code}`}
                  itemClassName={rowMenuItemClass.poppins}
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
                      } else {
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
      )}

      {dialog?.type === 'create' && <FormDialog mode="create" scope={scope} onClose={close} />}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <FormDialog mode={dialog.type} scope={scope} request={dialog.request} onClose={close} />
      )}
      {(dialog?.type === 'decide' || dialog?.type === 'review') && (
        <StandardDecisionDialog
          config={config}
          id={dialog.request.id}
          mode={dialog.type === 'decide' ? 'decide' : 'view'}
          via={isRequest ? 'request' : 'approvals'}
          onClose={close}
        />
      )}
      {dialog?.type === 'consent' && (
        <StandardConsentDialog config={config} request={dialog.request} onClose={close} />
      )}
      {dialog?.type === 'forward' && (
        <StandardForwardDialog config={config} request={dialog.request} onClose={close} />
      )}
      {dialog?.type === 'flow' && (
        <StandardFlowDialog
          config={config}
          id={dialog.request.id}
          via={isRequest ? 'request' : 'approvals'}
          onClose={close}
        />
      )}
      {dialog?.type === 'history' && (
        <StandardHistoryDialog
          config={config}
          id={dialog.request.id}
          via={isRequest ? 'request' : 'approvals'}
          onClose={close}
        />
      )}
      {dialog?.type === 'cancel' && (
        <StandardCancelDialog config={config} request={dialog.request} onClose={close} />
      )}
      {dialog?.type === 'delete' && (
        <StandardDeleteDialog config={config} request={dialog.request} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={config.filterFields({
            kind,
            tab: isRequest ? 'request' : 'approvals',
            scope,
            view,
            lookups: lookups.data,
          })}
          value={{ ...filters, status }}
          preset={isRequest ? `${kind}-requests` : `${kind}-approvals`}
          onApply={(next) => {
            const { status: picked, ...rest } = next
            setFilters(rest)
            update({ status: statusOf(picked), page: 1 })
          }}
          onClose={close}
        />
      )}
      {dialog?.type === 'unapprove' && (
        <StandardUnapproveDialog
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
