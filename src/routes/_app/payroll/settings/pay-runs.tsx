import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PAGE_SEARCH_DEFAULTS, pageSearchSchema, PayrollPayRunsPage } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

/** Payroll Settings menu → Pay Runs: the Monthly payrolls beside the menu. */
export const Route = createFileRoute('/_app/payroll/settings/pay-runs')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Pay Runs') }] }),
  component: PayRunsRoute,
})

function PayRunsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <PayrollPayRunsPage
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
