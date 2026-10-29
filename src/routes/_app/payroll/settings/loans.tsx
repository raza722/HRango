import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PayrollSettingsLayout } from '@/features/payroll'
import {
  STANDARD_CONFIGS,
  STANDARD_SEARCH_DEFAULTS,
  StandardRequestsPage,
  standardSearchSchema,
} from '@/features/requests'
import { pageTitle } from '@/lib/constants'

/**
 * Payroll Settings menu → Loans: Requests → Loan & Advances (Requests, Approvals, Settings)
 * beside the menu. It is put together here because the requests feature builds on payroll.
 */
export const Route = createFileRoute('/_app/payroll/settings/loans')({
  validateSearch: standardSearchSchema,
  search: { middlewares: [stripSearchParams(STANDARD_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Loans') }] }),
  component: LoansRoute,
})

function LoansRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // The registry is partial by type; Loan & Advances is always registered.
  const config = STANDARD_CONFIGS['loan-advances']
  return (
    <PayrollSettingsLayout current="loans">
      {config && (
        <StandardRequestsPage
          config={config}
          search={search}
          onSearch={(patch) => {
            void navigate({ search: (prev) => ({ ...prev, ...patch }) })
          }}
        />
      )}
    </PayrollSettingsLayout>
  )
}
