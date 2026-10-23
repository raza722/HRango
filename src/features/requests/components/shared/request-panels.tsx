import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

import {
  DataTable,
  type DataTableColumn,
  Pagination,
  RowActionsMenu,
  rowMenuItemClass,
  ScopeTabs,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ACTION_LABELS, KIND_LABELS } from '../../constants'
import type {
  AnyRequest,
  ApprovalView,
  RequestAction,
  RequestKind,
  RequestPage,
  RequestScope,
  RequestStatus,
} from '../../types/requests.types'
import { REQUEST_SCOPES } from '../../types/requests.types'
import { ApprovalViewTabs, StatusDropdown, StatusStrip } from './request-controls'
import { createButtonText, requestTableClass, requestTitleClass } from './request-styles'

/** Actions offered on the Request tab and on Approvals, in menu order. */
const REQUEST_TAB_ACTIONS: readonly RequestAction[] = [
  'view',
  'edit',
  'delete',
  'flow',
  'history',
  'cancel',
]
const APPROVAL_TAB_ACTIONS: readonly RequestAction[] = [
  'decide',
  'consent',
  'view',
  'flow',
  'history',
]

interface ListProps<T extends AnyRequest> {
  kind: RequestKind
  page: RequestPage<T> | undefined
  isLoading: boolean
  isFetching: boolean
  columns: readonly DataTableColumn<T>[]
  status: RequestStatus | undefined
  onStatusChange: (status: RequestStatus | undefined) => void
  onPageChange: (page: number) => void
  onAction: (action: RequestAction, request: T) => void
}

function actionLabel(action: RequestAction, request: AnyRequest) {
  if (action === 'decide' && request.status === 'cancelling') return 'Approve/Reject Cancellation'
  return ACTION_LABELS[action]
}

function RequestList<T extends AnyRequest>({
  kind,
  page,
  isLoading,
  isFetching,
  columns,
  title,
  allowed,
  showStrip,
  onAction,
  onStatusChange,
  onPageChange,
  status,
}: ListProps<T> & { title: string; allowed: readonly RequestAction[]; showStrip: boolean }) {
  const meta = page?.meta
  return (
    <div className="grid gap-4 px-4 pt-5 pb-5 sm:px-6">
      <h2 className={requestTitleClass}>{title}</h2>
      {showStrip && <StatusStrip value={status} counts={page?.counts} onChange={onStatusChange} />}
      <DataTable
        columns={columns}
        data={page?.data ?? []}
        getRowId={(row) => row.id}
        caption={title}
        className={requestTableClass}
        isLoading={isLoading}
        isFetching={isFetching}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {status
              ? 'No requests with this status.'
              : `No ${KIND_LABELS[kind].title.toLowerCase()}s yet.`}
          </p>
        }
        rowActions={(row) => {
          const actions = allowed.filter((action) => row.actions.includes(action))
          return (
            <RowActionsMenu
              itemClassName={rowMenuItemClass.poppins}
              label={`Actions for ${row.code}`}
              actions={actions.map((action) => ({
                label: actionLabel(action, row),
                variant: action === 'delete' ? 'destructive' : 'default',
                onSelect: () => {
                  onAction(action, row)
                },
              }))}
            />
          )
        }}
      />
      {meta && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          disabled={isFetching}
          onPageChange={onPageChange}
          className="justify-end"
        />
      )}
    </div>
  )
}

/** Request tab: My / All, Create, the status filter and the list. */
export function RequestTabPanel<T extends AnyRequest>({
  scope,
  onScopeChange,
  onCreate,
  children,
  ...list
}: ListProps<T> & {
  scope: RequestScope
  onScopeChange: (scope: RequestScope) => void
  onCreate?: (() => void) | undefined
  /** Shown between the toolbar and the list (the Shift Request form). */
  children?: ReactNode
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <ScopeTabs
          label="Whose requests"
          scopes={REQUEST_SCOPES}
          value={scope}
          onChange={onScopeChange}
          tone="navy"
        />
        <div className="flex flex-wrap items-center gap-3">
          {onCreate && (
            <Button
              onClick={onCreate}
              className={cn(
                'h-9 bg-sidebar px-6 text-white hover:bg-sidebar/90 dark:bg-primary',
                createButtonText,
              )}
            >
              <Plus /> Create
            </Button>
          )}
          <StatusDropdown
            value={list.status}
            counts={list.page?.counts}
            onChange={list.onStatusChange}
          />
        </div>
      </div>
      {children}
      <RequestList
        {...list}
        title={KIND_LABELS[list.kind].list}
        allowed={REQUEST_TAB_ACTIONS}
        showStrip
      />
    </>
  )
}

/** Approvals tab: Requested / Delegates / Consents (Punch), the status filter and the list. */
export function ApprovalTabPanel<T extends AnyRequest>({
  view,
  onViewChange,
  ...list
}: ListProps<T> & {
  /** Punch has Requested / Delegates / Consents; Shift shows its list only, as drawn. */
  view?: ApprovalView | undefined
  onViewChange?: ((view: ApprovalView) => void) | undefined
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
        {view && onViewChange ? (
          <ApprovalViewTabs value={view} onChange={onViewChange} />
        ) : (
          <span />
        )}
        <StatusDropdown
          value={list.status}
          counts={list.page?.counts}
          onChange={list.onStatusChange}
        />
      </div>
      <RequestList
        {...list}
        title={KIND_LABELS[list.kind].approvals}
        allowed={APPROVAL_TAB_ACTIONS}
        showStrip={false}
      />
    </>
  )
}
