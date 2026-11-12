import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarPlus, SlidersHorizontal } from 'lucide-react'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  AdjustBalanceDialog,
  AllotmentDialog,
  LEAVE_CODES,
  LEAVE_STATUS_META,
  type LeaveApplication,
} from '@/features/leaves'
import { useCanOnEmployee } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  useLeaveApplicationsOf,
  useLeaveBalancesOf,
  useLeaveThisMonth,
} from '../../hooks/use-profile-related'
import type { Employee } from '../../types/employees.types'
import { formatDay } from '../../utils/format'
import {
  outlineButtonClass,
  sectionLinkClass,
  sectionTableClass,
  toolbarButtonClass,
} from '../../utils/styles'
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
 *
 * The overview's buttons give this one person leave (no frame): Allot Leave runs the yearly
 * allotment for them only (`POST /leaves/allotment/process` with `employeeId`; a new joiner's
 * leave), and Adjust Balance posts an opening balance or a manual adjustment
 * (`POST /leaves/ledger`). They follow `leaves.allotment.process` / `leaves.balances.edit`.
 */
export function LeaveTab({ employee }: { employee: Employee }) {
  const balances = useLeaveBalancesOf(employee.id)
  const month = useLeaveThisMonth(employee.id)
  const list = useLeaveApplicationsOf(employee.id)
  const canAllot = useCanOnEmployee(LEAVE_CODES.allotment, employee.id)
  const canAdjust = useCanOnEmployee(LEAVE_CODES.balancesEdit, employee.id)
  const [dialog, setDialog] = useState<'allot' | 'adjust' | null>(null)
  const person = { id: employee.id, name: employee.name }
  // The balances answer for the leave year that contains today (the company's fiscal year).
  const leaveYear = balances.data?.data[0]?.fiscalYear

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

  // Covered by a policy but nothing given yet for the year: a new joiner before an allotment run.
  const nothingGiven = overview.length > 0 && overview.every((item) => item.allowed === 0)
  const actionClass = cn(toolbarButtonClass, outlineButtonClass, 'gap-1.5 px-3 text-xs')

  return (
    <div className="@container grid gap-4">
      <SectionCard
        title="Leave Overview This Month"
        actions={
          (canAllot || canAdjust) && (
            <>
              {canAllot && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialog('allot')
                  }}
                  className={actionClass}
                >
                  <CalendarPlus aria-hidden="true" className="size-4" />
                  Allot Leave
                </Button>
              )}
              {canAdjust && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialog('adjust')
                  }}
                  className={actionClass}
                >
                  <SlidersHorizontal aria-hidden="true" className="size-4" />
                  Adjust Balance
                </Button>
              )}
            </>
          )
        }
      >
        {balances.isPending || month.isPending ? (
          <LoadingRows rows={1} label="the leave overview" />
        ) : balances.isError ? (
          <EmptyNote>The leave balances could not be loaded: {balances.error.message}</EmptyNote>
        ) : overview.length === 0 ? (
          <EmptyNote>
            No leave balances this year: no leave policy gives {employee.name} any leave type. Check
            Leaves › Settings › Leave Policies.
          </EmptyNote>
        ) : (
          <div className="grid gap-3">
            {nothingGiven && (
              <p
                role="status"
                className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                No leave has been given to {employee.name} for {String(leaveYear)} yet.
                {canAllot ? ' Use Allot Leave to give it now.' : ' Ask HR to run the allotment.'}
              </p>
            )}
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
          </div>
        )}
      </SectionCard>
      {dialog === 'allot' && (
        <AllotmentDialog
          employee={person}
          defaultYear={leaveYear}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog === 'adjust' && (
        <AdjustBalanceDialog
          employee={person}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}

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
