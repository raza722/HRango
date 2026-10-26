import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Search, Trash2, UserMinus } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  Pagination,
  type RowAction,
  RowActionsMenu,
} from '@/components/layout'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  ENROLLMENT_DATE_FORMAT,
  ENROLLMENT_STATUS_LABELS,
  ROSTER_PAGE_SIZE,
  ROSTER_PERMISSIONS,
} from '../constants'
import {
  useDeleteEnrollment,
  useDiscontinueEnrollment,
  useRosterEnrollments,
} from '../hooks/use-roster-enrollments'
import type { EnrollmentStatus, RosterEnrollmentRow } from '../types/roster.types'
import { EntriesSelect, PageSummary } from './table-controls'
import { rosterType } from './type-styles'

// Roster dates, as in the Time Slot column of the Figma list: Inter Medium 14 #303030.
const dateClass = 'font-medium text-title tabular-nums'

const showDate = (value: string | null) =>
  value ? format(parseISO(value), ENROLLMENT_DATE_FORMAT) : '—'

interface EnrollmentListProps {
  groupId: string
  status: EnrollmentStatus
}

/**
 * One tab of the enrollment modal: "Show n entries", search, a paged table (the API
 * orders it; it has no sort parameter) and per row Discontinue (Active tab) and Delete.
 */
export function EnrollmentList({ groupId, status }: EnrollmentListProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(ROSTER_PAGE_SIZE)
  const [text, setText] = useState('')
  const search = useDebouncedValue(text.trim(), 300)
  const [pendingDiscontinue, setPendingDiscontinue] = useState<RosterEnrollmentRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<RosterEnrollmentRow | null>(null)
  const discontinue = useDiscontinueEnrollment()
  const remove = useDeleteEnrollment()
  const canDiscontinue = useCan(ROSTER_PERMISSIONS.enrolmentsEdit)
  const canDelete = useCan(ROSTER_PERMISSIONS.enrolmentsDelete)

  const query = useRosterEnrollments(groupId, { status, page, pageSize, search })
  const meta = query.data?.meta
  // Discontinuing the last row of the last page leaves the page past the end.
  if (meta && !query.isPlaceholderData && page > meta.totalPages) setPage(meta.totalPages)
  const offset = ((meta?.page ?? page) - 1) * (meta?.pageSize ?? pageSize)

  const columns: DataTableColumn<RosterEnrollmentRow>[] = [
    {
      id: 'sr',
      header: '#',
      cell: (_row, index) => offset + index + 1,
      className: 'w-12',
      mobile: 'hidden',
    },
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) => (
        <span>
          {row.employeeName}{' '}
          <span className="text-xs text-muted-foreground">({row.employeeCode})</span>
        </span>
      ),
      className: 'min-w-36 whitespace-normal',
    },
    {
      id: 'department',
      header: 'Department',
      cell: (row) => row.departmentName ?? '—',
      className: 'min-w-32 whitespace-normal',
    },
    {
      id: 'designation',
      header: 'Designation',
      cell: (row) => row.designationName ?? '—',
      className: 'min-w-32 whitespace-normal',
    },
    {
      id: 'start',
      header: 'Start Date',
      cell: (row) => <span className={dateClass}>{showDate(row.startDate)}</span>,
    },
    {
      id: 'end',
      header: 'End Date',
      cell: (row) => <span className={dateClass}>{showDate(row.endDate)}</span>,
    },
    {
      id: 'branch',
      header: 'Branch',
      cell: (row) => row.branchName ?? '—',
      className: 'min-w-28 whitespace-normal',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <span className={cn(row.status === 'active' ? 'text-success' : 'text-destructive')}>
          {ENROLLMENT_STATUS_LABELS[row.status]}
        </span>
      ),
    },
  ]

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EntriesSelect
          value={pageSize}
          label={`Rows per page of ${status} enrollments`}
          onChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
        <div className="relative w-full @md:w-64">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
          />
          <Input
            type="search"
            aria-label={`Search ${status} enrollments`}
            placeholder="Search name or code"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setPage(1)
            }}
            className="pl-9 placeholder:text-field-value sm:pl-9"
          />
        </div>
      </div>

      {query.error && !query.data ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => {
            void query.refetch()
          }}
          className="shadow-none"
        />
      ) : (
        <DataTable
          caption={status === 'active' ? 'Active enrollments' : 'Discontinued enrollments'}
          columns={columns}
          data={query.data?.data ?? []}
          getRowId={(row) => row.id}
          isLoading={query.isPending}
          isFetching={query.isFetching}
          loadingRowCount={5}
          className="text-sm sm:text-sm [&_td:not([colspan])]:text-title"
          emptyState={
            search
              ? 'No one matches that search.'
              : status === 'active'
                ? 'No one is enrolled yet. Use “Enroll New Employee”.'
                : 'Nobody has left this roster.'
          }
          rowActions={
            canDiscontinue || canDelete
              ? (row) => {
                  const actions: RowAction[] = []
                  if (canDiscontinue && row.status === 'active') {
                    actions.push({
                      label: 'Discontinue',
                      icon: UserMinus,
                      variant: 'destructive',
                      onSelect: () => {
                        setPendingDiscontinue(row)
                      },
                    })
                  }
                  if (canDelete) {
                    actions.push({
                      label: 'Delete',
                      icon: Trash2,
                      variant: 'destructive',
                      onSelect: () => {
                        setPendingDelete(row)
                      },
                    })
                  }
                  return actions.length > 0 ? (
                    <RowActionsMenu label={`Actions for ${row.employeeName}`} actions={actions} />
                  ) : null
                }
              : undefined
          }
        />
      )}

      <div className="flex flex-col-reverse items-center justify-between gap-3 @lg:flex-row">
        <PageSummary meta={meta} rowCount={query.data?.data.length ?? 0} />
        <Pagination
          page={meta?.page ?? page}
          totalPages={meta?.totalPages ?? 1}
          onPageChange={setPage}
          disabled={query.isPending}
          currentClassName={rosterType.pagerCurrent}
        />
      </div>

      <ConfirmDialog
        open={pendingDiscontinue !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDiscontinue(null)
        }}
        title="Discontinue this enrollment?"
        description={
          <>
            {pendingDiscontinue?.employeeName} leaves this roster today and moves to the
            Discontinued tab.
          </>
        }
        confirmLabel="Discontinue"
        variant="destructive"
        onConfirm={() => {
          if (pendingDiscontinue) discontinue.mutate(pendingDiscontinue)
          setPendingDiscontinue(null)
        }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete this enrollment?"
        description={
          <>
            The enrollment of {pendingDelete?.employeeName} is removed from this roster. Use
            Discontinue instead to keep it in the history.
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
