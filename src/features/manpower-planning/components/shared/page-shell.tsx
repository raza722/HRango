import { type ReactNode, useId } from 'react'

import { PageContainer } from '@/components/layout'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { useManpowerLookups } from '../../hooks/use-manpower'
import { FilterIcon, InfoIcon, MailIcon, PhoneIcon } from './mp-icons'
import { accent, cardTitleText, pageTitleText } from './mp-styles'

const iconButton =
  'flex size-8 items-center justify-center rounded-[6px] bg-card text-[#516284] outline-none hover:bg-card/70 focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 aria-pressed:bg-[#7469E8]/10 dark:text-[#A9B6CF] [&_svg]:size-[1.1rem]'

/** The HR team, for the phone button: people of Human Resource Management. */
function HrContacts() {
  const lookups = useManpowerLookups()
  const hr = lookups.data?.departments.find((item) => item.name === 'Human Resource Management')
  const people = (lookups.data?.employees ?? []).filter((person) => person.departmentId === hr?.id)
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

/**
 * A Manpower Planning page: the title (Poppins Medium 24 #303030) with the four round
 * buttons drawn beside it (email a link, HR contacts, about this page, show or hide the
 * filters), then the page's card.
 */
export function MpPage({
  title,
  info,
  filtersOpen,
  onToggleFilters,
  children,
}: {
  title: string
  /** What the page is for, shown by the info button. */
  info: string
  filtersOpen: boolean
  onToggleFilters: () => void
  children: ReactNode
}) {
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(
    typeof window === 'undefined' ? '' : window.location.href,
  )}`
  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleText}>{title}</h1>
        <div className="flex items-center gap-4">
          <a href={mailto} aria-label="Email a link to this page" className={iconButton}>
            <MailIcon />
          </a>
          <Popover>
            <PopoverTrigger aria-label="HR contacts" className={iconButton}>
              <PhoneIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <HrContacts />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger aria-label="About this page" className={iconButton}>
              <InfoIcon />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-xs leading-relaxed text-heading">
              {info}
            </PopoverContent>
          </Popover>
          <button
            type="button"
            aria-label={filtersOpen ? 'Hide filters' : 'Show filters'}
            aria-pressed={filtersOpen}
            onClick={onToggleFilters}
            className={iconButton}
          >
            <FilterIcon />
          </button>
        </div>
      </div>
      {children}
    </PageContainer>
  )
}

/**
 * The white card (17px corners) with the purple bar and title on the left
 * (Poppins Medium 16 #000) and the card's buttons on the right.
 */
export function MpCard({
  title,
  actions,
  children,
  className,
  as: Heading = 'h2',
}: {
  /** `h1` when the card is the page (Add Planning has no page title row). */
  as?: 'h1' | 'h2'
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
        '@container grid min-w-0 content-start gap-5 rounded-[1.0625rem] bg-card pt-5 pb-6 shadow-xs',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pr-4 sm:pr-5">
        <Heading id={titleId} className={cn('flex items-center gap-5', cardTitleText)}>
          <span aria-hidden="true" className="h-[1.5625rem] w-[0.22rem] bg-[#7469E8]" />
          {title}
        </Heading>
        {actions && <div className="flex flex-wrap items-center gap-3 pl-6">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/** A section title inside a card ("Plan for New Positions"): the purple bar and the title. */
export function BarTitle({
  id,
  children,
  actions,
}: {
  id?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pr-4 sm:pr-7">
      <h3 id={id} className={cn('flex items-center gap-5', cardTitleText)}>
        <span aria-hidden="true" className="h-[1.5625rem] w-[0.22rem] bg-[#7469E8]" />
        {children}
      </h3>
      {actions && <div className="flex flex-wrap items-center gap-2.5 pl-6">{actions}</div>}
    </div>
  )
}

/** Card content with the cards' 24px side margin. */
export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0 px-4 sm:px-6', className)}>{children}</div>
}
