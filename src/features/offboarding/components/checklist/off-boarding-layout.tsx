import { useId, useState } from 'react'
import { Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'

import { PageContainer } from '@/components/layout'
import { cn } from '@/lib/utils'

const LINKS = [
  { label: 'Control Panel', to: '/settings/control-panel' },
  { label: 'Off Boarding Settings', to: '/settings/off-boarding' },
  { label: 'Off Boarding Checklist', to: '/settings/off-boarding/checklist' },
] as const

/**
 * The menu card as drawn: three plain rows, the current one with the blue
 * left border, a pale fill and an arrow tab past the card's edge. Below 56rem
 * of page width it folds into a button showing the current screen.
 */
function OffBoardingNav() {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const matchRoute = useMatchRoute()
  const current = LINKS.find((link) => matchRoute({ to: link.to }) !== false)

  return (
    <nav
      aria-label="Off Boarding Settings"
      className="min-w-0 rounded-xl bg-card shadow-xs @[56rem]/page:sticky @[56rem]/page:top-[6.25rem]"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((value) => !value)
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-sm font-medium text-heading outline-none focus-visible:ring-2 focus-visible:ring-ring/40 @[56rem]/page:hidden"
      >
        {current?.label ?? 'Off Boarding Settings'}
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 text-label transition-transform', open && 'rotate-180')}
        />
        <span className="sr-only">{open ? ', hide menu' : ', show menu'}</span>
      </button>
      <ul
        id={menuId}
        className={cn(
          'grid gap-1 border-t py-2 @[56rem]/page:block @[56rem]/page:space-y-1 @[56rem]/page:border-t-0 @[56rem]/page:py-4',
          !open && 'hidden',
        )}
      >
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              activeOptions={{ exact: true }}
              onClick={() => {
                setOpen(false)
              }}
              className={cn(
                'relative flex min-h-10 items-center border-l-2 border-transparent px-6 text-base text-heading transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40',
                'data-[status=active]:border-[#4772DB] data-[status=active]:bg-[#DFE4F7] data-[status=active]:pl-5 dark:data-[status=active]:bg-nav-active',
                // The arrow tab of the drawn menu, on wide screens.
                "@[56rem]/page:data-[status=active]:after:absolute @[56rem]/page:data-[status=active]:after:top-0 @[56rem]/page:data-[status=active]:after:-right-3 @[56rem]/page:data-[status=active]:after:h-full @[56rem]/page:data-[status=active]:after:w-3 @[56rem]/page:data-[status=active]:after:bg-inherit @[56rem]/page:data-[status=active]:after:content-[''] @[56rem]/page:data-[status=active]:after:[clip-path:polygon(0_0,100%_50%,0_100%)]",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Settings → Off Boarding: the menu card on the left and the selected screen
 * on the right, like the Control Panel.
 */
export function OffBoardingLayout() {
  return (
    <PageContainer>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 sm:gap-5 @[56rem]/page:grid-cols-[13.5rem_minmax(0,1fr)] @[90rem]/page:grid-cols-[15rem_minmax(0,1fr)]">
        <OffBoardingNav />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  )
}
