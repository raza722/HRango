import { useId } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

import { useStandardLookups } from '../../use-standard'
import type { LeaveLookups } from './leave.types'

/** 8, 14.5. */
const days = (value: number) => String(Math.round(value * 100) / 100)

/**
 * "Balance" over the Leave list (frame 4189:54603): each leave type's
 * entitlement, the days availed, available and pending of the signed-in
 * person, then the "Request" heading over the list. Headings Poppins Medium
 * 17 #303030, the band Poppins Medium 12, the rows Poppins Medium 14.
 */
export function LeaveBalanceCard() {
  const headingId = useId()
  const lookups = useStandardLookups<LeaveLookups>('leave')
  const me = lookups.data?.me.id
  const extra = lookups.data?.extra
  const mine = me ? extra?.balances[me] : undefined

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
              {!extra ? (
                <tr>
                  <td colSpan={5}>
                    <Skeleton className="h-16 w-full" />
                  </td>
                </tr>
              ) : (
                extra.leaveTypes.map((type) => {
                  const balance = mine?.[type.id]
                  return (
                    <tr key={type.id}>
                      <th scope="row">{type.name}</th>
                      <td>{days(balance?.total ?? 0)}</td>
                      <td>{days(balance?.availed ?? 0)}</td>
                      <td>{days(balance?.available ?? 0)}</td>
                      <td>{days(balance?.pending ?? 0)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <h2 className="mt-4 text-[1.0625rem] font-medium text-title">Request</h2>
    </>
  )
}
