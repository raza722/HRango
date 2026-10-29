import { Link, Outlet } from '@tanstack/react-router'

import { PageContainer } from '@/components/layout'
import { cn } from '@/lib/utils'

/**
 * Talent Management's sub menu over its pages: Employees. Transfer, Salary Revision and
 * Employee Accounts stay in their own modules (Requests, Payroll) and are not linked here.
 * Type as the Leaves sub menu: Poppins Regular 13 #5C5C5C, the current one Medium 14 #17263A
 * under a 2.5px navy bar.
 */
const ITEMS = [{ to: '/talent-management/employees', label: 'Employees' }] as const

export function TalentManagementLayout() {
  return (
    <PageContainer>
      <nav
        aria-label="Talent Management"
        className="flex scrollbar-thin gap-6 overflow-x-auto rounded-xl bg-card px-4 shadow-xs sm:px-6"
      >
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'relative flex h-12 min-w-20 shrink-0 items-center justify-center px-1 text-[0.8125rem] whitespace-nowrap text-tab outline-none hover:text-heading focus-visible:ring-2 focus-visible:ring-ring/50',
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
    </PageContainer>
  )
}
