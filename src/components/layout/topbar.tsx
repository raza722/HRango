import type { ComponentProps, ReactNode } from 'react'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'

interface TopbarProps {
  /** Right-aligned controls (theme, mail, notifications, language). */
  actions?: ReactNode
}

/** White application top bar with the sidebar toggle on the left. */
export function Topbar({ actions }: TopbarProps) {
  const isDesktop = useMediaQuery(BREAKPOINTS.desktop)
  const collapsed = useSidebarStore((state) => state.collapsed)
  const mobileOpen = useSidebarStore((state) => state.mobileOpen)
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed)
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen)

  const expanded = isDesktop ? !collapsed : mobileOpen

  return (
    // 64px on phones and tablets, the design's 74px (4.625rem) next to the desktop sidebar.
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 bg-topbar px-4 shadow-[0_1px_0_var(--color-border)] sm:px-5 lg:h-[4.625rem] lg:pr-8">
      <Button
        variant="secondary"
        size="icon-lg"
        // Desktop folds the sidebar to its icon rail; phones and tablets open it as a drawer.
        aria-label={isDesktop ? (expanded ? 'Collapse sidebar' : 'Expand sidebar') : 'Open menu'}
        aria-expanded={expanded}
        onClick={() => {
          if (isDesktop) toggleCollapsed()
          else setMobileOpen(true)
        }}
      >
        <Menu className="size-6" strokeWidth={1.5} />
      </Button>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">{actions}</div>
    </header>
  )
}

interface TopbarIconButtonProps extends ComponentProps<typeof Button> {
  /** Shows a small dot in the top-right corner (unread items). */
  indicator?: boolean
}

/** 36px square button used for every control on the right of the top bar. */
export function TopbarIconButton({
  indicator,
  className,
  children,
  ...props
}: TopbarIconButtonProps) {
  return (
    <Button variant="secondary" size="icon" className={cn('relative', className)} {...props}>
      {children}
      {indicator && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-heading ring-2 ring-secondary"
        />
      )}
    </Button>
  )
}
