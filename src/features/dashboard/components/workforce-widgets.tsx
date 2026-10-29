import { format, parse } from 'date-fns'

import type { Workforce } from '../api/dashboard.api'
import { formatCount, formatMonthYear, formatPercent, plural, shareOf } from '../utils/format'
import type { DashLink } from '../utils/links'
import {
  type BarRow,
  BarRows,
  ChartFigure,
  ChartTable,
  ColumnChart,
  type Part,
  PartBar,
} from './charts'
import { type QueryState, Widget, WidgetBody, WidgetLink } from './widget'

/*
 * The workforce cards (CEO and HR dashboards), all from `workforce` of the dashboard read.
 * Series keep their slot everywhere: women slot 1, men slot 2, other slot 3, not set grey.
 */

const genderParts = (women: number, men: number, other: number, notSet = 0): Part[] => [
  { key: 'women', label: 'Women', value: women, tone: 1 },
  { key: 'men', label: 'Men', value: men, tone: 2 },
  ...(other > 0 ? [{ key: 'other', label: 'Other', value: other, tone: 3 as const }] : []),
  ...(notSet > 0
    ? [{ key: 'not-set', label: 'Not set', value: notSet, tone: 'rest' as const }]
    : []),
]

/** By department, largest first: each bar split by gender, the rest of its count "not set". */
export function DepartmentWidget({
  query,
  link,
}: {
  query: QueryState<Workforce>
  link?: DashLink | undefined
}) {
  return (
    <Widget
      title="By department"
      description={query.data ? plural(query.data.byDepartment.length, 'department') : undefined}
      action={link && <WidgetLink link={link} label="Employees" name="Open the employee list" />}
    >
      <WidgetBody
        query={query}
        what="Headcount by department"
        skeleton="list"
        isEmpty={(data) => data.byDepartment.length === 0}
        empty="No employees are on the books."
      >
        {(data) => {
          const rows: BarRow[] = data.byDepartment
            .toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .map((item) => {
              const split = data.byDepartmentGender.find(
                (row) => row.id === item.id && row.name === item.name,
              )
              const women = split?.women ?? 0
              const men = split?.men ?? 0
              return {
                key: item.id ?? item.name,
                label: item.name,
                total: item.count,
                parts: genderParts(women, men, 0, Math.max(0, item.count - women - men)),
              }
            })
          const hasRest = rows.some((row) => row.parts.some((part) => part.key === 'not-set'))
          return (
            <ChartFigure
              label="headcount by department"
              legend={[
                { key: 'women', label: 'Women', tone: 1 },
                { key: 'men', label: 'Men', tone: 2 },
                ...(hasRest
                  ? [{ key: 'rest', label: 'Other or not set', tone: 'rest' as const }]
                  : []),
              ]}
              table={{
                caption: 'Headcount by department',
                head: ['Department', 'Women', 'Men', 'Total'],
                rows: rows.map((row) => ({
                  key: row.key,
                  cells: [
                    row.label,
                    formatCount(row.parts.find((part) => part.key === 'women')?.value ?? 0),
                    formatCount(row.parts.find((part) => part.key === 'men')?.value ?? 0),
                    formatCount(row.total),
                  ],
                })),
              }}
            >
              <BarRows label="Headcount by department" rows={rows} />
            </ChartFigure>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

/** Women and men as one part-of-whole bar, then the age bands split by gender. */
export function GenderAgeWidget({ query }: { query: QueryState<Workforce> }) {
  return (
    <Widget
      title="Gender and age"
      description={query.data ? `${formatPercent(query.data.womenPercent)} women` : undefined}
    >
      <WidgetBody
        query={query}
        what="Gender and age"
        isEmpty={(data) => data.headcount === 0}
        empty="No employees are on the books."
      >
        {(data) => {
          const count = (gender: string) =>
            data.byGender.find((item) => item.gender === gender)?.count ?? 0
          const other = data.byGender
            .filter((item) => item.gender !== 'male' && item.gender !== 'female')
            .reduce((sum, item) => sum + item.count, 0)
          const aged = data.byAge.reduce((sum, row) => sum + row.male + row.female + row.other, 0)
          const ageRows: BarRow[] = data.byAge.map((row) => ({
            key: row.band,
            label: row.band,
            total: row.male + row.female + row.other,
            parts: genderParts(row.female, row.male, row.other),
          }))
          return (
            <div className="grid gap-5">
              <PartBar
                label="Headcount by gender"
                parts={genderParts(count('female'), count('male'), other)}
              />
              <ChartFigure
                label="headcount by age band"
                table={{
                  caption: 'Headcount by age band',
                  head: ['Age band', 'Women', 'Men', 'Other', 'Total'],
                  rows: data.byAge.map((row) => ({
                    key: row.band,
                    cells: [
                      row.band,
                      formatCount(row.female),
                      formatCount(row.male),
                      formatCount(row.other),
                      formatCount(row.male + row.female + row.other),
                    ],
                  })),
                }}
              >
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-field-foreground">Age bands</p>
                  <BarRows label="Headcount by age band" rows={ageRows} />
                  {aged < data.headcount && (
                    <p className="text-xs text-muted-foreground">
                      {plural(data.headcount - aged, 'employee')} without a date of birth.
                    </p>
                  )}
                </div>
              </ChartFigure>
            </div>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

/** Headcount by employment type (one series). */
export function EmploymentTypeWidget({ query }: { query: QueryState<Workforce> }) {
  return (
    <Widget title="Employment type">
      <WidgetBody
        query={query}
        what="Employment type"
        skeleton="list"
        isEmpty={(data) => data.byEmploymentType.every((item) => item.id === null)}
        empty="No employment types are set on the employee records yet."
      >
        {(data) => {
          const rows: BarRow[] = data.byEmploymentType.map((item) => ({
            key: item.id ?? 'not-set',
            label: item.name,
            total: item.count,
            parts: [
              {
                key: 'count',
                label: item.name,
                value: item.count,
                tone: item.id === null ? 'rest' : 1,
              },
            ],
          }))
          return (
            <ChartFigure
              label="headcount by employment type"
              table={{
                caption: 'Headcount by employment type',
                head: ['Employment type', 'Employees', 'Share'],
                rows: rows.map((row) => ({
                  key: row.key,
                  cells: [
                    row.label,
                    formatCount(row.total),
                    formatPercent(shareOf(row.total, data.headcount)),
                  ],
                })),
              }}
            >
              <BarRows label="Headcount by employment type" rows={rows} />
            </ChartFigure>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

const monthLabel = (value: string, pattern: string) =>
  format(parse(value.slice(0, 7), 'yyyy-MM', new Date()), pattern)

/** Hires and leavers per month over the twelve months to the chosen one, with turnover. */
export function TurnoverWidget({ query }: { query: QueryState<Workforce> }) {
  return (
    <Widget
      title="Hires and leavers"
      description={
        query.data
          ? `Turnover ${formatPercent(query.data.turnoverPercent)} in ${formatMonthYear(query.data.month)}`
          : undefined
      }
    >
      <WidgetBody
        query={query}
        what="Hires and leavers"
        isEmpty={(data) => data.turnoverByMonth.every((row) => row.hired + row.left === 0)}
        empty="No one joined or left in the last twelve months."
      >
        {(data) => {
          const months = data.turnoverByMonth
          return (
            <ChartFigure
              label="hires and leavers by month"
              legend={[
                { key: 'hired', label: 'Hired', tone: 1 },
                { key: 'left', label: 'Left', tone: 2 },
              ]}
              table={{
                caption: 'Hires and leavers by month',
                head: ['Month', 'Hired', 'Left'],
                rows: months.map((row) => ({
                  key: row.month,
                  cells: [
                    monthLabel(row.month, 'MMMM yyyy'),
                    formatCount(row.hired),
                    formatCount(row.left),
                  ],
                })),
              }}
            >
              <ColumnChart
                label="Hires and leavers per month, last twelve months"
                labels={months.map((row) => monthLabel(row.month, 'MMM'))}
                longLabels={months.map((row) => monthLabel(row.month, 'MMMM yyyy'))}
                highlight={months.length - 1}
                height={180}
                series={[
                  { key: 'hired', label: 'Hired', tone: 1, values: months.map((row) => row.hired) },
                  { key: 'left', label: 'Left', tone: 2, values: months.map((row) => row.left) },
                ]}
              />
            </ChartFigure>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}

const TITLE_ROWS = 6

/** The job titles with the most women: a short table with each title's share. */
export function WomenByTitleWidget({
  query,
  className,
}: {
  query: QueryState<Workforce>
  className?: string
}) {
  return (
    <Widget
      title="Women by job title"
      className={className}
      description={
        query.data
          ? `${plural(query.data.women, 'woman', 'women')} of ${formatCount(query.data.headcount)}`
          : undefined
      }
    >
      <WidgetBody
        query={query}
        what="Women by job title"
        skeleton="list"
        isEmpty={(data) => data.womenByJobTitle.length === 0}
        empty="No job titles are set on the employee records."
      >
        {(data) => {
          const rows = data.womenByJobTitle
            .toSorted(
              (a, b) =>
                b.women - a.women ||
                b.womenPercent - a.womenPercent ||
                a.name.localeCompare(b.name),
            )
            .slice(0, TITLE_ROWS)
          return (
            <div className="grid gap-2">
              <ChartTable
                spec={{
                  caption: 'Women by job title',
                  head: ['Job title', 'Women', 'Total', 'Share'],
                  rows: rows.map((row) => ({
                    key: row.id ?? row.name,
                    cells: [
                      row.name,
                      formatCount(row.women),
                      formatCount(row.total),
                      formatPercent(row.womenPercent),
                    ],
                  })),
                }}
              />
              {data.womenByJobTitle.length > TITLE_ROWS && (
                <p className="text-xs text-muted-foreground">
                  The {TITLE_ROWS} titles with the most women, of{' '}
                  {plural(data.womenByJobTitle.length, 'job title')}.
                </p>
              )}
            </div>
          )
        }}
      </WidgetBody>
    </Widget>
  )
}
