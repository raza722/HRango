import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { USER_SEARCH_DEFAULTS, UserDetailPage, userSearchSchema } from '@/features/access'
import { pageTitle } from '@/lib/constants'

/** One account: roles, effective permissions, overrides, sessions and its history. */
export const Route = createFileRoute('/_app/settings/system-users/$userId')({
  validateSearch: userSearchSchema,
  search: { middlewares: [stripSearchParams(USER_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('System User') }] }),
  component: UserDetailPage,
})
