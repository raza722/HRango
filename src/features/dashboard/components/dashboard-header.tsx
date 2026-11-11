import type { ComponentType, SVGProps } from 'react'
import { Link } from '@tanstack/react-router'
import { format, subDays } from 'date-fns'
import { BriefcaseBusiness, CalendarPlus, PlayCircle, UserPlus } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { DateBox } from '@/features/attendance'
import { parseDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import type { DashboardKind } from '../api/dashboard.api'
import type { DashboardAccess } from '../hooks/use-dashboard-access'
import { DASHBOARD_MAX_DAYS, type DashboardPeriod } from '../routing'
import { formatMonthYear } from '../utils/format'
import type { DashLink } from '../utils/links'

function greeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const KIND_LABEL: Record<DashboardKind, string> = {
  hr: 'HR overview',
  ceo: 'Company overview',
  me: 'My day',
}

interface QuickAction {
  key: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  link: DashLink
  allowed: boolean
}

/**
 * The page title card: the greeting and today's date, which dashboard this is, From and To (the
 * dates the figures cover, up to today and at most a year apart) and the quick actions the user
 * may take, each opening its page. When the dates are not one month from its 1st, a line says
 * which month the monthly figures show.
 */
export function DashboardHeader({
  kind,
  name,
  now,
  period,
  onPeriodChange,
  access,
}: {
  kind: DashboardKind | null
  name: string | undefined
  now: Date
  period: DashboardPeriod
  onPeriodChange: (from: string, to: string) => void
  access: DashboardAccess
}) {
  const to = parseDateValue(period.to)
  const wholeMonth =
    period.from === `${period.month}-01` &&
    (period.to === period.monthEnd || period.to === period.today)
  const actions: QuickAction[] = [
    {
      key: 'leave',
      label: 'Apply leave',
      icon: CalendarPlus,
      link: { to: '/leaves/my-leaves' },
      allowed: access.applyLeave,
    },
    {
      key: 'employee',
      label: 'Add employee',
      icon: UserPlus,
      link: { to: '/talent-management/employees', search: { dialog: 'add' } },
      allowed: access.addEmployee && kind !== 'me',
    },
    {
      key: 'opening',
      label: 'New job opening',
      icon: BriefcaseBusiness,
      link: { to: '/recruitment/openings', search: { dialog: 'create' } },
      allowed: access.newOpening && kind !== 'me',
    },
    {
      key: 'payroll',
      label: 'Run payroll',
      icon: PlayCircle,
      link: { to: '/payroll/payrolls/monthly' },
      allowed: access.runPayroll && kind !== 'me',
    },
  ]
  const shown = actions.filter((action) => action.allowed)
  const first = name?.split(' ')[0]

  return (
    <header className="@container grid gap-4 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-[min(100%,14rem)] flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl leading-tight font-medium text-heading sm:text-2xl">
              Dashboard
            </h1>
            {kind && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary dark:bg-primary/20 dark:text-[#c4b5fd]">
                {KIND_LABEL[kind]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {greeting(now)}
            {first ? `, ${first}` : ''}.{' '}
            <time dateTime={format(now, 'yyyy-MM-dd')}>{format(now, 'EEEE, d MMMM yyyy')}</time>
          </p>
        </div>
        {kind && (
          <div className="grid w-full gap-1.5 @lg:w-auto @lg:max-w-96">
            <div
              role="group"
              aria-label="Dates the figures cover"
              className="grid grid-cols-2 gap-2 @lg:w-96"
            >
              <DateBox
                label="From"
                value={period.from}
                minDate={to ? subDays(to, DASHBOARD_MAX_DAYS - 1) : undefined}
                maxDate={to}
                onChange={(from) => {
                  onPeriodChange(from, period.to)
                }}
              />
              {/* Any day up to today: a To before From moves From to the 1st of To's month. */}
              <DateBox
                label="To"
                value={period.to}
                maxDate={parseDateValue(period.today)}
                onChange={(next) => {
                  onPeriodChange(period.from, next)
                }}
              />
            </div>
            {!wholeMonth && (
              <p className="text-xs leading-snug text-muted-foreground">
                Hires, leavers, turnover, payroll and recruitment are given per month: they show{' '}
                {formatMonthYear(period.month)}, the month of To.
              </p>
            )}
          </div>
        )}
      </div>
      {shown.length > 0 && (
        <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
          {shown.map(({ key, label, icon: Icon, link }) => (
            <Link
              key={key}
              to={link.to}
              params={link.params}
              search={link.search}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'flex-1 @md:flex-none',
              )}
            >
              <Icon aria-hidden="true" className="text-primary dark:text-[#c4b5fd]" />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
