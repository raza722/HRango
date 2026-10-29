import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'

import {
  AttendanceInsightsMenuIcon,
  AttendanceLogsMenuIcon,
  AttendanceSettingsMenuIcon,
  MissingPunchMenuIcon,
  OfficialVisitsMenuIcon,
  OvertimeMenuIcon,
  ScheduleMenuIcon,
} from '@/components/icons/attendance-menu-icons'
import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type AttendanceSection =
  'scheduling' | 'overtime' | 'official-visits' | 'missing-punch' | 'logs' | 'insights' | 'settings'

interface MenuItem {
  key: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  link: ReactNode
}

const itemClass =
  'flex w-full items-center gap-2 px-6 py-2 text-sm text-[#5C5C5C] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset dark:text-field-foreground'
const activeClass = 'bg-sidebar/10 font-medium text-sidebar dark:bg-input dark:text-heading'

/**
 * The design's Attendance sub menu. Every entry opens its page beside the menu, Scheduling,
 * Official Visits and Attendance Insights included (the same screens as the sidebar's
 * Scheduling, Requests → Official Visits and Attendance Overview).
 */
function buildMenu(current: AttendanceSection | null, className?: string): MenuItem[] {
  const content = (Icon: MenuItem['icon'], label: string) => (
    <>
      <Icon className="size-5 shrink-0" />
      {label}
    </>
  )
  const cls = (active: boolean) => cn(itemClass, active && activeClass, className)
  return [
    {
      key: 'scheduling',
      label: 'Scheduling',
      icon: ScheduleMenuIcon,
      link: (
        <Link
          to="/attendance/scheduling"
          aria-current={current === 'scheduling' ? 'page' : undefined}
          className={cls(current === 'scheduling')}
        >
          {content(ScheduleMenuIcon, 'Scheduling')}
        </Link>
      ),
    },
    {
      key: 'overtime',
      label: 'Overtime',
      icon: OvertimeMenuIcon,
      link: (
        <Link
          to="/attendance/overtime"
          aria-current={current === 'overtime' ? 'page' : undefined}
          className={cls(current === 'overtime')}
        >
          {content(OvertimeMenuIcon, 'Overtime')}
        </Link>
      ),
    },
    {
      key: 'official-visits',
      label: 'Official Visits',
      icon: OfficialVisitsMenuIcon,
      link: (
        <Link
          to="/attendance/official-visits"
          aria-current={current === 'official-visits' ? 'page' : undefined}
          className={cls(current === 'official-visits')}
        >
          {content(OfficialVisitsMenuIcon, 'Official Visits')}
        </Link>
      ),
    },
    {
      key: 'missing-punch',
      label: 'Missing Punch',
      icon: MissingPunchMenuIcon,
      link: (
        <Link
          to="/attendance/$section"
          params={{ section: 'missing-punch' }}
          aria-current={current === 'missing-punch' ? 'page' : undefined}
          className={cls(current === 'missing-punch')}
        >
          {content(MissingPunchMenuIcon, 'Missing Punch')}
        </Link>
      ),
    },
    {
      key: 'logs',
      label: 'Attendance Logs',
      icon: AttendanceLogsMenuIcon,
      link: (
        <Link
          to="/attendance/logs"
          aria-current={current === 'logs' ? 'page' : undefined}
          className={cls(current === 'logs')}
        >
          {content(AttendanceLogsMenuIcon, 'Attendance Logs')}
        </Link>
      ),
    },
    {
      key: 'insights',
      label: 'Attendance Insights',
      icon: AttendanceInsightsMenuIcon,
      link: (
        <Link
          to="/attendance/insights"
          aria-current={current === 'insights' ? 'page' : undefined}
          className={cls(current === 'insights')}
        >
          {content(AttendanceInsightsMenuIcon, 'Attendance Insights')}
        </Link>
      ),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: AttendanceSettingsMenuIcon,
      link: (
        <Link
          to="/attendance/settings"
          aria-current={current === 'settings' ? 'page' : undefined}
          className={cls(current === 'settings')}
        >
          {content(AttendanceSettingsMenuIcon, 'Settings')}
        </Link>
      ),
    },
  ]
}

/**
 * The sub menu's pages from the pages drawn without it (Attendance Overview, Time Sheet): a
 * "More" button listing Scheduling, Overtime, Official Visits … Settings.
 */
export function AttendanceSectionsMenu({ className }: { className?: string }) {
  const items = buildMenu(null, 'px-3')
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="More attendance pages"
          className={cn('gap-1.5', className)}
        >
          More <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 p-1">
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild className="p-0">
            {item.link}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Attendance Logs and Settings: the Attendance sub menu (Scheduling, Overtime,
 * Official Visits, Missing Punch, Attendance Logs, Attendance Insights,
 * Settings) beside the page. On narrow screens the menu folds into a button.
 */
export function AttendanceSubLayout({
  current,
  children,
}: {
  current: AttendanceSection
  children: ReactNode
}) {
  const menu = buildMenu(current)
  const compact = buildMenu(current, 'px-3')
  const active = menu.find((item) => item.key === current)
  const ActiveIcon = active?.icon

  return (
    <PageContainer>
      <div className="grid items-start gap-4 sm:gap-5 @4xl/page:grid-cols-[13.75rem_minmax(0,1fr)]">
        <nav
          aria-label="Attendance"
          className="hidden self-stretch rounded-xl bg-card py-4 shadow-xs @4xl/page:block"
        >
          <ul className="grid gap-2">
            {menu.map((item) => (
              <li key={item.key}>{item.link}</li>
            ))}
          </ul>
        </nav>

        <div className="@4xl/page:hidden">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={`Attendance section: ${active?.label ?? ''}`}
              className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-card px-4 text-sm font-medium text-heading shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-2">
                {ActiveIcon && <ActiveIcon className="size-5" />}
                {active?.label}
              </span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)] p-1"
            >
              {compact.map((item) => (
                <DropdownMenuItem key={item.key} asChild className="p-0">
                  {item.link}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  )
}
