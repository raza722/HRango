import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Banknote,
  Building2,
  CreditCard,
  Hourglass,
  LifeBuoy,
  TrendingUp,
} from 'lucide-react'

import type { AppPath } from '@/app/navigation'
import { ErrorState } from '@/components/feedback/error-state'
import { PageContainer, PageHeader } from '@/components/layout'
import { BarRows, ColumnChart } from '@/features/dashboard/components/charts'
import { KpiRow, KpiTile } from '@/features/dashboard/components/kpi-tiles'
import { Widget, WidgetEmpty } from '@/features/dashboard/components/widget'
import { formatCount } from '@/features/dashboard/utils/format'
import { usePlatformStore } from '@/stores/platform-store'

import { formatDate, formatMoney, labelOf } from '../format'
import { usePlatformDashboard } from '../hooks/use-platform'
import { canOpenPlatform } from '../platform-nav'
import { StatusChip } from './shared'

function shortMonth(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })
}

/** How hRango itself is doing: organisations, subscriptions, money, sales and support. */
export function PlatformDashboardPage() {
  const role = usePlatformStore((state) => state.staff?.role)
  const dashboard = usePlatformDashboard()
  const data = dashboard.data
  const figures = data?.figures
  const loading = dashboard.isPending
  const linkTo = (to: AppPath) => (canOpenPlatform(role, to) ? { to } : undefined)

  if (dashboard.isError && !data) {
    return (
      <ErrorState
        message={dashboard.error.message}
        onRetry={() => {
          void dashboard.refetch()
        }}
      />
    )
  }

  return (
    <PageContainer>
      <PageHeader title="Dashboard" description="hRango across every organisation." />

      <KpiRow label="Key figures" columns="eight">
        <KpiTile
          label="Organisations registered"
          value={formatCount(figures?.organisations ?? 0)}
          note={`${formatCount(figures?.newThisMonth ?? 0)} new this month, ${formatCount(figures?.employees ?? 0)} employees`}
          icon={Building2}
          link={linkTo('/platform/organisations')}
          loading={loading}
        />
        <KpiTile
          label="Paying subscriptions"
          value={formatCount(figures?.payingSubscriptions ?? 0)}
          note={`${formatCount(figures?.pastDueSubscriptions ?? 0)} past due`}
          icon={CreditCard}
          link={linkTo('/platform/subscriptions')}
          loading={loading}
        />
        <KpiTile
          label="On trial"
          value={formatCount(figures?.trials ?? 0)}
          note="Organisations trying hRango"
          icon={Hourglass}
          link={linkTo('/platform/subscriptions')}
          loading={loading}
        />
        <KpiTile
          label="Suspended"
          value={formatCount(figures?.suspendedOrganisations ?? 0)}
          note={`${formatCount(figures?.cancelledOrganisations ?? 0)} cancelled`}
          icon={AlertTriangle}
          link={linkTo('/platform/organisations')}
          loading={loading}
        />
        {figures?.monthlyRevenue != null && (
          <KpiTile
            label="Monthly revenue"
            value={formatMoney(figures.monthlyRevenue)}
            note={`${formatMoney(figures.paidThisMonth ?? 0)} paid this month`}
            icon={Banknote}
            link={linkTo('/platform/invoices')}
          />
        )}
        {figures?.overdueInvoices != null && (
          <KpiTile
            label="Overdue invoices"
            value={formatCount(figures.overdueInvoices)}
            note={formatMoney(figures.overdueAmount ?? 0)}
            icon={AlertTriangle}
            link={linkTo('/platform/invoices')}
          />
        )}
        <KpiTile
          label="Open leads"
          value={formatCount(figures?.openLeads ?? 0)}
          note={
            figures?.pipelineMonthly != null
              ? `${formatMoney(figures.pipelineMonthly)} a month`
              : 'In the sales pipeline'
          }
          icon={TrendingUp}
          link={linkTo('/platform/sales')}
          loading={loading}
        />
        <KpiTile
          label="Open tickets"
          value={formatCount(figures?.openTickets ?? 0)}
          note={`${formatCount(figures?.urgentTickets ?? 0)} urgent`}
          icon={LifeBuoy}
          link={linkTo('/platform/support')}
          loading={loading}
        />
      </KpiRow>

      {data && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-5 @4xl/page:grid-cols-2">
          <Widget title="Organisations registered" description="By month, last 12 months">
            <ColumnChart
              label="Organisations registered by month"
              labels={data.months.map((row) => shortMonth(row.month))}
              series={[
                {
                  key: 'organisations',
                  label: 'Organisations',
                  tone: 1,
                  values: data.months.map((row) => row.organisations),
                },
              ]}
            />
          </Widget>

          <Widget title="Subscriptions by plan" description="Not counting cancelled">
            {data.plans.length === 0 ? (
              <WidgetEmpty>No plans yet.</WidgetEmpty>
            ) : (
              <BarRows
                label="Subscriptions by plan"
                rows={data.plans.map((row) => ({
                  key: row.plan,
                  label: row.plan,
                  total: row.subscriptions,
                  parts: [
                    { key: 'count', label: 'Subscriptions', value: row.subscriptions, tone: 1 },
                  ],
                }))}
              />
            )}
          </Widget>

          <Widget title="Sales pipeline" description="Leads by stage">
            <BarRows
              label="Leads by stage"
              rows={data.stages.map((row) => ({
                key: row.stage,
                label: labelOf(row.stage),
                total: row.leads,
                parts: [{ key: 'count', label: 'Leads', value: row.leads, tone: 1 }],
              }))}
            />
          </Widget>

          <Widget title="Renewals due" description="In the next 30 days">
            {data.renewals.length === 0 ? (
              <WidgetEmpty>Nothing is due.</WidgetEmpty>
            ) : (
              <ul className="grid gap-3">
                {data.renewals.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <Link
                        to="/platform/organisations/$id"
                        params={{ id: row.customerId }}
                        className="block truncate font-medium text-title hover:underline"
                      >
                        {row.customerName}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {row.planName} · {formatDate(row.renewsOn)}
                      </span>
                    </span>
                    <StatusChip value={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </Widget>
        </div>
      )}
    </PageContainer>
  )
}
