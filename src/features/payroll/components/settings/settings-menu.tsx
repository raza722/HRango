import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'

import {
  AppraisalIcon,
  BenefitsMenuIcon,
  CompensationIcon,
  LoansIcon,
  PayrollHistoryIcon,
  PayrollSettingsIcon,
  PayRunsIcon,
} from '@/components/icons/payroll-icons'
import { PageContainer } from '@/components/layout'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type PayrollSettingsSection =
  'pay-runs' | 'settings' | 'history' | 'compensation' | 'benefits' | 'appraisal' | 'loans'

interface MenuEntry {
  key: PayrollSettingsSection
  label: ReactNode
  text: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Icon box in px, as drawn (the glyphs differ in size). */
  size: string
  to:
    | '/payroll/settings/pay-runs'
    | '/payroll/settings/general'
    | '/payroll/settings/history'
    | '/payroll/settings/pay-components'
    | '/payroll/settings/rewards'
    | '/payroll/settings/appraisal'
    | '/payroll/settings/loans'
}

/** Every entry stays under `/payroll/settings`, so its page opens beside the menu. */
const ENTRIES: MenuEntry[] = [
  {
    key: 'pay-runs',
    label: 'Pay Runs',
    text: 'Pay Runs',
    icon: PayRunsIcon,
    size: 'size-[18px]',
    to: '/payroll/settings/pay-runs',
  },
  {
    key: 'settings',
    label: 'Payroll Settings',
    text: 'Payroll Settings',
    icon: PayrollSettingsIcon,
    size: 'size-[19px]',
    to: '/payroll/settings/general',
  },
  {
    key: 'history',
    label: 'Payroll History',
    text: 'Payroll History',
    icon: PayrollHistoryIcon,
    size: 'size-[21px]',
    to: '/payroll/settings/history',
  },
  {
    key: 'compensation',
    label: (
      <>
        Compensation \<br />
        Deductions
      </>
    ),
    text: 'Compensation \\ Deductions',
    icon: CompensationIcon,
    size: 'size-[26px]',
    to: '/payroll/settings/pay-components',
  },
  {
    key: 'benefits',
    label: 'Benefits',
    text: 'Benefits',
    icon: BenefitsMenuIcon,
    size: 'size-[22px]',
    to: '/payroll/settings/rewards',
  },
  {
    key: 'appraisal',
    label: 'Appraisal',
    text: 'Appraisal',
    icon: AppraisalIcon,
    size: 'h-[15px] w-[21px]',
    to: '/payroll/settings/appraisal',
  },
  {
    key: 'loans',
    label: 'Loans',
    text: 'Loans',
    icon: LoansIcon,
    size: 'size-[21px]',
    to: '/payroll/settings/loans',
  },
]

const rowClass =
  'flex w-full items-center gap-1.5 px-6 py-[7px] text-sm leading-snug text-[#707070] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset dark:text-field-foreground'
const activeClass = 'bg-[#E8EAEC] font-medium text-[#17263A] dark:bg-input dark:text-heading'

function content(entry: MenuEntry, label: ReactNode) {
  const Icon = entry.icon
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center">
        <Icon className={entry.size} />
      </span>
      <span>{label}</span>
    </>
  )
}

function entryLink(entry: MenuEntry, current: PayrollSettingsSection, compact: boolean) {
  const active = entry.key === current
  return (
    <Link
      to={entry.to}
      aria-current={active ? 'page' : undefined}
      className={cn(rowClass, compact && 'px-3', active && activeClass)}
    >
      {content(entry, compact ? entry.text : entry.label)}
    </Link>
  )
}

/**
 * The Payroll Settings frames' own menu: Pay Runs, Payroll Settings, Payroll
 * History, Compensation \ Deductions, Benefits, Appraisal and Loans, beside
 * the page; `current` is the open entry. On narrow screens it folds into a button.
 */
export function PayrollSettingsMenu({ current }: { current: PayrollSettingsSection }) {
  const active = ENTRIES.find((entry) => entry.key === current)
  return (
    <>
      <nav
        aria-label="Payroll"
        className="hidden self-stretch rounded-[10px] bg-card py-6 shadow-xs @4xl/page:block"
      >
        <ul className="grid gap-4">
          {ENTRIES.map((entry) => (
            <li key={entry.key}>{entryLink(entry, current, false)}</li>
          ))}
        </ul>
      </nav>
      <div className="@4xl/page:hidden">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            aria-label={`Payroll section: ${active?.text ?? ''}`}
            className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-card px-4 text-sm font-medium text-heading shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex items-center gap-2">
              {active && (
                <>
                  <active.icon className={active.size} />
                  {active.text}
                </>
              )}
            </span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] p-1"
          >
            {ENTRIES.map((entry) => (
              <DropdownMenuItem key={entry.key} asChild className="p-0">
                {entryLink(entry, current, true)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}

/**
 * A page beside the Payroll Settings menu: the settings tabs, Pay Runs, Payroll
 * History, Appraisal or Loans, with `current` highlighted in the menu.
 */
export function PayrollSettingsLayout({
  current,
  children,
}: {
  current: PayrollSettingsSection
  children: ReactNode
}) {
  return (
    <PageContainer>
      <div className="grid items-start gap-4 sm:gap-5 @4xl/page:grid-cols-[13.75rem_minmax(0,1fr)]">
        <PayrollSettingsMenu current={current} />
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  )
}
