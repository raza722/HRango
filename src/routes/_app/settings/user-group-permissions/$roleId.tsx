import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { ROLE_SEARCH_DEFAULTS, RoleDetailPage, roleSearchSchema } from '@/features/access'
import { pageTitle } from '@/lib/constants'

/** One role: the permission editor, the people who hold it and its history. */
export const Route = createFileRoute('/_app/settings/user-group-permissions/$roleId')({
  validateSearch: roleSearchSchema,
  search: { middlewares: [stripSearchParams(ROLE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Role') }] }),
  component: RoleDetailPage,
})
