import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Recruitment: every page below `/recruitment` (the sidebar carries its menu). */
export const Route = createFileRoute('/_app/recruitment')({
  component: Outlet,
})
