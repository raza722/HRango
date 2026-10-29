import { Link } from '@tanstack/react-router'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { LEAVE_STATUS_META, type LeaveApplication } from '@/features/leaves'
import { cn } from '@/lib/utils'

import {
  useLeaveApplicationsOf,
  useLeaveBalancesOf,
  useLeaveThisMonth,
} from '../../hooks/use-profile-related'
import type { Employee } from '../../types/employees.types'
import { formatDay } from '../../utils/format'
import { sectionLinkClass, sectionTableClass } from '../../utils/styles'
import { Chip, EmptyNote, LoadingRows, SectionCard } from '../shared/parts'

/** "Half Day", "Short Day", "1 Day", "3 Days" (the list's Days, as drawn). */
function daysText(row: LeaveApplication): string {
  if (row.isShort) return row.shortLeaveType === 'quarter_day' ? 'Short Day' : 'Half Day'
  const days = row.days ?? 0
  return `${String(days)} ${days === 1 ? 'Day' : 'Days'}`
}

const number = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

/**
 * Leave (2423:18851): Leave Overview This Month (each leave type's days taken this month over
 * the year's entitlement: "1/20 Casual"), then the latest applications (Applied On, Category,
 * Days, Status) and View Calendar, all from the Leaves API.
 */
export function LeaveTab({ employee }: { employee: Employee }) {
  const balances = useLeaveBalancesOf(employee.id)
  const month = useLeaveThisMonth(employee.id)
  const list = useLeaveApplicationsOf(employee.id)

  const usedThisMonth = new Map<string, number>()
  for (const row of month.data?.data ?? []) {
    usedThisMonth.set(row.leaveTypeId, (usedThisMonth.get(row.leaveTypeId) ?? 0) + (row.days ?? 0))
  }
  const overview = (balances.data?.data ?? []).map((row) => ({
    id: row.leaveTypeId,
    title: row.leaveTypeTitle.replace(/\s+Leaves?$/i, ''),
    used: usedThisMonth.get(row.leaveTypeId) ?? 0,
    allowed: row.entitled,
  }))

  const columns: DataTableColumn<LeaveApplication>[] = [
    {
      id: 'applied',
      header: 'Applied On',
      cell: (row) => formatDay(row.submittedAt ?? row.createdAt),
    },
    { id: 'category', header: 'Category', cell: (row) => row.leaveTypeTitle },
    { id: 'days', header: 'Days', cell: daysText },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip meta={LEAVE_STATUS_META[row.status]} />,
    },
  ]

  return (
    <div className="@container grid gap-4">
      <SectionCard title="Leave Overview This Month">
        {balances.isPending || month.isPending ? (
          <LoadingRows rows={1} label="the leave overview" />
        ) : balances.isError ? (
          <EmptyNote>The leave balances could not be loaded: {balances.error.message}</EmptyNote>
        ) : overview.length === 0 ? (
          <EmptyNote>No leave balances this year.</EmptyNote>
        ) : (
          <ul
            aria-label="Leave overview"
            className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4"
          >
            {overview.map((item) => (
              <li
                key={item.id}
                className="flex flex-col items-center justify-center gap-1 rounded-[10px] border border-[#E0E0E0] px-3 py-3 dark:border-border"
              >
                <span className="text-lg leading-6 font-semibold text-sidebar dark:text-heading">
                  {number(item.used)}/{number(item.allowed)}
                </span>
                <span className="text-xs text-grey">{item.title}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Leave"
        footer={
          <Link
            to="/leaves/applications"
            search={{ employeeId: employee.id }}
            className={sectionLinkClass}
          >
            View Calendar
          </Link>
        }
      >
        {list.isPending ? (
          <LoadingRows label="leave applications" />
        ) : list.isError ? (
          <EmptyNote>The leave applications could not be loaded: {list.error.message}</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              caption="Leave applications"
              columns={columns}
              data={list.data.data}
              getRowId={(row) => row.id}
              className={cn(sectionTableClass, 'md:min-w-[24rem]')}
              emptyState="No leave applications yet."
            />
          </div>
        )}
      </SectionCard>
    </div>
  )
}
