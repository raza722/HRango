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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface MenuEntry {
  key: string
  label: ReactNode
  text: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Icon box in px, as drawn (the glyphs differ in size). */
  size: string
  link: (className: string, content: ReactNode) => ReactNode
}

const ENTRIES: MenuEntry[] = [
  {
    key: 'pay-runs',
    label: 'Pay Runs',
    text: 'Pay Runs',
    icon: PayRunsIcon,
    size: 'size-[18px]',
    link: (className, content) => (
      <Link to="/payroll/payrolls/monthly" className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: 'settings',
    label: 'Payroll Settings',
    text: 'Payroll Settings',
    icon: PayrollSettingsIcon,
    size: 'size-[19px]',
    link: (className, content) => (
      <Link to="/payroll/settings/general" aria-current="page" className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: 'history',
    label: 'Payroll History',
    text: 'Payroll History',
    icon: PayrollHistoryIcon,
    size: 'size-[21px]',
    link: (className, content) => (
      <Link to="/payroll/payrolls/monthly" className={className}>
        {content}
      </Link>
    ),
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
    link: (className, content) => (
      <Link to="/payroll/settings/pay-components" className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: 'benefits',
    label: 'Benefits',
    text: 'Benefits',
    icon: BenefitsMenuIcon,
    size: 'size-[22px]',
    link: (className, content) => (
      <Link to="/payroll/settings/rewards" className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: 'appraisal',
    label: 'Appraisal',
    text: 'Appraisal',
    icon: AppraisalIcon,
    size: 'h-[15px] w-[21px]',
    link: (className, content) => (
      <Link to="/performance" className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: 'loans',
    label: 'Loans',
    text: 'Loans',
    icon: LoansIcon,
    size: 'size-[21px]',
    link: (className, content) => (
      <Link to="/requests/$type" params={{ type: 'loan-advances' }} className={className}>
        {content}
      </Link>
    ),
  },
]

const rowClass =
  'flex w-full items-center gap-1.5 px-6 py-[7px] text-sm leading-snug text-[#707070] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset dark:text-field-foreground'
const activeClass = 'bg-[#E8EAEC] font-medium text-[#17263A] dark:bg-input dark:text-heading'

function content(entry: MenuEntry) {
  const Icon = entry.icon
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center">
        <Icon className={entry.size} />
      </span>
      <span>{entry.label}</span>
    </>
  )
}

/**
 * The Payroll Settings frames' own menu: Pay Runs, Payroll Settings, Payroll
 * History, Compensation \ Deductions, Benefits, Appraisal and Loans, beside
 * the settings card. On narrow screens it folds into a button.
 */
export function PayrollSettingsMenu() {
  return (
    <>
      <nav
        aria-label="Payroll"
        className="hidden self-stretch rounded-[10px] bg-card py-6 shadow-xs @4xl/page:block"
      >
        <ul className="grid gap-4">
          {ENTRIES.map((entry) => (
            <li key={entry.key}>
              {entry.link(cn(rowClass, entry.key === 'settings' && activeClass), content(entry))}
            </li>
          ))}
        </ul>
      </nav>
      <div className="@4xl/page:hidden">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            aria-label="Payroll section: Payroll Settings"
            className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-card px-4 text-sm font-medium text-heading shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex items-center gap-2">
              <PayrollSettingsIcon className="size-[19px]" />
              Payroll Settings
            </span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] p-1"
          >
            {ENTRIES.map((entry) => (
              <DropdownMenuItem key={entry.key} asChild className="p-0">
                {entry.link(
                  cn(rowClass, 'px-3', entry.key === 'settings' && activeClass),
                  <>
                    <span className="flex size-7 shrink-0 items-center justify-center">
                      <entry.icon className={entry.size} />
                    </span>
                    <span>{entry.text}</span>
                  </>,
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
