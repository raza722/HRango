import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Payroll: every page below `/payroll` (the sidebar carries its menu). */
export const Route = createFileRoute('/_app/payroll')({
  component: Outlet,
})
