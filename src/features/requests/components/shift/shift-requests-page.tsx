import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { REQUEST_PAGE_SIZE } from '../../constants'
import { useApprovalList, useRequestList, useRequestPermissions } from '../../hooks/use-requests'
import type { RequestSearch } from '../../routing'
import { shiftApprovalColumns, shiftRequestColumns } from '../shared/request-columns'
import { RequestTabs } from '../shared/request-controls'
import { RequestDialogHost, type RequestDialogState } from '../shared/request-dialog-host'
import { ApprovalTabPanel, RequestTabPanel } from '../shared/request-panels'
import { ShiftRequestForm } from './shift-request-form'

const routeApi = getRouteApi('/_app/requests/shift')

/**
 * Shift Requests: the Shift Request form as drawn with the requests under it,
 * and Shift Approval. An approved request changes the schedule.
 */
export function ShiftRequestsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [dialog, setDialog] = useState<RequestDialogState>(null)
  const can = useRequestPermissions('shift')
  const status = search.status
  const update = (patch: Partial<RequestSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) })

  const isRequest = search.tab === 'request' || !can.approvals
  const requests = useRequestList('shift', {
    scope: search.scope,
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    ...(status ? { status } : {}),
  })
  const approvals = useApprovalList('shift', {
    view: search.view,
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    ...(status ? { status } : {}),
  })

  const common = {
    kind: 'shift' as const,
    status,
    onStatusChange: (next: RequestSearch['status']) => {
      void update({ status: next, page: 1 })
    },
    onPageChange: (page: number) => {
      void update({ page })
    },
  }

  return (
    <section
      aria-labelledby="shift-heading"
      className="overflow-hidden rounded-xl bg-card shadow-xs"
    >
      <h1 id="shift-heading" className="sr-only">
        Shift {isRequest ? 'Requests' : 'Approvals'}
      </h1>
      <RequestTabs
        value={isRequest ? 'request' : 'approvals'}
        approvals={can.approvals}
        onChange={(tab) => {
          void update({ tab, page: 1, status: undefined })
        }}
      />
      {isRequest ? (
        <>
          {can.create && (
            <div className="border-b px-4 py-5 sm:px-6">
              <h2 className="mb-5 text-xl font-medium text-title">Shift Request</h2>
              <ShiftRequestForm forOthers={search.scope === 'all'} />
            </div>
          )}
          <RequestTabPanel
            {...common}
            page={requests.data}
            isLoading={requests.isPending}
            isFetching={requests.isFetching}
            columns={shiftRequestColumns}
            scope={search.scope}
            onScopeChange={(scope) => {
              void update({ scope, page: 1 })
            }}
            onAction={(action, request) => {
              setDialog({ action, request })
            }}
          />
        </>
      ) : (
        <ApprovalTabPanel
          {...common}
          page={approvals.data}
          isLoading={approvals.isPending}
          isFetching={approvals.isFetching}
          columns={shiftApprovalColumns}
          view={search.view}
          onViewChange={(view) => {
            void update({ view, page: 1 })
          }}
          onAction={(action, request) => {
            setDialog({ action, request })
          }}
        />
      )}
      <RequestDialogHost
        kind="shift"
        dialog={dialog}
        forOthers={search.scope === 'all'}
        fromApprovals={!isRequest}
        onClose={() => {
          setDialog(null)
        }}
      />
    </section>
  )
}
