import { Link } from '@tanstack/react-router'

import { REQUEST_MENU } from '../../constants'

/** A request type from the menu that is not built yet: what the design has for it. */
export function RequestTypePlaceholder({ slug }: { slug: string }) {
  const item = REQUEST_MENU.find((entry) => entry.slug === slug)
  if (!item) {
    return (
      <section className="rounded-xl bg-card px-6 py-10 text-center shadow-xs">
        <h1 className="text-lg font-medium text-title">Unknown request type</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a type from the menu, or go to{' '}
          <Link to="/requests/punch" className="text-primary underline-offset-2 hover:underline">
            Punch requests
          </Link>
          .
        </p>
      </section>
    )
  }
  const Icon = item.icon
  return (
    <section className="grid justify-items-center gap-3 rounded-xl bg-card px-6 py-12 text-center shadow-xs">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-sidebar dark:text-heading">
        <Icon className="size-7" />
      </span>
      <h1 className="text-xl font-medium text-title">{item.label}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Coming next. {item.planned} It will follow the Punch and Shift requests: Request and
        Approvals tabs, the approval flow and history.
      </p>
    </section>
  )
}
