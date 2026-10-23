import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Buttons on the right, e.g. Cancel / Save. On narrow screens they share a full-width row. */
  actions?: ReactNode
  /** `inline` keeps actions at their own size on phones (icon buttons). */
  actionsLayout?: 'stretch' | 'inline'
  className?: string
}

/** White title card at the top of a page, with optional actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  actionsLayout = 'stretch',
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        '@container flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md bg-card px-4 py-5 shadow-xs sm:px-8 sm:py-6',
        className,
      )}
    >
      <div className="min-w-[min(100%,10rem)] flex-1">
        <h1 className="text-xl leading-tight font-normal break-words text-heading sm:text-2xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-3',
            actionsLayout === 'stretch' && 'w-full *:flex-1 @md:w-auto @md:*:flex-none',
          )}
        >
          {actions}
        </div>
      )}
    </header>
  )
}

interface PageContainerProps {
  children: ReactNode
  className?: string
}

/**
 * Stacks and spaces a page's cards across the full content width, at every
 * screen size. It is a named size container (`@container/page`), so pages
 * switch layout by the space they really have (sidebar open or not), e.g.
 * `@[90rem]/page:grid-cols-2`; cards then use their own `@container` width.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('@container/page flex w-full min-w-0 flex-col gap-4 sm:gap-5', className)}>
      {children}
    </div>
  )
}

/**
 * Class names for a page that is one full-width column normally and two
 * columns once its `PageContainer` is at least 90rem wide.
 */
export const splitPageClassName =
  'grid w-full grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-5 @[90rem]/page:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'
