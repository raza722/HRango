import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PAGE_SEARCH_DEFAULTS, pageSearchSchema, PayrollHistoryPage } from '@/features/payroll'
import { pageTitle } from '@/lib/constants'

/** Payroll Settings menu → Payroll History: the closed Monthly payrolls beside the menu. */
export const Route = createFileRoute('/_app/payroll/settings/history')({
  validateSearch: pageSearchSchema,
  search: { middlewares: [stripSearchParams(PAGE_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Payroll History') }] }),
  component: PayrollHistoryRoute,
})

function PayrollHistoryRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <PayrollHistoryPage
      search={search}
      onSearch={(patch) => {
        void navigate({ search: (prev) => ({ ...prev, ...patch }) })
      }}
    />
  )
}
