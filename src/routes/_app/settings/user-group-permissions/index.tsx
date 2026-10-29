import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { LIST_SEARCH_DEFAULTS, RolesPage, rolesSearchSchema } from '@/features/access'
import { pageTitle } from '@/lib/constants'

/** User Group Permissions: the roles with search, Include retired, Add / Edit. */
export const Route = createFileRoute('/_app/settings/user-group-permissions/')({
  validateSearch: rolesSearchSchema,
  search: { middlewares: [stripSearchParams(LIST_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('User Group Permissions') }] }),
  component: RolesPage,
})
