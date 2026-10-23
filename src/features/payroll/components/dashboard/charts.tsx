import { type KeyboardEvent, useId, useState } from 'react'
import { Menu } from 'lucide-react'

import { useElementWidth } from '@/hooks/use-element-width'
import { cn } from '@/lib/utils'

export interface ChartSeries {
  key: string
  label: string
  /** Stroke / fill colour (a CSS colour or `var(--…)`). */
  colour: string
  values: (number | null)[]
  /** Fill under the line with a fading wash. */
  area?: boolean
}

const PAD = { top: 18, right: 46, bottom: 30, left: 52 }

/** 1.2k / 632k / 1.4M for axis ticks. */
function shortAmount(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`
  return String(Math.round(value))
}

function niceMax(value: number): number {
  if (value <= 0) return 1
  const exponent = 10 ** Math.floor(Math.log10(value))
  const fraction = value / exponent
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return step * exponent
}

/** A smooth path through the points (monotone-ish cardinal spline). */
function smoothPath(points: readonly [number, number][]): string {
  if (points.length === 0) return ''
  const [first] = points
  if (!first) return ''
  let path = `M${first[0]},${first[1]}`
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current) continue
    const before = points[index - 2] ?? previous
    const after = points[index + 1] ?? current
    const c1x = previous[0] + (current[0] - before[0]) / 6
    const c1y = previous[1] + (current[1] - before[1]) / 6
    const c2x = current[0] - (after[0] - previous[0]) / 6
    const c2y = current[1] - (after[1] - previous[1]) / 6
    path += ` C${c1x},${c1y} ${c2x},${c2y} ${current[0]},${current[1]}`
  }
  return path
}

/** Legend: a short line key (or swatch for areas) and the name, centred above the plot. */
function Legend({ series }: { series: readonly ChartSeries[] }) {
  if (series.length < 2) return null
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-field-foreground"
    >
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ background: item.colour }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function TableView({
  caption,
  labels,
  series,
  format,
}: {
  caption: string
  labels: readonly string[]
  series: readonly ChartSeries[]
  format: (value: number) => string
}) {
  return (
    <div className="scrollbar-thin max-h-72 overflow-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium text-heading">
              Month
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
              {series.map((item) => {
                const value = item.values[index]
                return (
                  <td key={item.key} className="px-3 py-1.5 text-right text-heading tabular-nums">
                    {value === null || value === undefined ? '—' : format(value)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The dashboard's smooth area / line chart: recessive grid, 2px lines, a fading
 * wash under area series, a crosshair with one tooltip for every series (hover
 * or arrow keys), end labels, and a table view behind the ≡ button.
 */
export function AreaChart({
  title,
  labels,
  series,
  format,
  height = 240,
}: {
  title: string
  labels: readonly string[]
  series: readonly ChartSeries[]
  format: (value: number) => string
  height?: number
}) {
  const [ref, measured] = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const gradientId = useId().replace(/:/g, '')
  const width = Math.max(320, measured ?? 640)
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = height - PAD.top - PAD.bottom
  const all = series.flatMap((item) =>
    item.values.filter((value): value is number => value !== null),
  )
  const max = niceMax(Math.max(0, ...all))
  const step = labels.length > 1 ? plotWidth / (labels.length - 1) : 0
  const x = (index: number) => PAD.left + step * index
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * max)

  const pointsOf = (item: ChartSeries) =>
    item.values.flatMap((value, index) =>
      value === null ? [] : [[x(index), y(value)] as [number, number]],
    )

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      setActive((current) => {
        const start = current ?? (event.key === 'ArrowRight' ? -1 : labels.length)
        return Math.min(
          labels.length - 1,
          Math.max(0, start + (event.key === 'ArrowRight' ? 1 : -1)),
        )
      })
    } else if (event.key === 'Escape') setActive(null)
  }

  const tooltipLeft = active === null ? 0 : Math.min(width - 160, Math.max(0, x(active) + 10))

  return (
    <div className="grid gap-2">
      <div className="relative flex items-center justify-center">
        <Legend series={series} />
        <button
          type="button"
          aria-pressed={asTable}
          aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
          onClick={() => {
            setAsTable((value) => !value)
          }}
          className="absolute right-0 flex size-7 items-center justify-center rounded text-heading outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Menu aria-hidden="true" className="size-4" />
        </button>
      </div>
      {asTable ? (
        <TableView caption={title} labels={labels} series={series} format={format} />
      ) : (
        <div ref={ref} className="relative w-full">
          <svg
            role="img"
            aria-label={`${title}. Use the left and right arrow keys to read each month.`}
            tabIndex={0}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto max-w-full overflow-visible rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onKeyDown={onKey}
            onPointerLeave={() => {
              setActive(null)
            }}
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect()
              const offset = event.clientX - box.left - PAD.left
              setActive(
                step ? Math.min(labels.length - 1, Math.max(0, Math.round(offset / step))) : 0,
              )
            }}
            onBlur={() => {
              setActive(null)
            }}
          >
            <defs>
              {series.map((item) => (
                <linearGradient
                  key={item.key}
                  id={`${gradientId}-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={item.colour} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={item.colour} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                  strokeDasharray={tick === 0 ? undefined : '3 4'}
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[0.625rem]"
                >
                  {shortAmount(tick)}
                </text>
              </g>
            ))}
            {labels.map((label, index) => (
              <text
                key={label}
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[0.625rem]"
              >
                {label}
              </text>
            ))}
            {series.map((item) => {
              const points = pointsOf(item)
              const line = smoothPath(points)
              const last = points.at(-1)
              const first = points[0]
              return (
                <g key={item.key}>
                  {item.area && first && last && (
                    <path
                      d={`${line} L${last[0]},${PAD.top + plotHeight} L${first[0]},${PAD.top + plotHeight} Z`}
                      fill={`url(#${gradientId}-${item.key})`}
                    />
                  )}
                  <path
                    d={line}
                    fill="none"
                    stroke={item.colour}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  {last && series.length > 1 && (
                    <text
                      x={last[0] + 6}
                      y={last[1]}
                      dy="0.32em"
                      className="fill-field-foreground text-[0.6875rem]"
                    >
                      {item.label}
                    </text>
                  )}
                </g>
              )
            })}
            {active !== null && (
              <g aria-hidden="true">
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={PAD.top}
                  y2={PAD.top + plotHeight}
                  className="stroke-heading/40"
                />
                {series.map((item) => {
                  const value = item.values[active]
                  if (value === null || value === undefined) return null
                  return (
                    <circle
                      key={item.key}
                      cx={x(active)}
                      cy={y(value)}
                      r={4.5}
                      fill={item.colour}
                      className="stroke-card"
                      strokeWidth={2}
                    />
                  )
                })}
              </g>
            )}
          </svg>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-md border bg-card px-3 py-2 text-xs shadow-md"
              style={{ left: tooltipLeft }}
            >
              <p className="mb-1 text-muted-foreground">{labels[active]}</p>
              {series.map((item) => {
                const value = item.values[active]
                return (
                  <p key={item.key} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-0.5 w-3 rounded"
                      style={{ background: item.colour }}
                    />
                    <span className="font-semibold text-heading tabular-nums">
                      {value === null || value === undefined ? '—' : format(value)}
                    </span>
                    <span className="text-muted-foreground">{item.label}</span>
                  </p>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** A single-series bar chart (month-wise amounts), with a tooltip per bar. */
export function BarChart({
  title,
  labels,
  values,
  colour,
  format,
  height = 200,
}: {
  title: string
  labels: readonly string[]
  values: readonly number[]
  colour: string
  format: (value: number) => string
  height?: number
}) {
  const [ref, measured] = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const width = Math.max(280, measured ?? 480)
  const plotWidth = width - PAD.left - 16
  const plotHeight = height - PAD.top - PAD.bottom
  const max = niceMax(Math.max(0, ...values))
  const slot = plotWidth / Math.max(1, values.length)
  const barWidth = Math.min(28, slot * 0.55)
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight
  return (
    <div ref={ref} className="relative w-full">
      <svg
        role="img"
        aria-label={title}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto max-w-full"
      >
        {[0, 0.5, 1].map((share) => (
          <g key={share}>
            <line
              x1={PAD.left}
              x2={width - 16}
              y1={y(share * max)}
              y2={y(share * max)}
              className="stroke-border"
              strokeDasharray={share === 0 ? undefined : '3 4'}
            />
            <text
              x={PAD.left - 8}
              y={y(share * max)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground text-[0.625rem]"
            >
              {shortAmount(share * max)}
            </text>
          </g>
        ))}
        {values.map((value, index) => {
          const left = PAD.left + slot * index + (slot - barWidth) / 2
          const top = y(value)
          const label = labels[index] ?? ''
          return (
            <g key={label}>
              <rect
                x={left}
                y={top}
                width={barWidth}
                height={Math.max(0, PAD.top + plotHeight - top)}
                rx={4}
                fill={colour}
                className={cn(
                  'transition-opacity',
                  active !== null && active !== index && 'opacity-60',
                )}
              />
              <rect
                x={PAD.left + slot * index}
                y={PAD.top}
                width={slot}
                height={plotHeight}
                fill="transparent"
                tabIndex={0}
                role="presentation"
                aria-label={`${label}: ${format(value)}`}
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
                className="outline-none"
              />
              <text
                x={left + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[0.625rem]"
              >
                {label}
              </text>
            </g>
          )
        })}
      </svg>
      {active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 z-10 rounded-md border bg-card px-3 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(width - 130, PAD.left + slot * active) }}
        >
          <span className="font-semibold text-heading tabular-nums">
            {format(values[active] ?? 0)}
          </span>{' '}
          <span className="text-muted-foreground">{labels[active]}</span>
        </div>
      )}
    </div>
  )
}
