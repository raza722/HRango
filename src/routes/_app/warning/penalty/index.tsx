import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PenaltyPage, usePolicyTablePrefs, warningPenaltiesQueryOptions } from '@/features/warning'
import { pageTitle } from '@/lib/constants'

/** `?page=2` (penalty list) and `edit=<policy id>` (the policy whose penalties are edited). */
const penaltySearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  // API ids are numeric strings; a typed-in `?edit=4` parses as a number.
  edit: z
    .union([z.string().min(1), z.number().int().positive()])
    .transform(String)
    .optional()
    .catch(undefined),
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
