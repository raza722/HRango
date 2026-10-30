import { type CSSProperties, type ReactNode, useId, useState } from 'react'
import { Table2 } from 'lucide-react'

import { useElementWidth } from '@/hooks/use-element-width'
import { cn } from '@/lib/utils'

import { formatCompact, formatCount, formatPercent, shareOf } from '../utils/format'

/*
 * The dashboard's charts, inline SVG and plain HTML. Colour does one job per chart:
 *
 * - Categorical series take three slots in fixed order: the app's primary violet, then orange
 *   and aqua (each with its own dark step), validated with the data-viz skill's checker for the
 *   white card and the dark card (`#162030`): every pair clears the colour-blind and normal-vision
 *   floors in both modes. Aqua sits under 3:1 on white, so every chart has a legend with the
 *   values beside it, a hover / focus tooltip and a table view.
 * - "Other / not set" is the de-emphasis grey, never a fourth hue.
 * - Ordered stages (an appraisal cycle) use one violet ramp, light to dark (dark to light on the
 *   dark card), validated as an ordinal ramp.
 * - A single series is slot 1 throughout. Status colours stay with the status chips.
 *
 * Text never wears a series colour: values and labels use the text tokens, and a swatch or line
 * key beside them carries the identity.
 */

export type Tone = 1 | 2 | 3 | 'rest'

const TONE_FILL: Record<Tone, string> = {
  1: 'fill-[#8b5cf6]',
  2: 'fill-[#eb6834] dark:fill-[#d95926]',
  3: 'fill-[#1baf7a] dark:fill-[#199e70]',
  rest: 'fill-[#94a3b8] dark:fill-[#64748b]',
}

const TONE_BG: Record<Tone, string> = {
  1: 'bg-[#8b5cf6]',
  2: 'bg-[#eb6834] dark:bg-[#d95926]',
  3: 'bg-[#1baf7a] dark:bg-[#199e70]',
  rest: 'bg-[#94a3b8] dark:bg-[#64748b]',
}

/** The four steps of the stage ramp, first stage to last. */
const STAGE_BG = [
  'bg-[#a78bfa] dark:bg-[#7c3aed]',
  'bg-[#8b5cf6] dark:bg-[#a78bfa]',
  'bg-[#6d28d9] dark:bg-[#c4b5fd]',
  'bg-[#4c1d95] dark:bg-[#ddd6fe]',
] as const

/** A clean axis top: 1, 2, 2.5, 5 × 10ⁿ at or above the largest value. */
function niceMax(value: number): number {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power
  }
  return 10 * power
}

// --- legend, tooltip, table view ------------------------------------------------------------------

export interface LegendItem {
  key: string
  label: string
  tone: Tone
  /** Shown after the label ("12 · 35.3%"): the direct label of a part-of-whole. */
  value?: string | undefined
  /** A stage of the ramp instead of a categorical tone. */
  stage?: number | undefined
}

function Swatch({ tone, stage, line = false }: { tone: Tone; stage?: number; line?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'shrink-0',
        line ? 'h-0.5 w-3 rounded-full' : 'size-2.5 rounded-[3px]',
        stage === undefined ? TONE_BG[tone] : STAGE_BG[stage],
      )}
    />
  )
}

export function ChartLegend({
  items,
  className,
}: {
  items: readonly LegendItem[]
  className?: string
}) {
  return (
    <ul aria-label="Legend" className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-field-foreground">
          <Swatch tone={item.tone} {...(item.stage === undefined ? {} : { stage: item.stage })} />
          <span>{item.label}</span>
          {item.value !== undefined && (
            <span className="font-medium text-heading tabular-nums">{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

interface TipLine {
  key: string
  label: string
  value: string
  tone?: Tone | undefined
}

/** The hover / focus readout: the value leads, the series name follows, keyed by a line. */
function Tip({
  id,
  title,
  lines,
  className,
  style,
}: {
  id: string
  title: string
  lines: readonly TipLine[]
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      id={id}
      role="status"
      style={style}
      className={cn(
        'pointer-events-none absolute z-10 grid min-w-36 gap-0.5 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md',
        className,
      )}
    >
      <p className="font-medium text-heading">{title}</p>
      {lines.map((line) => (
        <p key={line.key} className="flex items-center justify-between gap-4 whitespace-nowrap">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {line.tone !== undefined && <Swatch tone={line.tone} line />}
            {line.label}
          </span>
          <span className="font-semibold text-heading tabular-nums">{line.value}</span>
        </p>
      ))}
    </div>
  )
}

export interface TableSpec {
  caption: string
  /** Column headings; the first heads the row labels. */
  head: readonly string[]
  rows: readonly { key: string; cells: readonly string[] }[]
}

/** The table twin of a chart. */
export function ChartTable({ spec }: { spec: TableSpec }) {
  return (
    <div className="relative max-h-72 min-w-0 overflow-auto rounded-md border">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{spec.caption}</caption>
        <thead className="sticky top-0 bg-muted">
          <tr>
            {spec.head.map((heading, index) => (
              <th
                key={heading}
                scope="col"
                className={cn(
                  'px-3 py-2 font-medium whitespace-nowrap text-heading',
                  index > 0 && 'text-right',
                )}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row) => (
            <tr key={row.key} className="border-t">
              {row.cells.map((cell, index) =>
                index === 0 ? (
                  <th
                    key={`${row.key}-label`}
                    scope="row"
                    className="px-3 py-1.5 font-normal text-field-foreground"
                  >
                    {cell}
                  </th>
                ) : (
                  <td
                    key={`${row.key}-${String(index)}`}
                    className="px-3 py-1.5 text-right text-heading tabular-nums"
                  >
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A chart with its legend and the table-view switch above it. `label` names the chart for the
 * switch ("Show attendance by month as a table").
 */
export function ChartFigure({
  label,
  legend,
  table,
  children,
}: {
  label: string
  legend?: readonly LegendItem[] | undefined
  table: TableSpec
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex items-start justify-between gap-2">
        {legend && legend.length > 0 ? <ChartLegend items={legend} /> : <span />}
        <button
          type="button"
          aria-pressed={asTable}
          aria-label={asTable ? `Show ${label} as a chart` : `Show ${label} as a table`}
          onClick={() => {
            setAsTable((value) => !value)
          }}
          className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-heading focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Table2 aria-hidden="true" className="size-4" />
        </button>
      </div>
      {asTable ? <ChartTable spec={table} /> : children}
    </div>
  )
}

// --- one bar, part of a whole ----------------------------------------------------------------------

export interface Part {
  key: string
  label: string
  value: number
  tone: Tone
  stage?: number | undefined
}

/**
 * A whole split into its parts as one thin bar (2px surface gaps between the parts), each part
 * a hover / focus target with its count and share. The legend under it carries the same values,
 * so nothing depends on hovering.
 */
export function PartBar({
  label,
  parts,
  showLegend = true,
}: {
  label: string
  parts: readonly Part[]
  showLegend?: boolean
}) {
  const [active, setActive] = useState<string | null>(null)
  const tipId = useId()
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const shown = parts.filter((part) => part.value > 0)
  const current = shown.find((part) => part.key === active)
  const describe = (part: Part) =>
    `${formatCount(part.value)} · ${formatPercent(shareOf(part.value, total))}`
  return (
    <div className="grid min-w-0 gap-2.5">
      <div className="relative">
        <div aria-label={label} role="group" className="flex h-6 w-full gap-[2px]">
          {shown.map((part, index) => (
            <div
              key={part.key}
              role="img"
              tabIndex={0}
              aria-label={`${part.label}: ${describe(part)}`}
              aria-describedby={active === part.key ? tipId : undefined}
              style={{ flexGrow: part.value, flexBasis: 0 }}
              onPointerEnter={() => {
                setActive(part.key)
              }}
              onPointerLeave={() => {
                setActive(null)
              }}
              onFocus={() => {
                setActive(part.key)
              }}
              onBlur={() => {
                setActive(null)
              }}
              className="flex min-w-[3px] items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span
                className={cn(
                  'block h-3 w-full transition-opacity',
                  part.stage === undefined ? TONE_BG[part.tone] : STAGE_BG[part.stage],
                  index === 0 && 'rounded-l-[4px]',
                  index === shown.length - 1 && 'rounded-r-[4px]',
                  active !== null && active !== part.key && 'opacity-50',
                )}
              />
            </div>
          ))}
          {shown.length === 0 && (
            <span className="my-auto block h-3 w-full rounded-[4px] bg-muted" />
          )}
        </div>
        {current && (
          <Tip
            id={tipId}
            title={current.label}
            className="top-full left-0 mt-1"
            lines={[
              { key: 'count', label: 'Count', value: formatCount(current.value) },
              { key: 'share', label: 'Share', value: formatPercent(shareOf(current.value, total)) },
            ]}
          />
        )}
      </div>
      {showLegend && (
        <ChartLegend
          items={parts.map((part) => ({
            key: part.key,
            label: part.label,
            tone: part.tone,
            stage: part.stage,
            value: describe(part),
          }))}
        />
      )}
    </div>
  )
}

// --- horizontal bars, one per category -----------------------------------------------------------

export interface BarRow {
  key: string
  label: string
  /** The bar's length; at least the sum of its parts. */
  total: number
  parts: readonly Part[]
}

/**
 * Horizontal bars, one per category, longest first by the caller: the name and total above a
 * thin bar split into its series (2px surface gaps, a 4px rounded end, square at the baseline).
 * Each row is a hover / focus target with its breakdown.
 */
export function BarRows({ label, rows }: { label: string; rows: readonly BarRow[] }) {
  const [active, setActive] = useState<string | null>(null)
  const tipId = useId()
  const max = Math.max(1, ...rows.map((row) => row.total))
  return (
    <ul aria-label={label} className="grid gap-2.5">
      {rows.map((row) => {
        const parts = row.parts.filter((part) => part.value > 0)
        const breakdown = row.parts
          .filter((part) => part.value > 0)
          .map((part) => `${part.label} ${formatCount(part.value)}`)
          .join(', ')
        return (
          <li key={row.key} className="relative">
            <div
              role="img"
              tabIndex={0}
              aria-label={`${row.label}: ${formatCount(row.total)}${breakdown && row.parts.length > 1 ? ` (${breakdown})` : ''}`}
              aria-describedby={active === row.key ? tipId : undefined}
              onPointerEnter={() => {
                setActive(row.key)
              }}
              onPointerLeave={() => {
                setActive(null)
              }}
              onFocus={() => {
                setActive(row.key)
              }}
              onBlur={() => {
                setActive(null)
              }}
              className={cn(
                'grid gap-1 rounded-sm py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                active !== null && active !== row.key && 'opacity-60',
              )}
            >
              <span className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-field-foreground">{row.label}</span>
                <span className="shrink-0 font-medium text-heading tabular-nums">
                  {formatCount(row.total)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="flex h-2.5 gap-[2px]"
                style={{
                  width: `${String(Math.max(row.total > 0 ? 2 : 0, (row.total / max) * 100))}%`,
                }}
              >
                {parts.map((part, index) => (
                  <span
                    key={part.key}
                    style={{ flexGrow: part.value, flexBasis: 0 }}
                    className={cn(
                      'block h-full min-w-[3px]',
                      TONE_BG[part.tone],
                      index === parts.length - 1 && 'rounded-r-[4px]',
                    )}
                  />
                ))}
              </span>
            </div>
            {active === row.key && row.parts.length > 1 && (
              <Tip
                id={tipId}
                title={`${row.label}: ${formatCount(row.total)}`}
                className="top-full right-0 mt-1"
                lines={row.parts.map((part) => ({
                  key: part.key,
                  label: part.label,
                  value: formatCount(part.value),
                  tone: part.tone,
                }))}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

// --- columns over months -------------------------------------------------------------------------

export interface ColumnSeries {
  key: string
  label: string
  tone: Tone
  values: readonly number[]
}

const PAD = { top: 10, right: 6, bottom: 22, left: 34 }

/**
 * Columns per label (month): stacked (part of a whole, 2px surface gaps between the parts, the
 * top part rounded) or grouped side by side. Hairline grid, compact ticks, one tooltip per
 * label on hover or keyboard focus with every series and the `extra` lines. The SVG is drawn
 * at the box's own width, so text keeps its size on a phone.
 */
export function ColumnChart({
  label,
  labels,
  longLabels,
  series,
  stacked = false,
  highlight,
  extra,
  height = 200,
}: {
  label: string
  labels: readonly string[]
  /** Tooltip titles ("October 2026"); `labels` when left out. */
  longLabels?: readonly string[] | undefined
  series: readonly ColumnSeries[]
  stacked?: boolean
  /** The label to mark (the chosen month). */
  highlight?: number | undefined
  /** More tooltip lines for a label (a rate, a note). */
  extra?: ((index: number) => readonly { key: string; label: string; value: string }[]) | undefined
  height?: number
}) {
  const [ref, measured] = useElementWidth()
  const [active, setActive] = useState<number | null>(null)
  const tipId = useId()
  const width = Math.max(240, measured ?? 560)
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = height - PAD.top - PAD.bottom
  const base = PAD.top + plotHeight
  const totals = labels.map((_, index) =>
    stacked
      ? series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0)
      : Math.max(0, ...series.map((item) => item.values[index] ?? 0)),
  )
  const max = niceMax(Math.max(0, ...totals))
  const y = (value: number) => base - (value / max) * plotHeight
  const slot = plotWidth / Math.max(1, labels.length)
  const gap = 2
  const groupWidth = stacked ? Math.min(24, slot * 0.6) : Math.min(28, slot * 0.72)
  const bar = stacked
    ? groupWidth
    : Math.min(14, (groupWidth - gap * (series.length - 1)) / Math.max(1, series.length))
  const every = slot < 26 ? 2 : 1
  const ticks = [0, 0.5, 1].map((share) => share * max)

  /** A column with a 4px rounded top and a square bottom. */
  const column = (x: number, top: number, bottom: number, w: number, round: boolean) => {
    const h = bottom - top
    if (h <= 0) return ''
    const r = round ? Math.min(4, w / 2, h) : 0
    return `M${String(x)},${String(bottom)} V${String(top + r)} Q${String(x)},${String(top)} ${String(x + r)},${String(top)} H${String(x + w - r)} Q${String(x + w)},${String(top)} ${String(x + w)},${String(top + r)} V${String(bottom)} Z`
  }

  const activeIndex = active ?? -1
  const tipTitle = (longLabels ?? labels)[activeIndex] ?? ''

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-auto">
      <svg
        role="group"
        aria-label={label}
        width={width}
        height={height}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        className="block"
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
              x={PAD.left - 6}
              y={y(value)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {formatCompact(value)}
            </text>
          </g>
        ))}
        {labels.map((name, index) => {
          const left = PAD.left + slot * index + (slot - groupWidth) / 2
          const dim = active !== null && active !== index
          let floor = base
          const shapes = series.map((item, position) => {
            const value = item.values[index] ?? 0
            if (value <= 0) return null
            if (stacked) {
              const top = y(value) - (base - floor)
              const bottom = floor === base ? floor : floor - gap
              floor = top
              const isTop = series
                .slice(position + 1)
                .every((next) => (next.values[index] ?? 0) <= 0)
              return (
                <path
                  key={item.key}
                  d={column(left, top, bottom, bar, isTop)}
                  className={cn(TONE_FILL[item.tone], 'transition-opacity', dim && 'opacity-40')}
                />
              )
            }
            return (
              <path
                key={item.key}
                d={column(left + position * (bar + gap), y(value), base, bar, true)}
                className={cn(TONE_FILL[item.tone], 'transition-opacity', dim && 'opacity-40')}
              />
            )
          })
          return (
            <g key={name}>
              {shapes}
              <rect
                x={PAD.left + slot * index}
                y={PAD.top}
                width={slot}
                height={plotHeight + PAD.bottom - 4}
                fill="transparent"
                role="img"
                tabIndex={0}
                aria-label={`${(longLabels ?? labels)[index] ?? name}: ${series
                  .map((item) => `${item.label} ${formatCount(item.values[index] ?? 0)}`)
                  .join(', ')}`}
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
              {index % every === 0 || index === highlight ? (
                <text
                  x={PAD.left + slot * index + slot / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className={cn(
                    'pointer-events-none text-[10px]',
                    index === highlight ? 'fill-heading font-semibold' : 'fill-muted-foreground',
                  )}
                >
                  {name}
                </text>
              ) : null}
            </g>
          )
        })}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={base}
          y2={base}
          className="stroke-input"
          strokeWidth={1}
        />
      </svg>
      {active !== null && (
        <Tip
          id={tipId}
          title={tipTitle}
          className="top-0"
          // Beside its column, kept inside the box.
          style={{
            left: `${String(Math.max(0, Math.min(PAD.left + slot * active + slot / 2 + 8, width - 168)))}px`,
          }}
          lines={[
            ...series.map((item) => ({
              key: item.key,
              label: item.label,
              value: formatCount(item.values[active] ?? 0),
              tone: item.tone,
            })),
            ...(extra?.(active) ?? []),
          ]}
        />
      )}
    </div>
  )
}
