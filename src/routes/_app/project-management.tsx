import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Project Management: the dashboards and the workspaces (the sidebar carries its menu). */
export const Route = createFileRoute('/_app/project-management')({
  component: Outlet,
})
