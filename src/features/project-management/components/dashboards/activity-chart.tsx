import { type KeyboardEvent, useState } from 'react'
import { format } from 'date-fns'
import { BarChart3, Table2 } from 'lucide-react'

import { useElementWidth } from '@/hooks/use-element-width'
import { cn } from '@/lib/utils'

import { fromDay } from '../task-fields/field-utils'
import { dash } from './dashboard-styles'
import type { ActivityDay } from './dashboard-utils'

const PAD = { top: 14, right: 6, bottom: 30, left: 30 }
const HEIGHT = 210

/** A whole-number axis top with four even steps: 4, 8, 12, 20, 40… */
function niceTop(value: number): number {
  if (value <= 4) return 4
  const raw = Math.ceil(value / 4)
  const exponent = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((factor) => factor * exponent).find((option) => option >= raw)
  return (step ?? raw) * 4
}

/** A column with a 4 px rounded top and a square foot on the baseline. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height)
  return [
    `M${x},${y + height}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${y + height}`,
    'Z',
  ].join(' ')
}

const SERIES = [
  { key: 'due', label: 'Due', colour: 'var(--dash-due)' },
  { key: 'completed', label: 'Completed', colour: 'var(--dash-completed)' },
] as const

/**
 * Activity KPI: tasks due and tasks completed per day (emphasis: completed in purple, due in the
 * de-emphasis grey behind it). One axis of whole tasks, solid hairline grid, a read-out for each
 * day on hover or with the arrow keys, and a table view.
 */
export function ActivityChart({ title, days }: { title: string; days: readonly ActivityDay[] }) {
  const [ref, measured] = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const width = Math.max(280, measured ?? 560)
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const top = niceTop(Math.max(0, ...days.flatMap((day) => [day.due, day.completed])))
  const ticks = [0, 1, 2, 3, 4].map((step) => (top / 4) * step)
  const slot = plotWidth / Math.max(1, days.length)
  const barWidth = Math.max(3, Math.min(12, (slot - 8) / 2))
  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight
  // Every k-th day keeps its label so they never collide (about 38 px each).
  const every = Math.max(1, Math.ceil(38 / slot))
  const lastIndex = days.length - 1

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const forward = event.key === 'ArrowRight'
      setActive((current) =>
        Math.min(
          lastIndex,
          Math.max(0, (current ?? (forward ? -1 : days.length)) + (forward ? 1 : -1)),
        ),
      )
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : lastIndex)
    } else if (event.key === 'Escape') setActive(null)
  }

  const activeDay = active === null ? null : days[active]
  const tooltipLeft =
    active === null
      ? 0
      : Math.min(width - 150, Math.max(0, PAD.left + slot * active + slot / 2 - 70))

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-grey">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[3px]"
                style={{ background: series.colour }}
              />
              {series.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          // The visible word starts the name (label in name): Table / Chart view of …
          aria-label={`${asTable ? 'Chart' : 'Table'} view of ${title}`}
          onClick={() => {
            setAsTable((value) => !value)
          }}
          className={dash.ghost}
        >
          {asTable ? (
            <BarChart3 aria-hidden="true" className="size-4" />
          ) : (
            <Table2 aria-hidden="true" className="size-4" />
          )}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {asTable ? (
        <div className="relative scrollbar-thin max-h-64 overflow-auto rounded-[0.625rem] border border-[#ECECEC] dark:border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-[#F8F5FF] dark:bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-title">
                  Day
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-title">
                  Due
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-title">
                  Completed
                </th>
              </tr>
            </thead>
            <tbody>
              {days.toReversed().map((day) => (
                <tr key={day.day} className="border-t border-[#F2F2F2] dark:border-white/5">
                  <th scope="row" className="px-3 py-1.5 font-normal text-grey">
                    {format(fromDay(day.day), 'EEE, d MMM')}
                  </th>
                  <td className="px-3 py-1.5 text-right text-title tabular-nums">{day.due}</td>
                  <td className="px-3 py-1.5 text-right text-title tabular-nums">
                    {day.completed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative w-full">
          <svg
            role="img"
            aria-label={`${title}. Use the left and right arrow keys to read each day.`}
            tabIndex={0}
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${String(width)} ${String(HEIGHT)}`}
            className="block h-auto max-w-full overflow-visible rounded outline-none focus-visible:ring-2 focus-visible:ring-[#A181FF]"
            onKeyDown={onKey}
            onBlur={() => {
              setActive(null)
            }}
            onPointerLeave={() => {
              setActive(null)
            }}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect()
              const scale = box.width / width
              const offset = (event.clientX - box.left) / scale - PAD.left
              setActive(Math.min(lastIndex, Math.max(0, Math.floor(offset / slot))))
            }}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? 'var(--dash-axis)' : 'var(--dash-grid)'}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-grey text-[0.625rem] tabular-nums"
                >
                  {tick}
                </text>
              </g>
            ))}
            {active !== null && (
              <rect
                x={PAD.left + slot * active + 1}
                y={PAD.top}
                width={Math.max(0, slot - 2)}
                height={plotHeight}
                rx={6}
                className="fill-[#7127EA]/[0.06] dark:fill-white/[0.05]"
              />
            )}
            {days.map((day, index) => {
              const centre = PAD.left + slot * index + slot / 2
              const values = [day.due, day.completed]
              return (
                <g key={day.day}>
                  {SERIES.map((series, seriesIndex) => {
                    const value = values[seriesIndex] ?? 0
                    if (value <= 0) return null
                    const x = seriesIndex === 0 ? centre - barWidth - 1 : centre + 1
                    return (
                      <path
                        key={series.key}
                        d={columnPath(x, y(value), barWidth, PAD.top + plotHeight - y(value))}
                        fill={series.colour}
                      />
                    )
                  })}
                  {(index % every === 0 || index === lastIndex) &&
                    (index === lastIndex || lastIndex - index >= every) && (
                      <text
                        x={centre}
                        y={HEIGHT - 10}
                        textAnchor="middle"
                        className={cn(
                          'text-[0.625rem]',
                          index === lastIndex ? 'fill-title font-semibold' : 'fill-grey',
                        )}
                      >
                        {index === lastIndex ? 'Today' : format(fromDay(day.day), 'd MMM')}
                      </text>
                    )}
                </g>
              )
            })}
          </svg>
          {activeDay && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
              style={{ left: tooltipLeft }}
            >
              <p className="mb-1 text-grey">{format(fromDay(activeDay.day), 'EEEE, d MMM')}</p>
              {SERIES.map((series) => (
                <p key={series.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-3 rounded"
                    style={{ background: series.colour }}
                  />
                  <span className="font-semibold text-title tabular-nums">
                    {series.key === 'due' ? activeDay.due : activeDay.completed}
                  </span>
                  <span className="text-grey">{series.label}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
