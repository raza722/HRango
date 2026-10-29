import type { ComponentType, SVGProps } from 'react'
import { Link } from '@tanstack/react-router'
import { addMonths, format, parse } from 'date-fns'
import {
  BriefcaseBusiness,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  UserPlus,
} from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { MonthPicker } from '@/features/payroll'
import { cn } from '@/lib/utils'

import type { DashboardKind } from '../api/dashboard.api'
import type { DashboardAccess } from '../hooks/use-dashboard-access'
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

const shift = (month: string, by: number) =>
  format(addMonths(parse(month, 'yyyy-MM', new Date()), by), 'yyyy-MM')

/**
 * The page title card: the greeting and today's date, which dashboard this is, the month the
 * monthly figures cover (‹ month ›, up to the current month) and the quick actions the user may
 * take, each opening its page.
 */
export function DashboardHeader({
  kind,
  name,
  now,
  month,
  currentMonth,
  onMonthChange,
  access,
}: {
  kind: DashboardKind | null
  name: string | undefined
  now: Date
  month: string
  currentMonth: string
  onMonthChange: (month: string) => void
  access: DashboardAccess
}) {
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
          <div
            role="group"
            aria-label="Month"
            className="flex w-full items-center gap-1.5 @lg:w-auto"
          >
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                onMonthChange(shift(month, -1))
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-card text-field-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <MonthPicker
              aria-label="Month the figures cover"
              value={month}
              max={currentMonth}
              onChange={(value) => {
                onMonthChange(value)
              }}
              className="h-9 min-w-0 flex-1 @lg:w-48 @lg:flex-none"
            />
            <button
              type="button"
              aria-label="Next month"
              disabled={month >= currentMonth}
              onClick={() => {
                onMonthChange(shift(month, 1))
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-card text-field-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
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
