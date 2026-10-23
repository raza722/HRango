import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Manpower Planning: Planning, E-Budgeting, Open Positions, Budget Approvals, E-Budget Settings. */
export const Route = createFileRoute('/_app/manpower-planning')({
  component: Outlet,
})
