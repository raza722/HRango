import { useState } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  Pagination,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { activeCount, type FilterField, FiltersDialog, useFilters } from '@/features/payroll'
import { REQUEST_STATUSES } from '@/features/requests'

import { CATEGORY_LABELS, LEAVE_STATUS_META, LEAVES_PAGE_SIZE } from '../../constants'
import { useLeaveApplications, useLeavesLookups } from '../../hooks/use-leaves'
import type { LeaveListSearch } from '../../routing'
import type { LeaveApplication, LeavesLookups } from '../../types/leaves.types'
import { leaveDates, leaveDays, serial, shortStamp } from '../../utils/format'
import { leaveTableClass, leaveTitleClass } from '../../utils/styles'
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

const statusOf = (value: string | undefined) => REQUEST_STATUSES.find((status) => status === value)

/** The Filters dialog: Leave Type, Category, Status, From, To; Leave Applications add the person. */
function filterFields(scope: 'my' | 'all', lookups: LeavesLookups | undefined): FilterField[] {
  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'leaveTypeId',
      label: 'Leave Type',
      placeholder: 'Select Leave Type',
      options: (lookups?.leaveTypes ?? []).map((type) => ({ value: type.id, label: type.title })),
    },
    {
      kind: 'select',
      key: 'category',
      label: 'Category',
      placeholder: 'Select Category',
      options: [
        { value: 'single', label: CATEGORY_LABELS.single },
        { value: 'multiple', label: CATEGORY_LABELS.multiple },
      ],
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: REQUEST_STATUSES.map((status) => ({
        value: status,
        label: LEAVE_STATUS_META[status].menuLabel,
      })),
    },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]
  if (scope === 'all') {
    fields.unshift(
      {
        kind: 'select',
        key: 'employeeId',
        label: 'Employee Name',
        placeholder: 'Select Employee Name',
        options: (lookups?.employees ?? []).map((person) => ({
          value: person.id,
          label: person.name,
          hint: person.code,
        })),
      },
      {
        kind: 'select',
        key: 'department',
        label: 'Department',
        placeholder: 'Select Department',
        options: (lookups?.departments ?? []).map((name) => ({ value: name, label: name })),
      },
    )
  }
  return fields
}

/** The columns as drawn: Sr#., (Employees), Category, Type, Rosters, Days, Leave Date, Applied On, Reason, Status. */
function columnsFor(scope: 'my' | 'all', page: number): readonly Column[] {
  const nowrap = (content: string) => <span className="whitespace-nowrap">{content}</span>
  return [
    {
      id: 'serial',
      header: 'Sr#.',
      mobile: 'hidden',
      cell: (_row, index) => serial(page, LEAVES_PAGE_SIZE, index),
    },
    ...(scope === 'all'
      ? [
          {
            id: 'employee',
            header: 'Employees',
            className: 'min-w-36',
            cell: (row) => <LeavePersonCell person={row.employee} />,
          } satisfies Column,
        ]
      : []),
    { id: 'category', header: 'Category', cell: (row) => CATEGORY_LABELS[row.category] },
    {
      id: 'type',
      header: 'Type',
      mobile: 'heading',
      cell: (row) =>
        row.short ? (
          <span className="grid">
            <span className="whitespace-nowrap">{row.leaveTypeTitle}</span>
            <span className="text-[0.625rem] whitespace-nowrap">
              Short Leave · {row.shortTypeLabel}
            </span>
          </span>
        ) : (
          nowrap(row.leaveTypeTitle)
        ),
    },
    { id: 'roster', header: 'Rosters', cell: (row) => nowrap(row.rosterTitle) },
    { id: 'days', header: 'Days', cell: (row) => leaveDays(row.count) },
    { id: 'dates', header: 'Leave Date', cell: (row) => nowrap(leaveDates(row.from, row.to)) },
    { id: 'applied', header: 'Applied On', cell: (row) => nowrap(shortStamp(row.appliedAt)) },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-32 max-w-56 whitespace-normal',
      cell: (row) => (
        <span className="line-clamp-2" title={row.reason}>
          {row.reason}
          {row.attachmentMissing && (
            <span className="block text-[0.625rem] text-[#EBA51E]">No attachment given</span>
          )}
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

/**
 * My Leaves (frame 4428:89943) and Leave Applications (4428:90071): the
 * title, "All Requests ⌄" with the count of each status, Filter, "+ Apply
 * Leave" (My Leaves), the list and its pager. The row menu offers View and
 * Cancel on your own applications, View and Approve/Reject on everyone's.
 */
export function LeaveListPage({
  scope,
  search,
  onSearch,
}: {
  scope: 'my' | 'all'
  search: LeaveListSearch
  onSearch: (patch: Partial<LeaveListSearch>) => void
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [filters, setFilters] = useFilters(`leaves-${scope}`)
  const lookups = useLeavesLookups()
  const list = useLeaveApplications({
    scope,
    status: search.status,
    page: search.page,
    pageSize: LEAVES_PAGE_SIZE,
    filters,
  })
  const page = list.data
  const rows = page?.data ?? []
  const meta = page?.meta
  const title = scope === 'my' ? 'My Leaves' : 'Leave Applications'
  const close = () => {
    setDialog(null)
  }

  return (
    <div className="grid gap-4 px-4 pt-6 pb-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className={leaveTitleClass}>{title}</h1>
        <div className="flex flex-wrap gap-2.5">
          <LeaveStatusDropdown
            value={search.status}
            counts={page?.counts}
            onChange={(status) => {
              onSearch({ status, page: 1 })
            }}
          />
          <LeaveFilterButton
            filled={scope === 'all'}
            count={activeCount(filters)}
            onClick={() => {
              setDialog({ type: 'filters' })
            }}
          />
          {scope === 'my' && (
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
              {search.status || activeCount(filters) > 0
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
                ...(scope === 'all' && row.actions.includes('decide')
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
                ...(scope === 'my' && row.actions.includes('cancel')
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

      {dialog?.type === 'apply' && <ApplyLeaveDialog onClose={close} />}
      {dialog?.type === 'view' && <LeaveViewDialog id={dialog.application.id} onClose={close} />}
      {dialog?.type === 'decide' && (
        <LeaveDecisionDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'cancel' && (
        <LeaveCancelDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={filterFields(scope, lookups.data)}
          value={{ ...filters, status: search.status }}
          preset={`leaves-${scope}`}
          onApply={(next) => {
            const { status: picked, ...rest } = next
            setFilters(rest)
            onSearch({ status: statusOf(picked), page: 1 })
          }}
          onClose={close}
        />
      )}
    </div>
  )
}
