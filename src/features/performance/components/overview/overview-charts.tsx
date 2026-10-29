import { type ReactNode, useState } from 'react'
import { Menu } from 'lucide-react'

import { useElementWidth } from '@/hooks/use-element-width'

/*
 * The Overview's two small charts, drawn as inline SVG in the look of the Payroll dashboard
 * (dashed grid, #9AA4B0 axis text, navy marks): goals by status as bars, and the final rating
 * of each cycle as columns. Each has one series, so no legend; every mark carries its number as
 * text, and the ≡ button switches to a table of the same values.
 */

export interface ChartDatum {
  label: string
  value: number
  /** Written beside or over the mark (default: the value). */
  text?: string
}

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
      className="flex size-7 items-center justify-center rounded text-[#6E8192] outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Menu aria-hidden="true" className="size-[1.125rem]" strokeWidth={2.4} />
    </button>
  )
}

function TableView({
  title,
  heading,
  valueHeading,
  data,
}: {
  title: string
  heading: string
  valueHeading: string
  data: readonly ChartDatum[]
}) {
  return (
    <div className="relative scrollbar-thin max-h-72 overflow-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}</caption>
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium text-heading">
              {heading}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-heading">
              {valueHeading}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label} className="border-t">
              <th scope="row" className="px-3 py-1.5 font-normal text-field-foreground">
                {item.label}
              </th>
              <td className="px-3 py-1.5 text-right text-heading tabular-nums">
                {item.text ?? String(item.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartFrame({
  title,
  heading,
  valueHeading,
  data,
  children,
}: {
  title: string
  heading: string
  valueHeading: string
  data: readonly ChartDatum[]
  children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <div className="grid gap-2">
      <div className="flex justify-end">
        <ViewToggle
          title={title}
          asTable={asTable}
          onToggle={() => {
            setAsTable((value) => !value)
          }}
        />
      </div>
      {asTable ? (
        <TableView title={title} heading={heading} valueHeading={valueHeading} data={data} />
      ) : (
        children
      )}
    </div>
  )
}

const BAR = 18
const GAP = 12
const LABEL_WIDTH = 104
const VALUE_WIDTH = 44

/** Horizontal bars, one per category, the count written at the end of each. */
export function BarChart({
  title,
  heading,
  valueHeading,
  data,
  colour,
}: {
  title: string
  heading: string
  valueHeading: string
  data: readonly ChartDatum[]
  /** A CSS colour; by default navy (the primary colour in dark mode). */
  colour?: string | undefined
}) {
  const [ref, measured] = useElementWidth()
  const width = Math.max(260, measured ?? 420)
  const plot = width - LABEL_WIDTH - VALUE_WIDTH
  const max = Math.max(1, ...data.map((item) => item.value))
  const height = data.length * (BAR + GAP) + GAP
  return (
    <ChartFrame title={title} heading={heading} valueHeading={valueHeading} data={data}>
      <div ref={ref} className="w-full">
        <svg
          role="img"
          aria-label={`${title}: ${data.map((item) => `${item.label} ${item.text ?? String(item.value)}`).join(', ')}`}
          width={width}
          height={height}
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          className="block h-auto max-w-full"
        >
          {data.map((item, index) => {
            const y = GAP + index * (BAR + GAP)
            const length = (item.value / max) * plot
            return (
              <g key={item.label}>
                <text
                  x={LABEL_WIDTH - 8}
                  y={y + BAR / 2}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-[#5C6B7A] text-[0.6875rem] dark:fill-[#A9B4C2]"
                >
                  {item.label}
                </text>
                <rect
                  x={LABEL_WIDTH}
                  y={y}
                  width={plot}
                  height={BAR}
                  rx={4}
                  className="fill-[#EEF1F7] dark:fill-[#2A3242]"
                />
                <rect
                  x={LABEL_WIDTH}
                  y={y}
                  width={Math.max(item.value > 0 ? 3 : 0, length)}
                  height={BAR}
                  rx={4}
                  fill={colour}
                  className={colour ? undefined : 'fill-sidebar dark:fill-primary'}
                />
                <text
                  x={LABEL_WIDTH + plot + 8}
                  y={y + BAR / 2}
                  dy="0.32em"
                  className="fill-[#303030] text-xs font-medium dark:fill-[#E6E9EF]"
                >
                  {item.text ?? String(item.value)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </ChartFrame>
  )
}

const PAD = { top: 18, right: 12, bottom: 34, left: 34 }

/** Columns on a fixed scale (the rating scale), the value written over each column. */
export function ColumnChart({
  title,
  heading,
  valueHeading,
  data,
  max,
  ticks,
  colour,
  height = 200,
}: {
  title: string
  heading: string
  valueHeading: string
  data: readonly ChartDatum[]
  max: number
  ticks: readonly number[]
  /** A CSS colour; by default navy (the primary colour in dark mode). */
  colour?: string | undefined
  height?: number
}) {
  const [ref, measured] = useElementWidth()
  const width = Math.max(260, measured ?? 420)
  const plotWidth = width - PAD.left - PAD.right
  const plotHeight = height - PAD.top - PAD.bottom
  const slot = plotWidth / Math.max(1, data.length)
  const barWidth = Math.min(40, slot * 0.5)
  const y = (value: number) => PAD.top + plotHeight - (Math.min(value, max) / max) * plotHeight
  return (
    <ChartFrame title={title} heading={heading} valueHeading={valueHeading} data={data}>
      <div ref={ref} className="w-full">
        <svg
          role="img"
          aria-label={`${title}: ${data.map((item) => `${item.label} ${item.text ?? String(item.value)}`).join(', ')}`}
          width={width}
          height={height}
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          className="block h-auto max-w-full"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#E9EDF2"
                strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-[#9AA4B0] text-[0.5625rem]"
              >
                {tick}
              </text>
            </g>
          ))}
          {data.map((item, index) => {
            const centre = PAD.left + slot * index + slot / 2
            const top = y(item.value)
            return (
              <g key={item.label}>
                <rect
                  x={centre - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={Math.max(0, PAD.top + plotHeight - top)}
                  rx={4}
                  fill={colour}
                  className={colour ? undefined : 'fill-sidebar dark:fill-primary'}
                />
                <text
                  x={centre}
                  y={top - 5}
                  textAnchor="middle"
                  className="fill-[#303030] text-[0.6875rem] font-medium dark:fill-[#E6E9EF]"
                >
                  {item.text ?? String(item.value)}
                </text>
                <text
                  x={centre}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-[#9AA4B0] text-[0.5625rem] font-semibold"
                >
                  {item.label.length > 18 ? `${item.label.slice(0, 17)}…` : item.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </ChartFrame>
  )
}
