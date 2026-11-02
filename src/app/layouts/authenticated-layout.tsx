import { type ReactNode, useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'

import { NAV_ITEMS } from '@/app/navigation'
import { canOpen } from '@/app/route-access'
import { LanguageSwitcher, Sidebar, SIDEBAR_WIDTH, ThemeToggle, Topbar } from '@/components/layout'
import { ChangePasswordDialog } from '@/features/access'
import { useLogout, useSessionRefresh } from '@/features/auth'
import { InboxMenu } from '@/features/inbox'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { useAuthStore } from '@/stores/auth-store'
import { useSidebarStore } from '@/stores/sidebar-store'

import { InShellContext } from './in-shell-context'

/** A page the user's role does not include (opened from a link or a typed address). */
function NoAccess() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold text-heading">You don’t have access to this page</h1>
      <p className="text-sm text-muted-foreground">
        Your role doesn’t include it. If you need it, ask your HR team or administrator.
      </p>
      <Link to="/" className="text-sm font-medium text-primary hover:underline">
        Back to the dashboard
      </Link>
    </div>
  )
}

/**
 * Shell for every signed-in page: navy sidebar, white top bar, grey content area. It shows the
 * matched route, or `children` when given (the 404 page for an unknown URL).
 */
export function AuthenticatedLayout({ children }: { children?: ReactNode } = {}) {
  const user = useAuthStore((state) => state.user)
  const collapsed = useSidebarStore((state) => state.collapsed)
  const isDesktop = useMediaQuery(BREAKPOINTS.desktop)
  const logout = useLogout()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [changingPassword, setChangingPassword] = useState(false)
  useSessionRefresh()

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
        onChangePassword={() => {
          setChangingPassword(true)
        }}
      />
      {changingPassword && (
        <ChangePasswordDialog
          onClose={() => {
            setChangingPassword(false)
          }}
        />
      )}

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
          <InShellContext value={true}>
            {children ?? (canOpen(user, pathname) ? <Outlet /> : <NoAccess />)}
          </InShellContext>
        </main>
      </div>
    </div>
  )
}
