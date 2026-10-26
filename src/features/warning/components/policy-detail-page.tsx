import type { ReactNode } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, Gavel, Pencil } from 'lucide-react'

import {
  DataTable,
  type DataTableColumn,
  PageContainer,
  PageHeader,
  splitPageClassName,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { warningPolicyQueryOptions } from '../api/warning-policy.queries'
import {
  CLOCK_EVENT_LABELS,
  POLICY_NAME_LABELS,
  TIME_SPAN_LABELS,
  WEEKDAY_OPTIONS,
} from '../constants'
import {
  DEDUCTION_LABELS,
  ordinal,
  PENALTY_PERIOD_LABELS,
  penaltyLabel,
} from '../penalty-constants'
import type { PolicyPenaltyRule, PolicyRule } from '../types/warning-policy.types'
import { formatServerTime } from '../utils/server-time'
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

function weekdayLabel(day: string | null): string {
  if (!day) return '—'
  return WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? day
}

const ruleColumns: DataTableColumn<PolicyRule>[] = [
  {
    id: 'clockEvent',
    header: 'Clock Event',
    mobile: 'heading',
    cell: (rule) => CLOCK_EVENT_LABELS[rule.clockEvent],
  },
  { id: 'minutes', header: 'Minutes', align: 'right', cell: (rule) => `${rule.minutes} min` },
  {
    id: 'occurrences',
    header: 'Warn every',
    align: 'right',
    cell: (rule) =>
      rule.occurrenceCount === 1 ? 'Every counted day' : `${ordinal(rule.occurrenceCount)} day`,
  },
]

const penaltyColumns: DataTableColumn<PolicyPenaltyRule>[] = [
  {
    id: 'count',
    header: 'Warning',
    mobile: 'heading',
    cell: (rule) =>
      `${ordinal(rule.afterCount)} in a ${PENALTY_PERIOD_LABELS[rule.period].toLowerCase()}`,
  },
  { id: 'penalty', header: 'Penalty', cell: (rule) => penaltyLabel(rule) },
  {
    id: 'deduction',
    header: 'Deduction',
    cell: (rule) =>
      `${DEDUCTION_LABELS[rule.deduction]}${rule.leaveTypeTitle ? ` (${rule.leaveTypeTitle})` : ''}`,
  },
]

/** Read-only view of one policy (`/warning/policy/$policyId`): summary, rules and penalties. */
export function PolicyDetailPage() {
  const { policyId } = routeApi.useParams()
  const { data: policy } = useSuspenseQuery(warningPolicyQueryOptions(policyId))
  const canEdit = useCan('warning.settings.policies.edit')
  const canEditPenalties = useCan('warning.settings.penalties.edit')
  const tableClass =
    'font-inter [&_td:not([colspan])]:text-foreground [&_th]:font-semibold [&_th]:text-foreground'

  return (
    <PageContainer>
      {/* Wide screens: summary on the left, the rules and penalties on the right. */}
      <div
        className={cn(splitPageClassName, '@[90rem]/page:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}
      >
        <PageHeader
          className={cn('@[90rem]/page:col-span-2', warningType.pageHeader)}
          title={policy.title}
          description={`${POLICY_NAME_LABELS[policy.appliesTo]} · ${TIME_SPAN_LABELS[policy.period]}`}
          actions={
            <>
              <Button variant="outline" asChild>
                <Link to="/warning/policy">
                  <ArrowLeft /> Back
                </Link>
              </Button>
              {canEditPenalties && (
                <Button variant="outline" asChild>
                  <Link to="/warning/penalty" search={{ edit: policy.id }}>
                    <Gavel /> Penalties
                  </Link>
                </Button>
              )}
              {canEdit && (
                <Button asChild>
                  <Link to="/warning/policy" search={{ edit: policy.id }}>
                    <Pencil /> Edit
                  </Link>
                </Button>
              )}
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
              <Detail label="Policy Name">{POLICY_NAME_LABELS[policy.appliesTo]}</Detail>
              <Detail label="Title of Warning Policy">{policy.title}</Detail>
              <Detail label="Time Span">{TIME_SPAN_LABELS[policy.period]}</Detail>
              <Detail label="Total Grace Minutes">
                {policy.graceMinutes === null ? 'None' : `${policy.graceMinutes} min`}
              </Detail>
              {policy.period === 'week' && (
                <Detail label="Week">
                  {weekdayLabel(policy.weekStartDay)} – {weekdayLabel(policy.weekEndDay)}
                </Detail>
              )}
              <Detail label="Status">{policy.isActive ? 'Active' : 'Inactive'}</Detail>
              <Detail label="Warnings raised">{policy.warningCount}</Detail>
              <Detail label="Created">{formatServerTime(policy.createdAt)}</Detail>
              <Detail label="Last updated">{formatServerTime(policy.updatedAt)}</Detail>
            </dl>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <Card aria-labelledby="policy-rules-title" className={tableClass}>
            <CardHeader>
              <CardTitle id="policy-rules-title" className="text-lg font-medium sm:text-xl">
                Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption={`Rules of ${policy.title}`}
                columns={ruleColumns}
                data={policy.rules}
                getRowId={(rule) => rule.clockEvent}
                className="text-sm sm:text-sm"
              />
            </CardContent>
          </Card>

          <Card aria-labelledby="policy-penalties-title" className={tableClass}>
            <CardHeader>
              <CardTitle id="policy-penalties-title" className="text-lg font-medium sm:text-xl">
                Penalties
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption={`Penalties of ${policy.title}`}
                columns={penaltyColumns}
                data={policy.penalties}
                getRowId={(rule) => rule.id}
                emptyState="No penalties for this policy."
                className="text-sm sm:text-sm"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
