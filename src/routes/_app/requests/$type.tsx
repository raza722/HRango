import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  isStandardKind,
  REQUEST_MENU,
  RequestTypePlaceholder,
  STANDARD_CONFIGS,
  STANDARD_SEARCH_DEFAULTS,
  StandardRequestsPage,
  standardSearchSchema,
} from '@/features/requests'
import { pageTitle } from '@/lib/constants'

/**
 * The request types on the shared standard pages (Rest Days, Leave …), and a
 * placeholder for the ones not built yet.
 */
export const Route = createFileRoute('/_app/requests/$type')({
  validateSearch: standardSearchSchema,
  search: { middlewares: [stripSearchParams(STANDARD_SEARCH_DEFAULTS)] },
  head: ({ params }) => ({
    meta: [
      {
        title: pageTitle(
          REQUEST_MENU.find((item) => item.slug === params.type)?.label ?? 'Requests',
        ),
      },
    ],
  }),
  component: RequestTypeRoute,
})

function RequestTypeRoute() {
  const { type } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const config = isStandardKind(type) ? STANDARD_CONFIGS[type] : undefined
  if (!config) return <RequestTypePlaceholder slug={type} />
  return (
    <StandardRequestsPage
      // A fresh page (selection, dialogs) for each type.
      key={type}
      config={config}
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
