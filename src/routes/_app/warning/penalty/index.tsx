import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PenaltyPage, usePolicyTablePrefs, warningPenaltiesQueryOptions } from '@/features/warning'
import { pageTitle } from '@/lib/constants'

/** `?page=2&edit=pn_123`. Bad values fall back instead of throwing. */
const penaltySearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  edit: z.string().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/warning/penalty/')({
  validateSearch: penaltySearchSchema,
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: ({ context: { queryClient }, deps: { page } }) => {
    const { pageSize } = usePolicyTablePrefs.getState()
    queryClient.query(warningPenaltiesQueryOptions({ page, pageSize })).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Warning Penalty') }] }),
  component: PenaltyPage,
})
