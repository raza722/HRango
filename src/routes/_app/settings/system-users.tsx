import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Settings → System Users: the list (index) and one account (`$userId`). */
export const Route = createFileRoute('/_app/settings/system-users')({
  component: Outlet,
})
