import { type ReactElement, useId, useState } from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'

import type { NavChild, NavItem } from '@/app/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarNavProps {
  items: readonly NavItem[]
  collapsed: boolean
  /** Called after a link is clicked (the mobile drawer closes itself with it). */
  onNavigate?: () => void
}

// Figma Side Menu: Poppins Regular 13 #B9BDC4; the current row white on #293749.
const rowClassName = cn(
  'group flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[0.8125rem] text-sidebar-muted transition-colors outline-none',
  'hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-muted/60',
)
const activeRowClassName =
  'data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-foreground'
const iconClassName =
  'size-5 shrink-0 text-sidebar-muted transition-colors group-hover:text-sidebar-foreground group-data-[status=active]:text-sidebar-foreground'

function WithTooltip({
  label,
  show,
  children,
}: {
  label: string
  show: boolean
  children: ReactElement
}) {
  if (!show) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * An item with sub-pages (Settings). Expanded it lists its children with the
 * current one in blue, as drawn; in the icon rail it opens a menu instead.
 */
function NavGroup({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem & { children: NonNullable<NavItem['children']> }
  collapsed: boolean
  onNavigate?: (() => void) | undefined
}) {
  const listId = useId()
  const matchRoute = useMatchRoute()
  const isActive = matchRoute({ to: item.to, fuzzy: true }) !== false
  const [open, setOpen] = useState(isActive)
  // Open the group when the user lands inside it from elsewhere.
  const [wasActive, setWasActive] = useState(isActive)
  if (isActive !== wasActive) {
    setWasActive(isActive)
    if (isActive) setOpen(true)
  }

  if (collapsed) {
    return (
      <DropdownMenu modal={false}>
        <WithTooltip label={item.label} show>
          <DropdownMenuTrigger
            aria-label={item.label}
            data-status={isActive ? 'active' : undefined}
            className={cn(rowClassName, activeRowClassName, 'justify-center px-0')}
          >
            <item.icon className={iconClassName} />
          </DropdownMenuTrigger>
        </WithTooltip>
        <DropdownMenuContent side="right" align="start" className="min-w-52">
          <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
          {item.children.map((child) => (
            <DropdownMenuItem key={child.to} asChild>
              <Link
                to={child.to}
                onClick={onNavigate}
                className="data-[status=active]:font-medium data-[status=active]:text-pager-active"
              >
                {child.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        data-status={isActive && !open ? 'active' : undefined}
        onClick={() => {
          setOpen((value) => !value)
        }}
        className={cn(rowClassName, activeRowClassName, isActive && 'text-sidebar-foreground')}
      >
        <item.icon className={cn(iconClassName, isActive && 'text-sidebar-foreground')} />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-sidebar-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="mt-1 ml-[1.375rem] flex flex-col gap-0.5 border-l border-sidebar-border pl-3"
      >
        {item.children.map((child) => (
          <li key={child.to}>
            <Link
              to={child.to}
              onClick={onNavigate}
              className={cn(
                'flex min-h-8 items-center rounded-md px-2.5 py-1.5 text-[0.8125rem] leading-snug text-sidebar-child transition-colors outline-none',
                'hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-muted/60',
                'data-[status=active]:font-medium data-[status=active]:text-sidebar-link-active',
              )}
            >
              {child.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

const treeRowClassName = cn(
  'flex min-h-8 flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[0.8125rem] leading-snug text-sidebar-child transition-colors outline-none',
  'hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-muted/60',
)

/** A tree entry's key: its path, and its params on a shared route (`/requests/$type`). */
const childKey = (child: NavChild) =>
  `${child.to}${child.params ? `:${Object.values(child.params).join('/')}` : ''}`

/** The ring bullet in front of every Payroll menu entry. */
function Bullet() {
  return (
    <span
      aria-hidden="true"
      className="size-[7px] shrink-0 rounded-full border border-current opacity-80"
    />
  )
}

/** One entry of Payroll's menu: a page, or a group with its own pages under it. */
function TreeEntry({
  child,
  onNavigate,
}: {
  child: NavChild
  onNavigate?: (() => void) | undefined
}) {
  const listId = useId()
  const matchRoute = useMatchRoute()
  const inside = matchRoute({ to: child.to, params: child.params, fuzzy: true }) !== false
  const [open, setOpen] = useState(inside || Boolean(child.alwaysOpen))
  const [wasInside, setWasInside] = useState(inside)
  if (inside !== wasInside) {
    setWasInside(inside)
    if (inside) setOpen(true)
  }

  if (!child.children) {
    return (
      <li>
        <Link
          to={child.to}
          params={child.params}
          onClick={onNavigate}
          activeOptions={{ exact: true, includeSearch: false }}
          className={cn(
            treeRowClassName,
            'data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-foreground',
          )}
        >
          {child.icon ? <child.icon aria-hidden="true" className="size-4 shrink-0" /> : <Bullet />}
          <span className="min-w-0 flex-1">{child.label}</span>
        </Link>
      </li>
    )
  }

  const shown = open || Boolean(child.alwaysOpen)
  return (
    <li>
      <div
        className={cn(
          'flex items-center rounded-md',
          shown && !child.alwaysOpen && 'bg-sidebar-accent',
        )}
      >
        <Link
          to={child.to}
          params={child.params}
          onClick={() => {
            setOpen(true)
            onNavigate?.()
          }}
          activeOptions={{ exact: true, includeSearch: false }}
          className={cn(
            treeRowClassName,
            'data-[status=active]:text-sidebar-foreground',
            inside && 'text-sidebar-foreground',
          )}
        >
          <Bullet />
          <span className="min-w-0 flex-1">{child.label}</span>
        </Link>
        {!child.alwaysOpen && (
          <button
            type="button"
            aria-expanded={shown}
            aria-controls={listId}
            aria-label={`${shown ? 'Collapse' : 'Expand'} ${child.label}`}
            onClick={() => {
              setOpen((value) => !value)
            }}
            className="mr-1 flex size-7 shrink-0 items-center justify-center rounded text-sidebar-muted outline-none hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-muted/60"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 transition-transform', shown && 'rotate-180')}
            />
          </button>
        )}
      </div>
      <ul id={listId} hidden={!shown} className="mt-1 flex flex-col gap-1 pl-3">
        {child.children.map((grandchild) => (
          <TreeEntry key={childKey(grandchild)} child={grandchild} onNavigate={onNavigate} />
        ))}
      </ul>
    </li>
  )
}

/** Flattened entries (with depth) for the icon rail's menu. */
function flatten(children: readonly NavChild[], depth = 0): { child: NavChild; depth: number }[] {
  return children.flatMap((child) => [
    { child, depth },
    ...flatten(child.children ?? [], depth + 1),
  ])
}

/**
 * Payroll: its many pages as the drawn tree (ring bullets, groups that open
 * with a chevron, the current page boxed). In the icon rail it is a menu.
 */
function NavTree({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem & { children: readonly NavChild[] }
  collapsed: boolean
  onNavigate?: (() => void) | undefined
}) {
  const listId = useId()
  const matchRoute = useMatchRoute()
  const isActive = matchRoute({ to: item.to, fuzzy: true }) !== false
  const [open, setOpen] = useState(isActive)
  const [wasActive, setWasActive] = useState(isActive)
  if (isActive !== wasActive) {
    setWasActive(isActive)
    if (isActive) setOpen(true)
  }

  if (collapsed) {
    return (
      <DropdownMenu modal={false}>
        <WithTooltip label={item.label} show>
          <DropdownMenuTrigger
            aria-label={item.label}
            data-status={isActive ? 'active' : undefined}
            className={cn(rowClassName, activeRowClassName, 'justify-center px-0')}
          >
            <item.icon className={iconClassName} />
          </DropdownMenuTrigger>
        </WithTooltip>
        <DropdownMenuContent
          side="right"
          align="start"
          className="max-h-[80vh] min-w-60 overflow-y-auto"
        >
          <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
          {flatten(item.children).map(({ child, depth }) => (
            <DropdownMenuItem key={childKey(child)} asChild>
              <Link
                to={child.to}
                params={child.params}
                onClick={onNavigate}
                activeOptions={{ exact: true, includeSearch: false }}
                style={{ paddingLeft: `${0.5 + depth}rem` }}
                className="data-[status=active]:font-medium data-[status=active]:text-pager-active"
              >
                {child.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        data-status={isActive ? 'active' : undefined}
        onClick={() => {
          setOpen((value) => !value)
        }}
        className={cn(rowClassName, activeRowClassName)}
      >
        <item.icon className={iconClassName} />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-sidebar-muted" />
      </button>
      <ul id={listId} hidden={!open} className="mt-1 flex flex-col gap-1 pl-1.5">
        {item.children.map((child) => (
          <TreeEntry key={childKey(child)} child={child} onNavigate={onNavigate} />
        ))}
      </ul>
    </>
  )
}

export function SidebarNav({ items, collapsed, onNavigate }: SidebarNavProps) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        if (item.children && item.tree) {
          return (
            <li key={item.to}>
              <NavTree
                item={{ ...item, children: item.children }}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </li>
          )
        }
        if (item.children) {
          return (
            <li key={item.to}>
              <NavGroup
                item={{ ...item, children: item.children }}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </li>
          )
        }

        return (
          <li key={item.to}>
            <WithTooltip label={item.label} show={collapsed}>
              <Link
                to={item.to}
                activeOptions={{ exact: item.exact ?? false, includeSearch: false }}
                onClick={onNavigate}
                className={cn(rowClassName, activeRowClassName, collapsed && 'justify-center px-0')}
              >
                <item.icon className={iconClassName} />
                <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
              </Link>
            </WithTooltip>
          </li>
        )
      })}
    </ul>
  )
}
