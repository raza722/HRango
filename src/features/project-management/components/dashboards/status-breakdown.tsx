import { useState } from 'react'

import { cn } from '@/lib/utils'

import type { StatusSlice } from './dashboard-utils'

const percent = (count: number, total: number) =>
  total === 0 ? 0 : Math.round((count / total) * 100)

/**
 * Workload by Status (part-to-whole): one stacked bar, a 2 px surface gap between the statuses,
 * rounded only at its two ends; under it the same figures as a table (status, tasks, share),
 * which is also the accessible reading of the bar. Hovering a segment or a row lifts the pair.
 */
export function StatusBreakdown({ title, slices }: { title: string; slices: StatusSlice[] }) {
  const [active, setActive] = useState<string | null>(null)
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  const drawn = slices.filter((slice) => slice.count > 0)
  const current = drawn.find((slice) => slice.key === active) ?? null

  return (
    <div className="grid gap-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[2rem] leading-none font-semibold text-title">{total}</span>
        <span className="text-sm text-grey">{total === 1 ? 'task' : 'tasks'}</span>
      </div>

      <div className="relative" aria-hidden="true">
        <div className="flex h-4 w-full gap-[2px]">
          {drawn.map((slice, index) => (
            <div
              key={slice.key}
              onPointerEnter={() => {
                setActive(slice.key)
              }}
              onPointerLeave={() => {
                setActive(null)
              }}
              className={cn(
                'h-full min-w-1.5 transition-opacity',
                index === 0 && 'rounded-l-[4px]',
                index === drawn.length - 1 && 'rounded-r-[4px]',
                active !== null && active !== slice.key && 'opacity-35',
              )}
              style={{ flexGrow: slice.count, flexBasis: 0, background: slice.color }}
            />
          ))}
        </div>
        {current && (
          <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-xs whitespace-nowrap shadow-md">
            <span className="font-semibold text-title">
              {current.count} · {percent(current.count, total)}%
            </span>{' '}
            <span className="text-grey">{current.label}</span>
          </div>
        )}
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Tasks</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr
              key={slice.key}
              onPointerEnter={() => {
                if (slice.count > 0) setActive(slice.key)
              }}
              onPointerLeave={() => {
                setActive(null)
              }}
              className={cn(
                'border-b border-[#F2F2F2] transition-colors last:border-0 dark:border-white/5',
                active === slice.key && 'bg-[#F8F5FF] dark:bg-white/5',
              )}
            >
              <th scope="row" className="py-2 pr-2 text-left font-normal">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-[3px]"
                    style={{ background: slice.color }}
                  />
                  <span className="truncate text-title">{slice.label}</span>
                </span>
              </th>
              <td className="w-12 py-2 text-right font-semibold text-title tabular-nums">
                {slice.count}
              </td>
              <td className="w-14 py-2 pl-2 text-right text-grey tabular-nums">
                {percent(slice.count, total)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
