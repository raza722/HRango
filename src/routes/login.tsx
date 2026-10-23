import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { LoginPage } from '@/features/auth'
import { pageTitle } from '@/lib/constants'
import { toSafeRedirect } from '@/lib/utils'

const loginSearchSchema = z.object({
  /** Where to go after signing in; only same-origin paths are honoured. */
  redirect: z.string().optional().catch(undefined),
})

/** Public route. Signed-in visitors are sent straight on. */
export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ href: toSafeRedirect(search.redirect), replace: true })
    }
  },
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
  component: LoginPage,
})
