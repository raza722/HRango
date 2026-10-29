import { useId, useState } from 'react'
import { Table2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/*
 * The dashboard's charts, inline SVG. Series take the data-viz reference palette's first four
 * categorical slots in fixed order (blue, orange, aqua, yellow; validated for colour-blind
 * separation in light and dark, each mode with its own steps). Two slots sit under 3:1 on white,
 * so every chart has a legend, a table view and per-group tooltips; text never wears a series
 * colour.
 */

export interface BarSeries {
  key: string
  label: string
  values: number[]
}

/** Fill classes of the four series slots (light / dark). */
const SLOT_FILL = [
  'fill-[#2a78d6] dark:fill-[#3987e5]',
  'fill-[#eb6834] dark:fill-[#d95926]',
  'fill-[#1baf7a] dark:fill-[#199e70]',
  'fill-[#eda100] dark:fill-[#c98500]',
] as const
const SLOT_SWATCH = [
  'bg-[#2a78d6] dark:bg-[#3987e5]',
  'bg-[#eb6834] dark:bg-[#d95926]',
  'bg-[#1baf7a] dark:bg-[#199e70]',
  'bg-[#eda100] dark:bg-[#c98500]',
] as const

/** A clean axis top: 1, 2, 5 × 10ⁿ at or above the largest value. */
function niceMax(value: number): number {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power
  }
  return 10 * power
}

const compact = (value: number) =>
  value >= 1000 ? `${String(Math.round(value / 100) / 10)}K` : String(Math.round(value))

function Legend({ series }: { series: readonly BarSeries[] }) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((item, index) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-field-foreground">
          <span aria-hidden="true" className={cn('size-2.5 rounded-sm', SLOT_SWATCH[index % 4])} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function TableToggle({
  asTable,
  onToggle,
  title,
}: {
  asTable: boolean
  onToggle: () => void
  title: string
}) {
  return (
    <button
      type="button"
      aria-pressed={asTable}
      aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
      onClick={onToggle}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-heading focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Table2 aria-hidden="true" className="size-4" />
    </button>
  )
}

function DataTableView({
  caption,
  heading,
  labels,
  series,
}: {
  caption: string
  heading: string
  labels: readonly string[]
  series: readonly BarSeries[]
}) {
  return (
    <div className="max-h-72 min-w-0 overflow-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium text-heading">
              {heading}
            </th>
            {series.map((item) => (
              <th
                key={item.key}
                scope="col"
                className="px-3 py-2 text-right font-medium text-heading"
              >
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={label} className="border-t">
              <th scope="row" className="px-3 py-1.5 font-normal text-field-foreground">
                {label}
              </th>
              {series.map((item) => (
                <td key={item.key} className="px-3 py-1.5 text-right text-heading tabular-nums">
                  {item.values[index] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const PAD = { top: 12, right: 8, bottom: 26, left: 34 }

/**
 * Grouped columns per label (month), up to four series side by side: a hairline grid, 4px
 * rounded caps, 2px gaps between a group's columns, one tooltip per group (hover or keyboard
 * focus), the legend above and a table view behind the table button. On a phone the plot keeps
 * a readable width and scrolls inside its box.
 */
export function GroupedColumnChart({
  title,
  labels,
  series,
  highlight,
  height = 240,
}: {
  title: string
  labels: readonly string[]
  series: readonly BarSeries[]
  /** A label to emphasise (the chosen month); the others are dimmed slightly. */
  highlight?: number | undefined
  height?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const tipId = useId()
  const width = 640
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = height - PAD.top - PAD.bottom
  const max = niceMax(Math.max(0, ...series.flatMap((item) => item.values)))
  const slot = plotWidth / Math.max(1, labels.length)
  const gap = 2
  const bar = Math.min(12, (slot * 0.72 - gap * (series.length - 1)) / Math.max(1, series.length))
  const group = bar * series.length + gap * (series.length - 1)
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * max)
  const base = PAD.top + plotHeight

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex items-start justify-between gap-2">
        <Legend series={series} />
        <TableToggle
          title={title}
          asTable={asTable}
          onToggle={() => {
            setAsTable((value) => !value)
          }}
        />
      </div>
      {asTable ? (
        <DataTableView caption={title} heading="Month" labels={labels} series={series} />
      ) : (
        <div className="relative min-w-0 overflow-x-auto">
          <svg
            role="group"
            aria-label={`${title}: ${series.map((item) => item.label).join(', ')} by month`}
            viewBox={`0 0 ${String(width)} ${String(height)}`}
            className="block h-auto w-full min-w-[34rem]"
          >
            {ticks.map((value) => (
              <g key={value}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(value)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {compact(value)}
                </text>
              </g>
            ))}
            {labels.map((label, index) => {
              const left = PAD.left + slot * index + (slot - group) / 2
              const dim =
                (active !== null && active !== index) ||
                (active === null && highlight !== undefined && highlight !== index)
              return (
                <g key={label}>
                  {series.map((item, position) => {
                    const value = item.values[index] ?? 0
                    const top = y(value)
                    const h = Math.max(0, base - top)
                    const r = Math.min(4, bar / 2, h)
                    const x = left + position * (bar + gap)
                    // Rounded data end, square at the baseline.
                    const path =
                      h <= 0
                        ? ''
                        : `M${String(x)},${String(base)} V${String(top + r)} Q${String(x)},${String(top)} ${String(x + r)},${String(top)} H${String(x + bar - r)} Q${String(x + bar)},${String(top)} ${String(x + bar)},${String(top + r)} V${String(base)} Z`
                    return path ? (
                      <path
                        key={item.key}
                        d={path}
                        className={cn(
                          SLOT_FILL[position % 4],
                          'transition-opacity',
                          dim && 'opacity-45',
                        )}
                      />
                    ) : null
                  })}
                  <rect
                    x={PAD.left + slot * index}
                    y={PAD.top}
                    width={slot}
                    height={plotHeight}
                    fill="transparent"
                    role="img"
                    tabIndex={0}
                    aria-label={`${label}: ${series.map((item) => `${item.label} ${String(item.values[index] ?? 0)}`).join(', ')}`}
                    aria-describedby={active === index ? tipId : undefined}
                    onPointerEnter={() => {
                      setActive(index)
                    }}
                    onPointerLeave={() => {
                      setActive(null)
                    }}
                    onFocus={() => {
                      setActive(index)
                    }}
                    onBlur={() => {
                      setActive(null)
                    }}
                    className="outline-none focus-visible:stroke-ring focus-visible:stroke-2"
                  />
                  <text
                    x={PAD.left + slot * index + slot / 2}
                    y={height - 8}
                    textAnchor="middle"
                    className={cn(
                      'text-[10px]',
                      highlight === index ? 'fill-heading font-semibold' : 'fill-muted-foreground',
                    )}
                  >
                    {label}
                  </text>
                </g>
              )
            })}
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={base}
              y2={base}
              className="stroke-border"
            />
          </svg>
          {active !== null && (
            <div
              id={tipId}
              role="status"
              className="pointer-events-none absolute top-1 z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
              style={{
                left: `${String(Math.min(70, Math.max(0, ((PAD.left + slot * active) / width) * 100)))}%`,
              }}
            >
              <p className="font-medium">{labels[active]}</p>
              {series.map((item, position) => (
                <p key={item.key} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 rounded-sm', SLOT_SWATCH[position % 4])}
                  />
                  {item.label}:{' '}
                  <span className="font-medium tabular-nums">{item.values[active] ?? 0}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One series of magnitudes by category (applications per stage), as labelled horizontal bars:
 * the name and count are text, the bar is one hue (no colour-for-identity), with the share.
 */
export function HorizontalBars({
  label,
  rows,
  loading,
}: {
  label: string
  rows: readonly { key: string; label: string; value: number }[]
  loading?: boolean
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ul aria-label={label} aria-busy={loading} className="grid gap-2.5">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1">
          <span className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-field-foreground">{row.label}</span>
            <span className="shrink-0 font-medium text-heading tabular-nums">
              {loading ? '…' : row.value}
              {!loading && total > 0 && (
                <span className="ml-1 font-normal text-muted-foreground">
                  ({Math.round((row.value / total) * 100)}%)
                </span>
              )}
            </span>
          </span>
          <span aria-hidden="true" className="h-2 rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
              style={{
                width: `${String(loading ? 0 : Math.max(row.value > 0 ? 3 : 0, (row.value / max) * 100))}%`,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}
