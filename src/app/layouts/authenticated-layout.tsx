import { Outlet } from '@tanstack/react-router'

import { NAV_ITEMS } from '@/app/navigation'
import { LanguageSwitcher, Sidebar, SIDEBAR_WIDTH, ThemeToggle, Topbar } from '@/components/layout'
import { useLogout } from '@/features/auth'
import { InboxMenu } from '@/features/inbox'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { useAuthStore } from '@/stores/auth-store'
import { useSidebarStore } from '@/stores/sidebar-store'

/** Shell for every signed-in page: navy sidebar, white top bar, grey content area. */
export function AuthenticatedLayout() {
  const user = useAuthStore((state) => state.user)
  const collapsed = useSidebarStore((state) => state.collapsed)
  const isDesktop = useMediaQuery(BREAKPOINTS.desktop)
  const logout = useLogout()

  const offset = isDesktop ? (collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded) : 0

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <Sidebar
        items={NAV_ITEMS}
        user={user}
        onSignOut={() => {
          void logout()
        }}
      />

      <div
        className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 ease-out"
        style={{ paddingLeft: offset }}
      >
        <Topbar
          actions={
            <>
              <ThemeToggle />
              <InboxMenu kind="messages" />
              <InboxMenu kind="notifications" />
              <LanguageSwitcher />
            </>
          }
        />
        <main
          id="main-content"
          tabIndex={-1}
          // Bottom padding clears the iPhone home indicator.
          className="min-w-0 flex-1 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none sm:px-6 sm:pt-5 lg:px-8 lg:pt-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
