import { Link, Outlet } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout'
import { cn } from '@/lib/utils'

/**
 * The sub menu over every Leaves page (frames 4428:89943 …): My Leaves,
 * Leave Applications and Settings, Poppins Regular 13 #5C5C5C with the
 * current one Medium 14 #17263A under a 2.5px navy bar. Leave Encashment is
 * the Payroll page of that name, as the design notes list it here.
 */
const ITEMS = [
  { to: '/leaves/my-leaves', label: 'My Leaves' },
  { to: '/leaves/applications', label: 'Leave Applications' },
  { to: '/leaves/settings', label: 'Settings' },
  { to: '/payroll/leave-encashment', label: 'Leave Encashment' },
] as const

export function LeavesLayout() {
  return (
    <PageContainer>
      <section aria-label="Leaves" className="overflow-hidden rounded-xl bg-card shadow-xs">
        <nav
          aria-label="Leaves"
          className="flex scrollbar-thin gap-6 overflow-x-auto border-b px-4 sm:px-6"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'relative flex h-14 min-w-20 shrink-0 items-center justify-center px-1 text-[0.8125rem] whitespace-nowrap text-tab outline-none hover:text-heading focus-visible:ring-2 focus-visible:ring-ring/50',
                'data-[status=active]:text-sm data-[status=active]:font-medium data-[status=active]:text-sidebar dark:data-[status=active]:text-heading',
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-[2.5px] rounded-b-[10px] bg-sidebar dark:bg-primary"
                    />
                  )}
                  {item.label}
                </>
              )}
            </Link>
          ))}
        </nav>
        <Outlet />
      </section>
    </PageContainer>
  )
}
