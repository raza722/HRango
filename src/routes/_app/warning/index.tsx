import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import {
  usePolicyTablePrefs,
  WarningOverviewPage,
  warningPenaltiesQueryOptions,
  warningPoliciesQueryOptions,
} from '@/features/warning'
import { pageTitle } from '@/lib/constants'

/** Each list on the overview keeps its own page: `?policyPage=2&penaltyPage=1`. */
const overviewSearchSchema = z.object({
  policyPage: z.number().int().min(1).default(1).catch(1),
  penaltyPage: z.number().int().min(1).default(1).catch(1),
})

export const Route = createFileRoute('/_app/warning/')({
  validateSearch: overviewSearchSchema,
  loaderDeps: ({ search: { policyPage, penaltyPage } }) => ({ policyPage, penaltyPage }),
  // Prefetch both lists without blocking the page.
  loader: ({ context: { queryClient }, deps }) => {
    const { pageSize } = usePolicyTablePrefs.getState()
    queryClient
      .query(warningPoliciesQueryOptions({ page: deps.policyPage, pageSize }))
      .catch(() => undefined)
    queryClient
      .query(warningPenaltiesQueryOptions({ page: deps.penaltyPage, pageSize }))
      .catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Warning') }] }),
  component: WarningOverviewPage,
})
