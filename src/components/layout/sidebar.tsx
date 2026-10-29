import { Link } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'

import { filterNavItems, type NavItem } from '@/app/navigation'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebar-store'
import type { AuthUser } from '@/types/auth'

import { SIDEBAR_WIDTH } from './constants'
import { OrganisationBrand, PoweredBy } from './organisation-brand'
import { SidebarNav } from './sidebar-nav'
import { SidebarUserCard } from './sidebar-user-card'

interface SidebarProps {
  items: readonly NavItem[]
  user: AuthUser | null
  onSignOut: () => void
  onChangePassword?: (() => void) | undefined
}

interface SidebarPanelProps extends SidebarProps {
  collapsed: boolean
  onNavigate?: () => void
  /** The phone drawer's close button, beside the brand (so it never covers a long name). */
  onClose?: () => void
}

function SidebarPanel({
  items,
  user,
  onSignOut,
  onChangePassword,
  collapsed,
  onNavigate,
  onClose,
}: SidebarPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 lg:h-[4.625rem]',
          onClose ? 'justify-between' : 'justify-center',
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-muted/60"
          aria-label={`${user?.companyName ?? 'Home'} - go to dashboard`}
        >
          <OrganisationBrand user={user} collapsed={collapsed} />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors outline-none hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-muted/60"
          >
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <SidebarUserCard
        user={user}
        collapsed={collapsed}
        onSignOut={onSignOut}
        onChangePassword={onChangePassword}
      />

      <nav
        aria-label="Main"
        className={cn(
          'scrollbar-sidebar flex-1 overflow-y-auto overscroll-contain py-6',
          collapsed ? 'px-3' : 'px-4',
        )}
      >
        {/* Only the entries the user holds a view permission for (all of them in mock mode). */}
        <SidebarNav
          items={filterNavItems(items, user)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </nav>

      <PoweredBy collapsed={collapsed} />
    </div>
  )
}

/**
 * Dark navy application sidebar.
 * Desktop (lg+): fixed column, collapsible to an icon rail (persisted).
 * Mobile: off-canvas drawer opened from the topbar hamburger.
 */
export function Sidebar(props: SidebarProps) {
  const collapsed = useSidebarStore((state) => state.collapsed)
  const mobileOpen = useSidebarStore((state) => state.mobileOpen)
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen)
  const isDesktop = useMediaQuery(BREAKPOINTS.desktop)

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:flex"
        style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
        data-collapsed={collapsed}
      >
        <SidebarPanel {...props} collapsed={collapsed} />
      </aside>

      <Sheet open={!isDesktop && mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground"
          aria-describedby={undefined}
          showClose={false}
        >
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SidebarPanel
            {...props}
            collapsed={false}
            onNavigate={() => {
              setMobileOpen(false)
            }}
            onClose={() => {
              setMobileOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
