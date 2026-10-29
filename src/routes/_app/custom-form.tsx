import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Custom Form: every page below `/custom-form` (the sidebar carries its menu). */
export const Route = createFileRoute('/_app/custom-form')({
  component: Outlet,
})
