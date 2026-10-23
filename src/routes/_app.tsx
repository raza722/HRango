import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthenticatedLayout } from '@/app/layouts/authenticated-layout'

/**
 * Pathless layout route: every child is protected. Without a session the
 * visitor goes to /login and comes back to the requested URL afterwards.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true })
    }
  },
  component: AuthenticatedLayout,
})
