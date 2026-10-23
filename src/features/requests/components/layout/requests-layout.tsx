import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'

import { PageContainer } from '@/components/layout'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { REQUEST_MENU, type RequestMenuItem } from '../../constants'

const itemClass =
  'flex w-full items-center gap-2 px-6 py-2 text-sm text-[#707070] outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset data-[status=active]:bg-[#E8EAEC] data-[status=active]:font-medium data-[status=active]:text-sidebar dark:text-field-foreground dark:data-[status=active]:bg-input dark:data-[status=active]:text-heading'

/** A sub menu link: the built types have their own pages, the rest a placeholder. */
function MenuLink({ item, className }: { item: RequestMenuItem; className?: string }) {
  const Icon = item.icon
  const content = (
    <>
      <Icon className="size-5 shrink-0" />
      {item.label}
    </>
  )
  if (item.kind === 'punch') {
    return (
      <Link to="/requests/punch" className={cn(itemClass, className)}>
        {content}
      </Link>
    )
  }
  if (item.kind === 'shift') {
    return (
      <Link to="/requests/shift" className={cn(itemClass, className)}>
        {content}
      </Link>
    )
  }
  // Transfer has a page of its own; linking it through `$type` makes the router warn that the
  // generated path matched the static route instead.
  if (item.kind === 'transfer') {
    return (
      <Link to="/requests/transfer" className={cn(itemClass, className)}>
        {content}
      </Link>
    )
  }
  if (item.children) {
    return (
      <Link to="/requests/settings" className={cn(itemClass, className)}>
        {content}
        <ChevronDown aria-hidden="true" className="ml-auto size-4" />
      </Link>
    )
  }
  return (
    <Link to="/requests/$type" params={{ type: item.slug }} className={cn(itemClass, className)}>
      {content}
    </Link>
  )
}

/** Requests → Settings pages. */
const SETTINGS_LINKS = {
  restrictions: '/requests/settings/restrictions',
  delegation: '/requests/settings/delegation',
  flows: '/requests/settings/flows',
} as const

/** A page under Settings (Request Restriction, Delegation, Request Flows). */
function SubMenuLink({
  slug,
  label,
  className,
}: {
  slug: string
  label: string
  className?: string
}) {
  const to = SETTINGS_LINKS[slug as keyof typeof SETTINGS_LINKS]
  return (
    <Link to={to} className={cn(itemClass, 'py-1.5 pl-[3.25rem]', className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full border border-current" />
      {label}
    </Link>
  )
}

/**
 * Requests: the sub menu of request types (Punch, Expense, Leave, Shift
 * Requests…) beside the chosen type. On narrow screens the menu folds into a
 * button that shows the current type.
 */
export function RequestsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const current =
    REQUEST_MENU.find((item) => pathname.startsWith(`/requests/${item.slug}`)) ?? REQUEST_MENU[0]
  const CurrentIcon = current?.icon
  // "Settings · Delegation" on the folded menu while a Settings page is open.
  const currentChild = current?.children?.find((child) =>
    pathname.startsWith(`/requests/${current.slug}/${child.slug}`),
  )
  const currentLabel = currentChild
    ? `${current?.label ?? ''} · ${currentChild.label}`
    : current?.label

  return (
    <PageContainer>
      <div className="grid items-start gap-4 sm:gap-5 @4xl/page:grid-cols-[13.75rem_minmax(0,1fr)]">
        <nav
          aria-label="Request types"
          className="hidden self-stretch rounded-xl bg-card py-3 shadow-xs @4xl/page:block"
        >
          <ul className="grid gap-1">
            {REQUEST_MENU.map((item) => (
              <li key={item.slug}>
                <MenuLink item={item} />
                {/* Settings unfolds into its pages while one of them is open. */}
                {item.children && current === item && (
                  <ul aria-label={item.label} className="mt-1 grid gap-0.5">
                    {item.children.map((child) => (
                      <li key={child.slug}>
                        <SubMenuLink slug={child.slug} label={child.label} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="@4xl/page:hidden">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={`Request type: ${currentLabel ?? ''}`}
              className="flex h-11 w-full items-center justify-between gap-3 rounded-xl bg-card px-4 text-sm font-medium text-heading shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-2">
                {CurrentIcon && <CurrentIcon className="size-5" />}
                {currentLabel}
              </span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)] p-1"
            >
              {REQUEST_MENU.flatMap((item) => [
                <DropdownMenuItem key={item.slug} asChild className="p-0">
                  <MenuLink item={item} className="px-3" />
                </DropdownMenuItem>,
                ...(item.children ?? []).map((child) => (
                  <DropdownMenuItem key={`${item.slug}-${child.slug}`} asChild className="p-0">
                    <SubMenuLink slug={child.slug} label={child.label} className="pl-10" />
                  </DropdownMenuItem>
                )),
              ])}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  )
}
