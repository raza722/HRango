import { useId } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

import { useStandardLookups } from '../../use-standard'
import { useLeaveBalances } from './leave.lookups'

/** 8, 14.5. */
const days = (value: number) => String(Math.round(value * 100) / 100)

/**
 * "Balance" over the Leave list (frame 4189:54603): each leave type's
 * entitlement, the days availed, available and pending of the signed-in
 * person (`GET /leaves/balances`), then the "Request" heading over the list.
 * A user with no employee record has no balance to show. Headings Poppins Medium
 * 17 #303030, the band Poppins Medium 12, the rows Poppins Medium 14.
 */
export function LeaveBalanceCard() {
  const headingId = useId()
  const lookups = useStandardLookups('leave')
  const me = lookups.data?.me?.id
  const balances = useLeaveBalances(me, lookups.isSuccess)
  const rows = balances.data

  return (
    <>
      <section aria-labelledby={headingId} className="grid gap-4">
        <h2 id={headingId} className="text-[1.0625rem] font-medium text-title">
          Balance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left">
            <caption className="sr-only">Your leave balance this year</caption>
            <thead>
              <tr className="text-xs font-medium text-title [&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-8 [&_th]:font-medium dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md">
                <th scope="col">Leave Type</th>
                <th scope="col">Balance</th>
                <th scope="col">Availed</th>
                <th scope="col">Available</th>
                <th scope="col">Pending</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-title [&_td]:px-8 [&_td]:pt-5 [&_td]:pb-1 [&_th]:px-8 [&_th]:pt-5 [&_th]:pb-1 [&_th]:font-medium">
              {!rows ? (
                <tr>
                  <td colSpan={5}>
                    {balances.isError ? (
                      <span className="text-sm font-normal text-grey">
                        Your balance could not be read.
                      </span>
                    ) : (
                      <Skeleton className="h-16 w-full" />
                    )}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-sm font-normal text-grey">
                    No leave balance yet.
                  </td>
                </tr>
              ) : (
                rows.map((balance) => (
                  <tr key={balance.leaveTypeId}>
                    <th scope="row">{balance.leaveTypeTitle}</th>
                    <td>{days(balance.entitled)}</td>
                    <td>{days(balance.used)}</td>
                    <td>{days(balance.available)}</td>
                    <td>{days(balance.pending)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <h2 className="mt-4 text-[1.0625rem] font-medium text-title">Request</h2>
    </>
  )
}
