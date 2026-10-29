import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { PayrollSettingsLayout } from '@/features/payroll'
import {
  APPRAISALS_SEARCH_DEFAULTS,
  appraisalsSearchSchema,
  AppraisalsView,
} from '@/features/performance'
import { pageTitle } from '@/lib/constants'

/**
 * Payroll Settings menu → Appraisal: Performance → Appraisals beside the menu. It is put together
 * here because the performance feature builds on payroll.
 */
export const Route = createFileRoute('/_app/payroll/settings/appraisal')({
  validateSearch: appraisalsSearchSchema,
  search: { middlewares: [stripSearchParams(APPRAISALS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Appraisal') }] }),
  component: AppraisalRoute,
})

function AppraisalRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <PayrollSettingsLayout current="appraisal">
      <AppraisalsView
        search={search}
        onSearch={(patch) => {
          void navigate({ search: (prev) => ({ ...prev, ...patch }) })
        }}
      />
    </PayrollSettingsLayout>
  )
}
