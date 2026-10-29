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

/** Tooltip values as drawn: the plain number, "(620000)". */
const raw = (value: number) => String(Math.round(value))

/** The drawn pink of the band under zero and of a line lying on it. */
const ZERO_PINK = '#EC9AAD'

const PAD = { top: 14, right: 24, bottom: 30, left: 56 }

/** Axis ticks as drawn: 632k, 505.6k, 1.25M; the band's negative tick in full (-126400). */
function tickLabel(value: number): string {
  if (value < 0) return String(Math.round(value))
  const trim = (number: number, digits: number) => String(Number(number.toFixed(digits)))
  if (value >= 1_000_000) return `${trim(value / 1_000_000, 2)}M`
  if (value >= 1_000) return `${trim(value / 1_000, 1)}k`
  return String(Math.round(value))
}

/** The plot's top: 2% over the highest value, to three figures (620000 → 632000). */
function topOf(value: number): number {
  if (value <= 0) return 5
  const padded = value * 1.02
  const unit = 10 ** Math.max(0, Math.floor(Math.log10(padded)) - 2)
  return Math.ceil(padded / unit) * unit
}

/** Bar charts: the next round number over the highest value. */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const exponent = 10 ** Math.floor(Math.log10(value))
  const fraction = value / exponent
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return step * exponent
}

/**
 * A smooth path through the points that never overshoots them (monotone cubic,
 * Fritsch–Carlson), so a line rising from zero does not dip below it first.
 */
function smoothPath(points: readonly [number, number][]): string {
  const [first] = points
  if (!first) return ''
  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point
    return (point[1] - previous[1]) / (point[0] - previous[0] || 1)
  })
  const tangents = points.map((_, index) => {
    const before = slopes[index - 1]
    const after = slopes[index]
    if (before === undefined) return after ?? 0
    if (after === undefined) return before
    return before * after <= 0 ? 0 : (before + after) / 2
  })
  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = 0
      tangents[index + 1] = 0
      return
    }
    const a = (tangents[index] ?? 0) / slope
    const b = (tangents[index + 1] ?? 0) / slope
    const length = a * a + b * b
    if (length > 9) {
      const tau = 3 / Math.sqrt(length)
      tangents[index] = tau * a * slope
      tangents[index + 1] = tau * b * slope
    }
  })
  let path = `M${String(first[0])},${String(first[1])}`
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current) continue
    const third = (current[0] - previous[0]) / 3
    const c1y = previous[1] + (tangents[index - 1] ?? 0) * third
    const c2y = current[1] - (tangents[index] ?? 0) * third
    path += ` C${String(previous[0] + third)},${String(c1y)} ${String(current[0] - third)},${String(c2y)} ${String(current[0])},${String(current[1])}`
  }
  return path
}

/** Legend as drawn: a dot and the name, centred above the plot. */
function Legend({ series }: { series: readonly ChartSeries[] }) {
  if (series.length < 2) return null
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.6875rem] font-medium text-[#373D3F] dark:text-heading"
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
  heading,
  labels,
  series,
  format,
}: {
  caption: string
  heading: string
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

/** The ≡ button at the chart's top right: switches between the chart and its table. */
function ViewToggle({
  title,
  asTable,
  onToggle,
}: {
  title: string
  asTable: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={asTable}
      aria-label={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
      onClick={onToggle}
      className="absolute top-0 right-0 flex size-7 items-center justify-center rounded text-[#6E8192] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Menu aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.4} />
    </button>
  )
}

/**
 * The dashboard's smooth area chart, as drawn: dashed grid, 2px lines with hollow markers, a
 * wash under each line down to zero, a pink band under zero (a line lying on zero turns pink),
 * one tooltip for every series (hover or arrow keys) and a table view behind the ≡ button.
 */
export function AreaChart({
  title,
  labels,
  series,
  format,
  height = 250,
  zeroBand = true,
  tableHeading = 'Month',
}: {
  title: string
  labels: readonly string[]
  series: readonly ChartSeries[]
  format: (value: number) => string
  height?: number
  /** The pink band under zero, with its negative tick. */
  zeroBand?: boolean
  tableHeading?: string
}) {
  const [ref, measured] = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const gradientId = useId().replace(/:/g, '')
  const width = Math.max(300, measured ?? 640)
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = height - PAD.top - PAD.bottom
  const all = series.flatMap((item) =>
    item.values.filter((value): value is number => value !== null),
  )
  const top = topOf(Math.max(0, ...all))
  const tick = top / 5
  const bottom = zeroBand ? -tick : 0
  const step = labels.length > 1 ? plotWidth / (labels.length - 1) : 0
  const x = (index: number) =>
    labels.length > 1 ? PAD.left + step * index : PAD.left + plotWidth / 2
  const y = (value: number) =>
    PAD.top + plotHeight - ((value - bottom) / (top - bottom)) * plotHeight
  const zero = y(0)
  const ticks = Array.from({ length: zeroBand ? 7 : 6 }, (_, index) => top - tick * index)

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

  // The tooltip hangs under the highest point of the month, as drawn.
  const activeTop =
    active === null
      ? 0
      : Math.min(
          ...series.map((item) => {
            const value = item.values[active]
            return value === null || value === undefined ? zero : y(value)
          }),
        )
  const tooltipLeft = active === null ? 0 : Math.min(width - 150, Math.max(0, x(active) - 38))
  const tooltipTop = Math.min(height - 70, activeTop + 12)

  return (
    <div className="grid gap-1">
      <div className="relative flex min-h-7 items-center justify-center">
        <Legend series={series} />
        <ViewToggle
          title={title}
          asTable={asTable}
          onToggle={() => {
            setAsTable((value) => !value)
          }}
        />
      </div>
      {asTable ? (
        <TableView
          caption={title}
          heading={tableHeading}
          labels={labels}
          series={series}
          format={format}
        />
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
                <g key={item.key}>
                  <linearGradient
                    id={`${gradientId}-fill-${item.key}`}
                    gradientUnits="userSpaceOnUse"
                    x1="0"
                    y1={PAD.top}
                    x2="0"
                    y2={zero}
                  >
                    <stop offset="0%" stopColor={item.colour} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={item.colour} stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient
                    id={`${gradientId}-line-${item.key}`}
                    gradientUnits="userSpaceOnUse"
                    x1="0"
                    y1={PAD.top}
                    x2="0"
                    y2={zero + 1}
                  >
                    <stop offset="0%" stopColor={item.colour} />
                    <stop
                      offset={`${String(Math.max(0, ((zero - 4 - PAD.top) / (zero + 1 - PAD.top)) * 100))}%`}
                      stopColor={item.colour}
                    />
                    <stop offset="100%" stopColor={zeroBand ? ZERO_PINK : item.colour} />
                  </linearGradient>
                </g>
              ))}
              <linearGradient id={`${gradientId}-band`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ZERO_PINK} stopOpacity={0.22} />
                <stop offset="100%" stopColor={ZERO_PINK} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            {ticks.map((value) => (
              <g key={value}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#E9EDF2"
                  strokeDasharray="3 3"
                />
                <text
                  x={PAD.left - 14}
                  y={y(value)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-[#9AA4B0] text-[0.5625rem]"
                >
                  {tickLabel(value)}
                </text>
              </g>
            ))}
            {zeroBand && (
              <rect
                x={x(0)}
                y={zero}
                width={Math.max(0, x(labels.length - 1) - x(0))}
                height={Math.max(0, PAD.top + plotHeight - zero)}
                fill={`url(#${gradientId}-band)`}
              />
            )}
            {labels.map((label, index) => (
              <text
                key={label}
                x={x(index)}
                y={height - 8}
                textAnchor="middle"
                className="fill-[#9AA4B0] text-[0.5625rem] font-semibold"
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
                      d={`${line} L${last[0]},${zero} L${first[0]},${zero} Z`}
                      fill={`url(#${gradientId}-fill-${item.key})`}
                    />
                  )}
                  <path
                    d={line}
                    fill="none"
                    stroke={`url(#${gradientId}-line-${item.key})`}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  {points.map(([cx, cy], index) => (
                    <circle
                      key={`${String(cx)}-${String(index)}`}
                      cx={cx}
                      cy={cy}
                      r={2.75}
                      fill="#FFFFFF"
                      stroke={zeroBand && Math.abs(cy - zero) < 1 ? ZERO_PINK : item.colour}
                      strokeWidth={1.25}
                    />
                  ))}
                </g>
              )
            })}
            {active !== null && (
              <g aria-hidden="true">
                {series.map((item) => {
                  const value = item.values[active]
                  if (value === null || value === undefined) return null
                  return (
                    <circle
                      key={item.key}
                      cx={x(active)}
                      cy={y(value)}
                      r={5}
                      fill="#FFFFFF"
                      stroke={item.colour}
                      strokeWidth={2.5}
                    />
                  )
                })}
              </g>
            )}
          </svg>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute z-10 min-w-20 rounded-sm border border-[#B6C9C9] bg-white px-1.5 py-1 text-[0.625rem] leading-snug text-[#373D3F] shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
              style={{ left: tooltipLeft, top: tooltipTop }}
            >
              <p className="font-medium">{labels[active]}</p>
              {series.map((item) => {
                const value = item.values[active]
                if (value === null || value === undefined) return null
                return (
                  <p key={item.key} className="whitespace-nowrap">
                    <span style={{ color: item.colour }}>{item.label}:</span> ({raw(value)})
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

/**
 * Month-wise columns with a tooltip per column and a table view behind ≡: one series, or two
 * side by side (each in its own colour, with a legend).
 */
export function ColumnChart({
  title,
  labels,
  series,
  format,
  height = 220,
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
  const width = Math.max(260, measured ?? 480)
  const plotWidth = width - PAD.left - 12
  const plotHeight = height - PAD.top - PAD.bottom
  const max = niceMax(
    Math.max(0, ...series.flatMap((item) => item.values.map((value) => value ?? 0))),
  )
  const slot = plotWidth / Math.max(1, labels.length)
  const gap = 2
  const groupWidth = Math.min(16 * series.length + gap, slot * 0.6)
  const barWidth = (groupWidth - gap * (series.length - 1)) / series.length
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * max)

  return (
    <div className="grid gap-1">
      <div className="relative flex min-h-7 items-center justify-center">
        <Legend series={series} />
        <ViewToggle
          title={title}
          asTable={asTable}
          onToggle={() => {
            setAsTable((value) => !value)
          }}
        />
      </div>
      {asTable ? (
        <TableView
          caption={title}
          heading="Month"
          labels={labels}
          series={series}
          format={format}
        />
      ) : (
        <div ref={ref} className="relative w-full">
          <svg
            role="img"
            aria-label={title}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto max-w-full"
          >
            {ticks.map((value) => (
              <g key={value}>
                <line
                  x1={PAD.left}
                  x2={width - 12}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#E9EDF2"
                  strokeDasharray="3 3"
                />
                <text
                  x={PAD.left - 10}
                  y={y(value)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-[#9AA4B0] text-[0.5625rem]"
                >
                  {tickLabel(value)}
                </text>
              </g>
            ))}
            {labels.map((label, index) => {
              const left = PAD.left + slot * index + (slot - groupWidth) / 2
              return (
                <g key={label}>
                  {series.map((item, position) => {
                    const value = item.values[index] ?? 0
                    const barTop = y(value)
                    return (
                      <rect
                        key={item.key}
                        x={left + position * (barWidth + gap)}
                        y={barTop}
                        width={barWidth}
                        height={Math.max(0, PAD.top + plotHeight - barTop)}
                        rx={Math.min(4, barWidth / 2)}
                        fill={item.colour}
                        className={cn(
                          'transition-opacity',
                          active !== null && active !== index && 'opacity-50',
                        )}
                      />
                    )
                  })}
                  <rect
                    x={PAD.left + slot * index}
                    y={PAD.top}
                    width={slot}
                    height={plotHeight}
                    fill="transparent"
                    tabIndex={0}
                    role="presentation"
                    aria-label={`${label}: ${series
                      .map((item) => `${item.label} ${format(item.values[index] ?? 0)}`)
                      .join(', ')}`}
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
                    x={PAD.left + slot * index + slot / 2}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-[#9AA4B0] text-[0.5625rem] font-semibold"
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
              className="pointer-events-none absolute top-1 z-10 rounded-sm border border-[#B6C9C9] bg-white px-1.5 py-1 text-[0.625rem] leading-snug text-[#373D3F] shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
              style={{ left: Math.min(width - 150, PAD.left + slot * active) }}
            >
              <p className="font-medium">{labels[active]}</p>
              {series.map((item) => (
                <p key={item.key} className="whitespace-nowrap">
                  <span style={{ color: item.colour }}>{item.label}:</span> (
                  {raw(item.values[active] ?? 0)})
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
