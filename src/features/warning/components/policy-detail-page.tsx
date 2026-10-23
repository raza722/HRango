import type { ReactNode } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'

import {
  DataTable,
  type DataTableColumn,
  PageContainer,
  PageHeader,
  splitPageClassName,
} from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime, formatDisplayDate, formatTimeValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { warningPolicyQueryOptions } from '../api/warning-policy.queries'
import {
  CLOCK_EVENT_LABELS,
  MONTH_LABELS,
  POLICY_NAME_LABELS,
  TIME_SPAN_COPY,
  WEEKDAY_OPTIONS,
} from '../constants'
import type { PolicyPeriod, TimeSpan } from '../types/warning-policy.types'
import { warningType } from './type-styles'

const routeApi = getRouteApi('/_app/warning/policy/$policyId')

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    // As the form fields: label Inter Regular 13.2 #94A3B8, value Inter Regular 14 #475569.
    <div className="grid gap-1.5">
      <dt className="text-[0.825rem] text-label">{label}</dt>
      <dd className="text-sm text-field-value">{children}</dd>
    </div>
  )
}

function weekdayLabel(day: string): string {
  return WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? day
}

function periodColumns(timeSpan: TimeSpan): DataTableColumn<PolicyPeriod & { key: string }>[] {
  const copy = TIME_SPAN_COPY[timeSpan]
  const weekly = timeSpan === 'weekly'
  return [
    {
      id: 'index',
      header: '#',
      cell: (_period, index) => index + 1,
      className: 'w-12',
      mobile: 'hidden',
    },
    {
      id: 'range',
      header: weekly ? 'Week' : 'Period',
      mobile: 'heading',
      className: 'min-w-32 whitespace-normal',
      cell: (period) =>
        weekly
          ? `${weekdayLabel(period.startDay)} – ${weekdayLabel(period.endDay)}`
          : `${formatDisplayDate(period.startDay)} – ${formatDisplayDate(period.endDay)}`,
    },
    {
      id: 'applies',
      header: 'Applies',
      cell: (period) =>
        weekly ? (
          <span className="flex flex-wrap gap-1">
            {period.weekdays.map((day) => (
              <Badge key={day} variant="outline">
                {WEEKDAY_OPTIONS.find((option) => option.value === day)?.short ?? day}
              </Badge>
            ))}
          </span>
        ) : (
          `${period.month === null ? '' : `${MONTH_LABELS[period.month] ?? ''} · `}Day ${period.day}`
        ),
    },
    {
      id: 'clock',
      header: `${copy.clockInLabel} – ${copy.clockOutLabel}`,
      className: 'min-w-28 whitespace-normal',
      cell: (period) => `${formatTimeValue(period.clockIn)} – ${formatTimeValue(period.clockOut)}`,
    },
    {
      id: 'grace',
      header: 'Total grace',
      align: 'right',
      cell: (period) => `${period.totalGraceMinutes} min`,
    },
    { id: 'minutes', header: 'Minutes', align: 'right', cell: (period) => `${period.minutes} min` },
  ]
}

/** Read-only view of one policy (`/warning/policy/$policyId`). */
export function PolicyDetailPage() {
  const { policyId } = routeApi.useParams()
  const { data: policy } = useSuspenseQuery(warningPolicyQueryOptions(policyId))
  const copy = TIME_SPAN_COPY[policy.timeSpan]
  const rows = policy.periods.map((period, index) => ({ ...period, key: `${index}` }))

  return (
    <PageContainer>
      {/* Wide screens: summary on the left, the rules table on the right. */}
      <div
        className={cn(splitPageClassName, '@[90rem]/page:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}
      >
        <PageHeader
          className={cn('@[90rem]/page:col-span-2', warningType.pageHeader)}
          title={policy.title}
          description={`${POLICY_NAME_LABELS[policy.policyName]} · ${copy.title}`}
          actions={
            <>
              <Button variant="outline" asChild>
                <Link to="/warning/policy">
                  <ArrowLeft /> Back
                </Link>
              </Button>
              <Button asChild>
                <Link to="/warning/policy" search={{ edit: policy.id }}>
                  <Pencil /> Edit
                </Link>
              </Button>
            </>
          }
        />

        <Card aria-labelledby="policy-summary-title" className="font-inter">
          <CardHeader>
            <CardTitle id="policy-summary-title" className="text-lg font-medium sm:text-xl">
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 @md:grid-cols-2 @4xl:grid-cols-3 @4xl:gap-6">
              <Detail label="Policy Name">{POLICY_NAME_LABELS[policy.policyName]}</Detail>
              <Detail label="Title of Warning Policy">{policy.title}</Detail>
              <Detail label="Time Span">{copy.title}</Detail>
              <Detail label="Applies to">{CLOCK_EVENT_LABELS[policy.clockEvent]}</Detail>
              <Detail label="Created">{formatDateTime(policy.createdAt)}</Detail>
              <Detail label="Last updated">{formatDateTime(policy.updatedAt)}</Detail>
            </dl>
          </CardContent>
        </Card>

        {/* The rules table keeps 14px (six columns) with the list's Inter Semi Bold header. */}
        <Card
          aria-labelledby="policy-periods-title"
          className="font-inter [&_td:not([colspan])]:text-foreground [&_th]:font-semibold [&_th]:text-foreground"
        >
          <CardHeader>
            <CardTitle id="policy-periods-title" className="text-lg font-medium sm:text-xl">
              {copy.title} rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              caption={`${copy.title} rules of ${policy.title}`}
              columns={periodColumns(policy.timeSpan)}
              data={rows}
              getRowId={(row) => row.key}
              className="text-sm sm:text-sm"
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
