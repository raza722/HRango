import { useState } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  Pagination,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import {
  activeCount,
  type FilterField,
  FiltersDialog,
  type FilterValues,
  useFilters,
} from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  CATEGORY_LABELS,
  LEAVE_CODES,
  LEAVE_STATUS_META,
  LEAVE_TAB_LABELS,
  LEAVES_PAGE_SIZE,
  SHORT_LEAVE_LABELS,
} from '../../constants'
import {
  useAllLeaveTypes,
  useDepartmentLookup,
  useLeaveApplicationCounts,
  useLeaveApplications,
} from '../../hooks/use-leaves'
import type { LeaveListSearch } from '../../routing'
import {
  type DepartmentLookup,
  LEAVE_STATUSES,
  type LeaveApplication,
  type LeaveApplicationFilters,
  type LeaveTab,
  type LeaveType,
  SHORT_LEAVE_TYPES,
} from '../../types/leaves.types'
import { categoryOf, leaveDates, leaveDays, serial, shortStamp } from '../../utils/format'
import {
  leaveOutlineButtonClass,
  leaveTableClass,
  leaveTitleClass,
  leaveToolbarClass,
} from '../../utils/styles'
import { ApplyLeaveDialog } from './apply-leave-dialog'
import { LeaveCancelDialog, LeaveDecisionDialog, LeaveViewDialog } from './leave-dialogs'
import {
  ApplyLeaveButton,
  LeaveFilterButton,
  LeavePersonCell,
  LeaveStatusChip,
  LeaveStatusDropdown,
} from './leave-list-parts'

type Column = DataTableColumn<LeaveApplication>

type Dialog =
  | { type: 'apply' | 'filters' }
  | { type: 'view' | 'decide' | 'cancel'; application: LeaveApplication }
  | null

/** Which page: My Leaves (the `my` tab) or Leave Applications (`subordinates` / `all`). */
export type LeaveListScope = 'my' | 'applications'

const statusOf = (value: string | undefined) => LEAVE_STATUSES.find((status) => status === value)

/** The filter keys the backend takes; anything else in a saved preset is ignored. */
const FILTER_KEYS = [
  'leaveTypeId',
  'employeeId',
  'departmentId',
  'fromDate',
  'toDate',
  'q',
] as const

function apiFilters(values: FilterValues): FilterValues & LeaveApplicationFilters {
  return Object.fromEntries(
    FILTER_KEYS.map((key) => [key, values[key]]).filter(([, value]) => value),
  ) as FilterValues
}

/** The Filters dialog: Search, Leave Type, Status, From, To; Leave Applications add the person and department. */
function filterFields(
  scope: LeaveListScope,
  types: readonly LeaveType[],
  departments: readonly DepartmentLookup[],
): FilterField[] {
  const fields: FilterField[] = [
    { kind: 'text', key: 'q', label: 'Search', placeholder: 'Code, name or reason' },
    {
      kind: 'select',
      key: 'leaveTypeId',
      label: 'Leave Type',
      placeholder: 'Select Leave Type',
      options: types.map((type) => ({ value: type.id, label: type.title, hint: type.shortCode })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: LEAVE_STATUSES.map((status) => ({
        value: status,
        label: LEAVE_STATUS_META[status].menuLabel,
      })),
    },
    { kind: 'date', key: 'fromDate', label: 'From' },
    { kind: 'date', key: 'toDate', label: 'To' },
  ]
  if (scope === 'applications') {
    fields.splice(
      1,
      0,
      {
        // `GET /employees/lookup` searched on the server and paged (former staff too).
        kind: 'employee',
        key: 'employeeId',
        label: 'Employee Name',
        placeholder: 'Select Employee Name',
        filters: { permission: LEAVE_CODES.applicationsView, includeInactive: true },
      },
      {
        kind: 'select',
        key: 'departmentId',
        label: 'Department',
        placeholder: 'Select Department',
        options: departments.map((department) => ({
          value: department.id,
          label: department.name,
        })),
      },
    )
  }
  return fields
}

const shortLabel = (value: string | null) =>
  SHORT_LEAVE_TYPES.find((item) => item === value)
    ? SHORT_LEAVE_LABELS[value as (typeof SHORT_LEAVE_TYPES)[number]]
    : (value ?? '')

/** The columns as drawn: Sr#., (Employees), Category, Type, Days, Leave Date, Applied On, Reason, Status. */
function columnsFor(scope: LeaveListScope, page: number): readonly Column[] {
  const nowrap = (content: string) => <span className="whitespace-nowrap">{content}</span>
  return [
    {
      id: 'serial',
      header: 'Sr#.',
      mobile: 'hidden',
      cell: (_row, index) => serial(page, LEAVES_PAGE_SIZE, index),
    },
    ...(scope === 'applications'
      ? [
          {
            id: 'employee',
            header: 'Employees',
            className: 'min-w-36',
            cell: (row) => (
              <LeavePersonCell person={{ name: row.employeeName, code: row.employeeCode }} />
            ),
          } satisfies Column,
        ]
      : []),
    { id: 'category', header: 'Category', cell: (row) => CATEGORY_LABELS[categoryOf(row)] },
    {
      id: 'type',
      header: 'Type',
      mobile: 'heading',
      cell: (row) =>
        row.isShort ? (
          <span className="grid">
            <span className="whitespace-nowrap">{row.leaveTypeTitle}</span>
            <span className="text-[0.625rem] whitespace-nowrap">
              Short Leave · {shortLabel(row.shortLeaveType)}
            </span>
          </span>
        ) : (
          nowrap(row.leaveTypeTitle)
        ),
    },
    { id: 'days', header: 'Days', cell: (row) => leaveDays(row.days) },
    {
      id: 'dates',
      header: 'Leave Date',
      cell: (row) => nowrap(leaveDates(row.fromDate, row.toDate)),
    },
    {
      id: 'applied',
      header: 'Applied On',
      cell: (row) => nowrap(shortStamp(row.submittedAt ?? row.createdAt)),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-32 max-w-56 whitespace-normal',
      cell: (row) => (
        <span className="line-clamp-2" title={row.reason ?? undefined}>
          {row.reason}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <LeaveStatusChip status={row.status} />,
    },
  ]
}

/** Leave Applications' All | Subordinates switch (the backend's tabs). */
function TabSwitch({ value, onChange }: { value: LeaveTab; onChange: (tab: LeaveTab) => void }) {
  return (
    <div role="group" aria-label="Whose applications" className="flex gap-1">
      {(['all', 'subordinates'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={value === tab}
          onClick={() => {
            onChange(tab)
          }}
          className={cn(
            leaveToolbarClass,
            'px-4 text-sm',
            value === tab
              ? 'bg-sidebar text-white dark:bg-primary'
              : cn(leaveOutlineButtonClass, 'border-transparent'),
          )}
        >
          {LEAVE_TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  )
}

/**
 * My Leaves (frame 4428:89943) and Leave Applications (4428:90071): the
 * title, "All Requests ⌄" with the count of each status, Filter, "+ Apply
 * Leave", the list and its pager. The row menu offers View and Cancel on your
 * own applications, View and Approve/Reject on everyone's; the buttons follow
 * the signed-in person's permission codes.
 */
export function LeaveListPage({
  scope,
  search,
  onSearch,
}: {
  scope: LeaveListScope
  search: LeaveListSearch
  onSearch: (patch: Partial<LeaveListSearch>) => void
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [filters, setFilters] = useFilters(`leaves-${scope}`)
  const user = useAuthStore((state) => state.user)
  const canApply = useCan(LEAVE_CODES.apply)
  const canCancel = useCan(LEAVE_CODES.cancel)
  const canApprove = useCan(LEAVE_CODES.approve)
  const canReject = useCan(LEAVE_CODES.reject)
  const canDecide = canApprove || canReject
  const tab: LeaveTab = scope === 'my' ? 'my' : (search.tab ?? 'all')
  const filtering = dialog?.type === 'filters'
  const types = useAllLeaveTypes(filtering)
  const departments = useDepartmentLookup(filtering && scope !== 'my')
  const query = apiFilters(filters)
  const list = useLeaveApplications({
    tab,
    status: search.status,
    page: search.page,
    pageSize: LEAVES_PAGE_SIZE,
    filters: query,
  })
  const counts = useLeaveApplicationCounts({ tab, filters: query })
  const page = list.data
  const rows = page?.data ?? []
  const meta = page?.meta
  const title = scope === 'my' ? 'My Leaves' : 'Leave Applications'
  // A user with no employee record (an administrator) has no leave of their own to apply for.
  const showApply = canApply && (scope !== 'my' || user?.employeeId !== null)
  const close = () => {
    setDialog(null)
  }

  return (
    <div className="grid gap-4 px-4 pt-6 pb-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className={leaveTitleClass}>{title}</h1>
        <div className="flex flex-wrap gap-2.5">
          {scope === 'applications' && (
            <TabSwitch
              value={tab}
              onChange={(next) => {
                onSearch({ tab: next === 'all' ? undefined : 'subordinates', page: 1 })
              }}
            />
          )}
          <LeaveStatusDropdown
            value={search.status}
            counts={counts.data}
            onChange={(status) => {
              onSearch({ status, page: 1 })
            }}
          />
          <LeaveFilterButton
            filled={scope === 'applications'}
            count={activeCount(query)}
            onClick={() => {
              setDialog({ type: 'filters' })
            }}
          />
          {showApply && (
            <ApplyLeaveButton
              onClick={() => {
                setDialog({ type: 'apply' })
              }}
            />
          )}
        </div>
      </div>

      {list.error && !page ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => {
            void list.refetch()
          }}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={columnsFor(scope, meta?.page ?? search.page)}
          data={rows}
          getRowId={(row) => row.id}
          caption={title}
          className={leaveTableClass}
          isLoading={list.isPending}
          isFetching={list.isFetching}
          rowActionsHeader="Actions"
          emptyState={
            <p className="py-10 text-center text-sm text-grey">
              {search.status || activeCount(query) > 0
                ? 'No leave applications match.'
                : scope === 'my'
                  ? 'You have not applied for leave yet.'
                  : 'No leave applications yet.'}
            </p>
          }
          rowActions={(row) => (
            <RowActionsMenu
              label={`Actions for ${row.code}`}
              itemClassName={rowMenuItemClass.poppins}
              actions={[
                {
                  label: 'View',
                  onSelect: () => {
                    setDialog({ type: 'view', application: row })
                  },
                },
                ...(scope === 'applications' &&
                canDecide &&
                (row.status === 'pending' || row.status === 'cancelling')
                  ? [
                      {
                        label:
                          row.status === 'cancelling'
                            ? 'Approve/Reject Cancellation'
                            : 'Approve/Reject',
                        onSelect: () => {
                          setDialog({ type: 'decide', application: row })
                        },
                      },
                    ]
                  : []),
                ...(scope === 'my' &&
                canCancel &&
                (row.status === 'pending' || row.status === 'approved')
                  ? [
                      {
                        label: 'Cancel',
                        variant: 'destructive' as const,
                        onSelect: () => {
                          setDialog({ type: 'cancel', application: row })
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}
        />
      )}
      {meta && meta.total > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          disabled={list.isFetching}
          onPageChange={(next) => {
            onSearch({ page: next })
          }}
          className="justify-end"
        />
      )}

      {dialog?.type === 'apply' && (
        <ApplyLeaveDialog forOthers={scope === 'applications'} onClose={close} />
      )}
      {dialog?.type === 'view' && <LeaveViewDialog id={dialog.application.id} onClose={close} />}
      {dialog?.type === 'decide' && (
        <LeaveDecisionDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'cancel' && (
        <LeaveCancelDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={filterFields(scope, types.data?.data ?? [], departments.data ?? [])}
          value={{ ...query, status: search.status }}
          preset={`leaves-${scope}`}
          onApply={(next) => {
            const { status: picked, ...rest } = next
            setFilters(apiFilters(rest))
            onSearch({ status: statusOf(picked), page: 1 })
          }}
          onClose={close}
        />
      )}
    </div>
  )
}
