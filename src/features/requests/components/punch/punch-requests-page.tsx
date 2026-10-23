import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { DataTable, Pagination, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import {
  activeCount,
  ConfirmAction,
  type FilterField,
  FiltersDialog,
  type FilterValues,
  useFilters,
} from '@/features/payroll'

import { ACTION_LABELS, PUNCH_TYPE_LABELS, REQUEST_PAGE_SIZE, STATUS_META } from '../../constants'
import {
  useApprovalList,
  useBulkDecide,
  useRequestList,
  useRequestLookups,
  useTransferLookups,
} from '../../hooks/use-requests'
import type { RequestSearch } from '../../routing'
import { selectColumn } from '../../standard/standard-columns'
import { StandardUnapproveDialog } from '../../standard/standard-dialogs'
import {
  StandardBulkButtons,
  StandardCreateButton,
  StandardFilterButton,
  StandardPageTabs,
  StandardPill,
  StandardStatusTabs,
} from '../../standard/standard-parts'
import {
  APPROVAL_VIEWS,
  PUNCH_REQUEST_TYPES,
  REQUEST_STATUSES,
  type RequestAction,
} from '../../types/requests.types'
import { punchApprovalColumns, punchRequestColumns } from '../shared/request-columns'
import { RequestDialogHost, type RequestDialogState } from '../shared/request-dialog-host'
import { requestTableClass, requestTitleClass } from '../shared/request-styles'

const routeApi = getRouteApi('/_app/requests/punch')

/** Punch keeps "Completed" for an approved request, as its frames draw the chip. */
const STATUS_WORDS = { statusLabels: { completed: 'Completed' } } as const

const REQUEST_ACTIONS: readonly RequestAction[] = [
  'view',
  'edit',
  'delete',
  'flow',
  'history',
  'cancel',
]
const APPROVAL_ACTIONS: readonly RequestAction[] = ['decide', 'consent', 'flow', 'view', 'history']

const VIEW_LABELS = {
  requested: 'Requested',
  delegates: 'Delegates',
  consents: 'Consents',
} as const

/** Half-hour steps for the Punch Start / End Time filters. */
const TIMES = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2)
  const minutes = index % 2 === 0 ? '00' : '30'
  const value = `${String(hours).padStart(2, '0')}:${minutes}`
  const label = `${String(((hours + 11) % 12) + 1).padStart(2, '0')}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`
  return { value, label }
})

const statusOf = (value: string | undefined) => REQUEST_STATUSES.find((status) => status === value)

/**
 * Punch, laid out as the newer Requests frames draw it (section 2697:5532):
 * Requests with "My Punch Request | All Punch Requests", Filter, Create,
 * Approved / Unapproved, the status tabs and the list; Approvals with
 * Requested / Delegates / Consents. The popups are Punch's own.
 */
export function PunchRequestsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const people = useRequestLookups()
  const places = useTransferLookups()
  const bulk = useBulkDecide('punch')
  const [dialog, setDialog] = useState<RequestDialogState>(null)
  const [confirming, setConfirming] = useState<'approve' | 'unapprove' | null>(null)
  const [filtering, setFiltering] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [requestFilters, setRequestFilters] = useFilters('punch-requests')
  const [approvalFilters, setApprovalFilters] = useFilters('punch-approvals')

  const isRequest = search.tab === 'request'
  const status = search.status
  const update = (patch: Partial<RequestSearch>) => {
    setSelected(new Set())
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  const requests = useRequestList('punch', {
    scope: search.scope,
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    ...(status ? { status } : {}),
    filters: requestFilters,
  })
  const approvals = useApprovalList('punch', {
    view: search.view,
    page: search.page,
    pageSize: REQUEST_PAGE_SIZE,
    ...(status ? { status } : {}),
    filters: approvalFilters,
  })
  const list = isRequest ? requests : approvals
  const page = list.data
  const rows = page?.data ?? []
  const filters = isRequest ? requestFilters : approvalFilters

  const personOptions = (people.data?.employees ?? []).map((person) => ({
    value: person.id,
    label: person.name,
    hint: person.code,
  }))
  const fields = (): FilterField[] => {
    const own: FilterField[] = [
      {
        kind: 'select',
        key: 'startTime',
        label: 'Punch Start Time',
        placeholder: 'Select',
        options: TIMES,
      },
      {
        kind: 'select',
        key: 'endTime',
        label: 'Punch End Time',
        placeholder: 'Select',
        options: TIMES,
      },
      {
        kind: 'select',
        key: 'punchType',
        label: 'Method',
        placeholder: 'Select Method',
        options: PUNCH_REQUEST_TYPES.map((value) => ({ value, label: PUNCH_TYPE_LABELS[value] })),
      },
      {
        kind: 'select',
        key: 'nextRequesteeId',
        label: 'Next Requestee',
        placeholder: 'Select Next Requestee',
        options: personOptions,
      },
      {
        kind: 'select',
        key: 'status',
        label: 'Status',
        placeholder: 'Select Status',
        options: REQUEST_STATUSES.map((value) => ({ value, label: STATUS_META[value].label })),
      },
      { kind: 'date', key: 'from', label: 'From' },
      { kind: 'date', key: 'to', label: 'To' },
    ]
    if (isRequest && search.scope === 'my') return own
    const place: FilterField[] = [
      {
        kind: 'select',
        key: 'locationId',
        label: 'Location',
        placeholder: 'Select Location',
        options: (places.data?.locations ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      },
      {
        kind: 'select',
        key: 'branchId',
        label: 'Branch',
        placeholder: 'Select Branch',
        options: (places.data?.branches ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        })),
      },
      {
        kind: 'select',
        key: 'department',
        label: 'Department',
        placeholder: 'Select Department',
        options: (places.data?.departments ?? []).map((name) => ({ value: name, label: name })),
      },
      {
        kind: 'select',
        key: 'employmentStatus',
        label: 'Employment Status',
        placeholder: 'Select Employment Status',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'all', label: 'All' },
        ],
      },
    ]
    const delegator: FilterField[] =
      !isRequest && search.view === 'delegates'
        ? [
            {
              kind: 'select',
              key: 'delegatorId',
              label: 'Delegator',
              placeholder: 'Select Delegator',
              options: personOptions,
            },
          ]
        : []
    return [...delegator, ...own, ...place]
  }

  const decidable = rows.filter((row) => selected.has(row.id) && row.actions.includes('decide'))
  const askBulk = (type: 'approve' | 'unapprove') => {
    if (decidable.length === 0) {
      toast.error('Tick the requests waiting for your decision first.')
      return
    }
    setConfirming(type)
  }
  const runBulk = (decision: 'approve' | 'reject', remarks: string) => {
    bulk.mutate(
      { ids: decidable.map((row) => row.id), input: { decision, remarks } },
      {
        onSuccess: ({ done, failed }) => {
          const verb = decision === 'approve' ? 'approved' : 'rejected'
          toast.success(
            `${String(done)} request${done === 1 ? '' : 's'} ${verb}${failed > 0 ? `; ${String(failed)} could not be` : ''}`,
          )
          setSelected(new Set())
          setConfirming(null)
        },
        onError: () => {
          toast.error('The requests could not be updated.')
        },
      },
    )
  }

  const allowed = isRequest ? REQUEST_ACTIONS : APPROVAL_ACTIONS
  const meta = page?.meta

  return (
    <section
      aria-labelledby="punch-heading"
      className="overflow-hidden rounded-xl bg-card shadow-xs"
    >
      <StandardPageTabs
        tabs={[
          { value: 'request' as const, label: 'Requests' },
          { value: 'approvals' as const, label: 'Approvals' },
        ]}
        value={search.tab}
        onChange={(tab) => {
          update({ tab, page: 1, status: undefined })
        }}
      />
      <div className="grid gap-4 px-4 pt-6 pb-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 id="punch-heading" className={requestTitleClass}>
            {isRequest ? 'Punch Request' : 'Punch Approvals'}
          </h1>
          <div className="flex flex-wrap gap-2.5">
            <StandardFilterButton
              count={activeCount(filters)}
              onClick={() => {
                setFiltering(true)
              }}
            />
            {isRequest && (
              <StandardCreateButton
                onClick={() => {
                  setDialog({ action: 'create' })
                }}
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          {isRequest ? (
            <StandardPill
              label="Whose requests"
              items={[
                { value: 'my' as const, label: 'My Punch Request' },
                { value: 'all' as const, label: 'All Punch Requests' },
              ]}
              value={search.scope}
              onChange={(scope) => {
                update({ scope, page: 1 })
              }}
            />
          ) : (
            <StandardPill
              label="Approvals"
              items={APPROVAL_VIEWS.map((value) => ({ value, label: VIEW_LABELS[value] }))}
              value={search.view}
              onChange={(view) => {
                update({ view, page: 1 })
              }}
            />
          )}
          <StandardBulkButtons
            disabled={bulk.isPending}
            onApprove={() => {
              askBulk('approve')
            }}
            onUnapprove={() => {
              askBulk('unapprove')
            }}
          />
        </div>
        <StandardStatusTabs
          config={STATUS_WORDS}
          value={status}
          counts={page?.counts}
          onChange={(next) => {
            update({ status: next, page: 1 })
          }}
        />
        <DataTable
          columns={[
            selectColumn(rows, selected, setSelected),
            ...(isRequest ? punchRequestColumns : punchApprovalColumns),
          ]}
          data={rows}
          getRowId={(row) => row.id}
          caption={isRequest ? 'Punch requests' : 'Punch approvals'}
          className={requestTableClass}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          rowActionsHeader="Actions"
          emptyState={
            <p className="py-10 text-center text-sm text-grey">
              {status || activeCount(filters) > 0
                ? 'No punch requests match.'
                : 'No punch requests yet.'}
            </p>
          }
          rowActions={(row) => (
            <RowActionsMenu
              itemClassName={rowMenuItemClass.poppins}
              label={`Actions for ${row.code}`}
              actions={allowed
                .filter((action) => row.actions.includes(action))
                .map((action) => ({
                  label:
                    action === 'decide' && row.status === 'cancelling'
                      ? 'Approve/Reject Cancellation'
                      : ACTION_LABELS[action],
                  variant: action === 'delete' ? 'destructive' : 'default',
                  onSelect: () => {
                    setDialog({ action, request: row })
                  },
                }))}
            />
          )}
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
      <RequestDialogHost
        kind="punch"
        dialog={dialog}
        forOthers={search.scope === 'all'}
        onClose={() => {
          setDialog(null)
        }}
      />
      {filtering && (
        <FiltersDialog
          fields={fields()}
          value={{ ...filters, status }}
          preset={isRequest ? 'punch-requests' : 'punch-approvals'}
          onApply={(next: FilterValues) => {
            const { status: picked, ...rest } = next
            if (isRequest) setRequestFilters(rest)
            else setApprovalFilters(rest)
            update({ status: statusOf(picked), page: 1 })
          }}
          onClose={() => {
            setFiltering(false)
          }}
        />
      )}
      {confirming === 'unapprove' && (
        <StandardUnapproveDialog
          count={decidable.length}
          pending={bulk.isPending}
          onConfirm={(remarks) => {
            runBulk('reject', remarks)
          }}
          onClose={() => {
            setConfirming(null)
          }}
        />
      )}
      <ConfirmAction
        open={confirming === 'approve'}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
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
