import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Performance: every page below `/performance` (the sidebar carries its menu). */
export const Route = createFileRoute('/_app/performance')({
  component: Outlet,
})
