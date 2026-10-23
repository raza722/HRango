import { type ReactNode, useId, useState } from 'react'

import employeesUrl from '@/assets/images/benefits/stat-employees.svg'
import enrollmentWindowsUrl from '@/assets/images/benefits/stat-enrollment-windows.svg'
import planYearsUrl from '@/assets/images/benefits/stat-plan-years.svg'
import plansUrl from '@/assets/images/benefits/stat-plans.svg'
import { PageContainer } from '@/components/layout'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useBenefitsLookups, useBenefitsSummary } from '../../hooks/use-benefits'
import type { BenefitsSummary, BenefitsTab } from '../../types/benefits.types'
import { FilterIcon, InfoIcon, MailIcon, PhoneIcon, ShowingChevronIcon } from './benefit-icons'
import { accent, cardTitleText, headerIconButton, pageTitleText } from './benefit-styles'
import { BxSelect } from './controls'
import { SubMenuTabs } from './tabs'

/** The HR team, for the phone button: the people of Human Resource Management. */
function HrContacts() {
  const lookups = useBenefitsLookups()
  const people = (lookups.data?.employees ?? []).filter(
    (person) => person.department === 'Human Resource Management',
  )
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-heading">HR contacts</p>
      {lookups.isPending ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : people.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nobody is listed in HR.</p>
      ) : (
        <ul className="grid gap-1.5">
          {people.map((person) => (
            <li key={person.id} className="text-xs leading-snug">
              <span className={cn('font-medium', accent.text)}>{person.name}</span>
              <span className="block text-[#707070] dark:text-muted-foreground">
                {person.jobTitle}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const ABOUT =
  'Benefits Management: the plan years and the plans they offer, the enrollment windows when people choose their plans, each person’s elections, and the plans’ files.'

/**
 * "Benefits Management" and the four buttons drawn beside it: email a link to the page, the HR
 * contacts, about this page, and the filter (opens the "Showing:" plan year when the page has it).
 */
function PageHeading({ onFilter }: { onFilter: (() => void) | undefined }) {
  const mailto = `mailto:?subject=${encodeURIComponent('Benefits Management')}&body=${encodeURIComponent(
    typeof window === 'undefined' ? '' : window.location.href,
  )}`
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className={pageTitleText}>Benefits Management</h1>
      <div className="flex items-center gap-4">
        <a href={mailto} aria-label="Email a link to this page" className={headerIconButton}>
          <MailIcon />
        </a>
        <Popover>
          <PopoverTrigger aria-label="HR contacts" className={headerIconButton}>
            <PhoneIcon />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <HrContacts />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger aria-label="About this page" className={headerIconButton}>
            <InfoIcon />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 text-xs leading-relaxed text-heading">
            {ABOUT}
          </PopoverContent>
        </Popover>
        <button
          type="button"
          aria-label="Choose the plan year shown"
          disabled={!onFilter}
          onClick={onFilter}
          className={cn(headerIconButton, 'disabled:cursor-not-allowed disabled:opacity-50')}
        >
          <FilterIcon />
        </button>
      </div>
    </div>
  )
}

const STATS: readonly { key: keyof BenefitsSummary; label: string; image: string; size: string }[] =
  [
    { key: 'planYears', label: 'Plan Years', image: planYearsUrl, size: 'size-[3.125rem]' },
    { key: 'plans', label: 'Plans', image: plansUrl, size: 'size-[3.125rem]' },
    {
      key: 'enrollmentWindows',
      label: 'Enrollment Windows',
      image: enrollmentWindowsUrl,
      size: 'size-[3.125rem]',
    },
    { key: 'employees', label: 'Employees', image: employeesUrl, size: 'size-[2.75rem]' },
  ]

/** The stats row: four white cards (240 x 80, 10px corners) with their counts and drawings. */
function StatsRow() {
  const summary = useBenefitsSummary()
  return (
    <ul
      aria-label="Benefits in numbers"
      className="grid gap-4 sm:grid-cols-2 @[50rem]/page:grid-cols-4 @[66rem]/page:gap-[1.5625rem]"
    >
      {STATS.map((stat) => (
        <li
          key={stat.key}
          className="flex h-20 items-center justify-between gap-3 rounded-[10px] bg-card py-3.5 pr-[0.9375rem] pl-4 shadow-xs"
        >
          <div className="grid gap-[0.5625rem]">
            <span className="text-[0.625rem] leading-[0.9375rem] font-medium text-title">
              {stat.label}
            </span>
            {summary.isPending ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <span className="text-2xl leading-7 font-bold text-title">
                {summary.data ? String(summary.data[stat.key]) : '—'}
              </span>
            )}
          </div>
          <img src={stat.image} alt="" className={cn(stat.size, 'shrink-0')} />
        </li>
      ))}
    </ul>
  )
}

/** "Showing: All Plan Years": the plan year the tab lists. */
function ShowingFilter({
  year,
  onYearChange,
  open,
  onOpenChange,
}: {
  year: string | undefined
  onYearChange: (year: string | undefined) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const lookups = useBenefitsLookups()
  const labelId = useId()
  const known = (lookups.data?.planYears ?? []).some((item) => item.id === year)
  return (
    <div className="flex items-center gap-1.5">
      <span id={labelId} className="text-sm leading-[1.3125rem] text-heading">
        Showing:
      </span>
      <BxSelect
        aria-labelledby={labelId}
        value={known ? (year ?? '') : ''}
        noneLabel="All Plan Years"
        options={(lookups.data?.planYears ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        }))}
        open={open}
        onOpenChange={onOpenChange}
        onChange={(value) => {
          onYearChange(value || undefined)
        }}
        icon={<ShowingChevronIcon className="h-[0.44rem] w-[0.75rem] shrink-0 text-[#AAAAAA]" />}
        className="h-[2.6875rem] w-auto max-w-[13rem] min-w-[8.5625rem] gap-3 rounded-[8px] border-[#C9C9C9]/60 pr-2.5 pl-[0.8rem] text-sm sm:pl-[0.8rem] sm:text-sm"
      />
    </div>
  )
}

/**
 * The white card (17px corners) with the purple bar and title on the left (Poppins Medium 16
 * #000) and the card's buttons on the right.
 */
export function BxCard({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        '@container flex min-w-0 flex-col rounded-[1.0625rem] bg-card pt-3 pb-6 shadow-xs sm:min-h-[32.5rem]',
        className,
      )}
    >
      <div className="flex min-h-[2.6875rem] flex-wrap items-center justify-between gap-3 pr-4 sm:pr-[1.1875rem]">
        <h2 id={titleId} className={cn('flex items-center gap-5 py-2', cardTitleText)}>
          <span aria-hidden="true" className="h-[1.5625rem] w-[0.22rem] bg-[#7469E8]" />
          {title}
        </h2>
        {actions && <div className="flex flex-wrap items-center gap-3 pl-6">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/**
 * A Benefits tab: the heading row, the stats row, then the card with its title, buttons, the
 * "Showing:" plan year, the sub menu and the tab's content.
 */
export function BenefitsPage({
  tab,
  title,
  actions,
  year,
  onYearChange,
  children,
}: {
  tab: BenefitsTab
  title: string
  actions?: ReactNode
  year: string | undefined
  onYearChange: (year: string | undefined) => void
  children: ReactNode
}) {
  const summary = useBenefitsSummary()
  const [showingOpen, setShowingOpen] = useState(false)
  const employees = summary.data ? ` (${String(summary.data.employees)})` : ''
  return (
    <PageContainer>
      <PageHeading
        onFilter={() => {
          setShowingOpen(true)
        }}
      />
      <StatsRow />
      <BxCard
        title={title}
        actions={
          <>
            {actions}
            <ShowingFilter
              year={year}
              onYearChange={onYearChange}
              open={showingOpen}
              onOpenChange={setShowingOpen}
            />
          </>
        }
      >
        <div className="mt-[1.75rem]">
          <SubMenuTabs
            current={`/benefits/${tab}`}
            year={year}
            items={[
              { to: '/benefits/plan-years', label: 'Plan Years' },
              { to: '/benefits/plans', label: 'Plans' },
              { to: '/benefits/enrollment-windows', label: 'Enrollment Windows' },
              { to: '/benefits/employees', label: `Employees${employees}` },
              { to: '/benefits/files', label: 'Files' },
            ]}
          />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </BxCard>
    </PageContainer>
  )
}

/** A Benefits form page (New Plan Year, Add Plan): the heading row and the form's card. */
export function BenefitsFormPage({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <PageHeading onFilter={undefined} />
      {children}
    </PageContainer>
  )
}
