import { createFileRoute, Outlet } from '@tanstack/react-router'

/** End of Employment: All, Completed and Pending. */
export const Route = createFileRoute('/_app/end-of-employment')({
  component: Outlet,
})
