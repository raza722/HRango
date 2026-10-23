import { type ReactNode, useId } from 'react'

import { PageContainer } from '@/components/layout'
import { cn } from '@/lib/utils'

/**
 * A Payroll page as drawn: one white card with the title on the left and the
 * page's buttons on the right, then the list.
 */
export function PayrollCard({
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
    <PageContainer>
      <section
        aria-labelledby={titleId}
        className={cn(
          'grid min-w-0 content-start gap-5 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6 sm:py-6',
          className,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Figma: Poppins Medium 24 #303030. */}
          <h1 id={titleId} className="text-xl font-medium text-title sm:text-2xl">
            {title}
          </h1>
          {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        {children}
      </section>
    </PageContainer>
  )
}
