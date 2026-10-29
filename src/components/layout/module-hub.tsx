import type { ComponentType, SVGProps } from 'react'
import { useId } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import type { AppPath, NavPermission } from '@/app/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { canViewUnder } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import type { AuthUser } from '@/types/auth'

import { PageContainer } from './page-header'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** A live figure on a card ("3 pending"); `count` is undefined while loading or on error. */
export interface HubBadge {
  count: number | undefined
  isLoading: boolean
  /** Shown after the number: "pending", "open", "in progress". */
  label: string
}

/** One screen the landing page links to. */
export interface HubLink {
  key: string
  label: string
  description: string
  to: AppPath
  /** Path parameters, for pages of a shared route (`/requests/$type`). */
  params?: Record<string, string>
  /** Search parameters the page opens with (`{ scope: 'all' }`). */
  search?: Record<string, string>
  icon: Icon
  /** Who sees the card: a permission code prefix, as the sidebar uses. Without one it shows. */
  permission?: NavPermission
  badge?: HubBadge
}

export interface HubSection {
  key: string
  title: string
  links: readonly HubLink[]
}

function visible(user: AuthUser | null, link: HubLink): boolean {
  if (link.permission === undefined) return true
  const prefixes: readonly string[] =
    typeof link.permission === 'string' ? [link.permission] : link.permission
  return prefixes.some((prefix) => canViewUnder(user, prefix))
}

function BadgeView({ badge }: { badge: HubBadge }) {
  if (badge.isLoading) return <Skeleton aria-hidden="true" className="h-5 w-16 rounded-full" />
  if (badge.count === undefined) return null
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-medium tabular-nums',
        badge.count > 0
          ? 'bg-sidebar/10 text-sidebar dark:bg-primary/20 dark:text-heading'
          : 'bg-muted text-grey',
      )}
    >
      {badge.count} {badge.label}
    </span>
  )
}

function HubCard({ link }: { link: HubLink }) {
  const Icon = link.icon
  return (
    <Link
      to={link.to}
      params={link.params}
      search={link.search}
      className="group flex h-full items-start gap-3 rounded-lg border bg-card p-4 transition-colors outline-none hover:border-sidebar/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:border-border"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sidebar/10 text-sidebar dark:bg-primary/20 dark:text-heading"
      >
        <Icon className="size-5" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-heading">{link.label}</span>
          {link.badge && <BadgeView badge={link.badge} />}
        </span>
        <span className="text-xs text-muted-foreground">{link.description}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="mt-2.5 size-4 shrink-0 text-label transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

function HubSectionView({ section, links }: { section: HubSection; links: readonly HubLink[] }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="text-sm font-medium text-title">
        {section.title}
      </h2>
      <ul className="grid gap-3 @xl/page:grid-cols-2 @5xl/page:grid-cols-3">
        {links.map((link) => (
          <li key={link.key}>
            <HubCard link={link} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A module's landing page that links to screens built elsewhere in the app (Separation
 * Management, Configuration): one white card with the module's title and description, then
 * its screens in sections as cards (icon, name, what it is for, an optional live count). A
 * card shows only when the user may view a screen under its permission prefix, as in the
 * sidebar; a section with no card left is dropped.
 */
export function ModuleHub({
  title,
  description,
  icon: TitleIcon,
  sections,
}: {
  title: string
  description: string
  icon: Icon
  sections: readonly HubSection[]
}) {
  const user = useAuthStore((state) => state.user)
  const shown = sections
    .map((section) => ({ section, links: section.links.filter((link) => visible(user, link)) }))
    .filter((entry) => entry.links.length > 0)

  return (
    <PageContainer>
      <section
        aria-labelledby="module-hub-title"
        className="grid gap-6 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          >
            <TitleIcon className="size-6" />
          </span>
          <div className="grid gap-1">
            <h1 id="module-hub-title" className="text-xl font-medium text-title">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {shown.length > 0 ? (
          shown.map(({ section, links }) => (
            <HubSectionView key={section.key} section={section} links={links} />
          ))
        ) : (
          <p className="rounded-md bg-muted/50 px-4 py-10 text-center text-sm text-muted-foreground">
            You don’t have access to any of the screens in {title}. Ask an administrator if you need
            one.
          </p>
        )}
      </section>
    </PageContainer>
  )
}
