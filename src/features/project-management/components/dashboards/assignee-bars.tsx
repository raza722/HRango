import { useState } from 'react'
import { UserX } from 'lucide-react'

import { EmployeeAvatar } from '@/components/layout'
import { cn } from '@/lib/utils'

import { usePeople } from '../../hooks/use-pm'
import { dash } from './dashboard-styles'
import type { AssigneeLoad } from './dashboard-utils'

const VISIBLE = 6

/**
 * Totals and Open by Assignee: one thin bar per person, as long as their tasks, split into open
 * (purple) and done (light purple) with a 2 px gap; the figures sit at the end of each row, so
 * every value is text and the bars only compare them.
 */
export function AssigneeBars({ title, rows }: { title: string; rows: AssigneeLoad[] }) {
  const people = usePeople()
  const [all, setAll] = useState(false)
  const max = Math.max(1, ...rows.map((row) => row.total))
  const shown = all ? rows : rows.slice(0, VISIBLE)

  return (
    <div className="grid gap-3">
      <ul
        aria-label={`${title}: legend`}
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-grey"
      >
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-(--dash-open)" />
          Open
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-(--dash-done)" />
          Done
        </li>
      </ul>
      <ul aria-label={title} className="grid gap-3.5">
        {shown.map((row) => (
          <li key={row.employeeId ?? 'unassigned'} className="grid gap-1.5">
            <div className="flex items-center gap-2.5">
              {row.employeeId ? (
                <EmployeeAvatar
                  name={row.name}
                  photoUrl={people.get(row.employeeId)?.photoUrl ?? null}
                  className="size-7"
                  fallbackClassName="text-[0.625rem]"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-7 items-center justify-center rounded-full bg-[#F1F2F3] text-grey dark:bg-white/10"
                >
                  <UserX className="size-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-title">
                {row.name}
              </span>
              <span className="shrink-0 text-xs text-grey tabular-nums">
                <span className="font-semibold text-title">{row.open}</span> open · {row.done} done
                <span className="sr-only"> of {row.total}</span>
              </span>
            </div>
            <div aria-hidden="true" className="flex h-2.5 w-full pl-[2.375rem]">
              <div
                className="flex h-full gap-[2px]"
                style={{ width: `${String((row.total / max) * 100)}%` }}
              >
                {row.open > 0 && (
                  <div
                    className={cn(
                      'h-full rounded-l-[4px] bg-(--dash-open)',
                      row.done === 0 && 'rounded-r-[4px]',
                    )}
                    style={{ flexGrow: row.open, flexBasis: 0 }}
                  />
                )}
                {row.done > 0 && (
                  <div
                    className={cn(
                      'h-full rounded-r-[4px] bg-(--dash-done)',
                      row.open === 0 && 'rounded-l-[4px]',
                    )}
                    style={{ flexGrow: row.done, flexBasis: 0 }}
                  />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > VISIBLE && (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => {
            setAll((value) => !value)
          }}
          className={cn(dash.ghost, 'justify-self-start')}
        >
          {all ? 'Show fewer' : `Show all ${String(rows.length)}`}
        </button>
      )}
    </div>
  )
}
