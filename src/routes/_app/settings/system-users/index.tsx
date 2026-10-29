import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { LIST_SEARCH_DEFAULTS, SystemUsersPage, usersSearchSchema } from '@/features/access'
import { pageTitle } from '@/lib/constants'

/** System Users: search, Active / Disabled, role and employee filters, Add / Edit. */
export const Route = createFileRoute('/_app/settings/system-users/')({
  validateSearch: usersSearchSchema,
  search: { middlewares: [stripSearchParams(LIST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('System Users') }] }),
  component: SystemUsersPage,
})
