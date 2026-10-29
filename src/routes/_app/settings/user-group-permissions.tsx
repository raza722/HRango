import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Settings → User Group Permissions: the roles (index) and one role (`$roleId`). */
export const Route = createFileRoute('/_app/settings/user-group-permissions')({
  component: Outlet,
})
