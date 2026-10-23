import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Benefits Management: Plan Years, Plans, Enrollment Windows, Employees, Files. */
export const Route = createFileRoute('/_app/benefits')({
  component: Outlet,
})
