import { useId, useState } from 'react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  CONTROL_PANEL_SECTIONS,
  type ControlPanelLink,
  type ControlPanelSection,
} from '../../constants'

// Figma draws the menu in Inter Regular 10 #303030, the current item #263871. 10px is below
// the readability floor, so the items take the 16px the Off Boarding frames of this module use
// for the same menu (14px on phones, where the menu folds into a list).
const rowClassName =
  'flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm text-nav-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 @[56rem]/page:text-base'
const activeRowClassName =
  'data-[status=active]:bg-nav-active data-[status=active]:text-nav-active-foreground'

function SectionIcon({ section }: { section: ControlPanelSection }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', section.tone)}
    >
      <section.icon className="size-4" />
    </span>
  )
}

function SectionGroup({
  section,
  onNavigate,
}: {
  section: ControlPanelSection
  onNavigate: () => void
}) {
  const listId = useId()
  const [open, setOpen] = useState(true)
  const children = section.children ?? []

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((value) => !value)
        }}
        className={rowClassName}
      >
        <SectionIcon section={section} />
        <span className="flex-1 truncate">{section.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 text-label transition-transform', !open && '-rotate-90')}
        />
      </button>
      <ul id={listId} hidden={!open} className="mt-1 ml-[1.375rem] grid gap-0.5 border-l pl-3">
        {children.map((child) => (
          <li key={child.to}>
            <Link
              to={child.to}
              onClick={onNavigate}
              className={cn(rowClassName, activeRowClassName, 'min-h-9 gap-2.5 px-2.5')}
            >
              <child.icon aria-hidden="true" className="size-4 shrink-0 text-label" />
              <span className="truncate">{child.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  )
}

/**
 * The "Control Panel" menu card. Beside the content on wide screens; on
 * narrow ones it folds into a button showing the current section.
 */
export function ControlPanelNav() {
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const matchRoute = useMatchRoute()

  const links = CONTROL_PANEL_SECTIONS.flatMap(
    (section): Pick<ControlPanelLink, 'label' | 'to'>[] =>
      section.children
        ? [...section.children]
        : section.to
          ? [{ label: section.label, to: section.to }]
          : [],
  )
  const current = links.find((link) => matchRoute({ to: link.to, fuzzy: true }) !== false)

  const close = () => {
    setOpen(false)
  }

  return (
    <nav
      aria-label="Control Panel"
      className="min-w-0 rounded-xl bg-card font-inter shadow-xs @[56rem]/page:sticky @[56rem]/page:top-[6.25rem]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 @[56rem]/page:border-b @[56rem]/page:px-5 @[56rem]/page:py-4">
        <h2 className="text-base font-medium text-heading">Control Panel</h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => {
            setOpen((value) => !value)
          }}
          className="flex min-h-9 items-center gap-1.5 rounded-md bg-nav-active px-3 text-sm text-nav-active-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 @[56rem]/page:hidden"
        >
          {current?.label ?? 'Menu'}
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 transition-transform', open && 'rotate-180')}
          />
          <span className="sr-only">{open ? ', hide menu' : ', show menu'}</span>
        </button>
      </div>

      <ul
        id={menuId}
        className={cn(
          'grid gap-1 border-t px-2 py-2 @[56rem]/page:block @[56rem]/page:space-y-1 @[56rem]/page:border-t-0 @[56rem]/page:px-3 @[56rem]/page:py-3',
          !open && 'hidden',
        )}
      >
        {CONTROL_PANEL_SECTIONS.map((section) =>
          section.children ? (
            <SectionGroup key={section.label} section={section} onNavigate={close} />
          ) : section.to ? (
            <li key={section.label}>
              <Link
                to={section.to}
                onClick={close}
                className={cn(rowClassName, activeRowClassName)}
              >
                <SectionIcon section={section} />
                <span className="truncate">{section.label}</span>
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  )
}
