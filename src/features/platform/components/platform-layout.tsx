import { Link, Outlet, useRouterState } from '@tanstack/react-router'

import { InShellContext } from '@/app/layouts/in-shell-context'
import { Sidebar, SIDEBAR_WIDTH, ThemeToggle, Topbar } from '@/components/layout'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/use-media-query'
import { usePlatformStore } from '@/stores/platform-store'
import { useSidebarStore } from '@/stores/sidebar-store'
import type { AuthUser } from '@/types/auth'

import { usePlatformLogout } from '../hooks/use-platform'
import { canOpenPlatform, platformNavFor, ROLE_LABELS } from '../platform-nav'

function NoAccess() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold text-heading">You don’t have access to this page</h1>
      <p className="text-sm text-muted-foreground">Your staff role doesn’t include it.</p>
      <Link to="/platform" className="text-sm font-medium text-primary hover:underline">
        Back to the dashboard
      </Link>
    </div>
  )
}

/** The staff area in the organisation app's shell: the same sidebar, top bar and content area. */
export function PlatformLayout() {
  const staff = usePlatformStore((state) => state.staff)
  const collapsed = useSidebarStore((state) => state.collapsed)
  const isDesktop = useMediaQuery(BREAKPOINTS.desktop)
  const logout = usePlatformLogout()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const offset = isDesktop ? (collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded) : 0
  const user: AuthUser | null = staff && {
    id: staff.id,
    name: staff.displayName,
    email: staff.email,
    role: ROLE_LABELS[staff.role],
    avatarUrl: null,
  }

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar
        items={platformNavFor(staff?.role)}
        user={user}
        homeTo="/platform"
        staffMenu
        onSignOut={() => {
          void logout()
        }}
      />
      <div
        className="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 ease-out"
        style={{ paddingLeft: offset }}
      >
        <Topbar actions={<ThemeToggle />} />
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none sm:px-6 sm:pt-5 lg:px-8 lg:pt-6"
        >
          <InShellContext value={true}>
            {canOpenPlatform(staff?.role, pathname) ? <Outlet /> : <NoAccess />}
          </InShellContext>
        </main>
      </div>
    </div>
  )
}
