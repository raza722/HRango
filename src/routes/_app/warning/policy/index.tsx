import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { PolicyPage, usePolicyTablePrefs, warningPoliciesQueryOptions } from '@/features/warning'
import { pageTitle } from '@/lib/constants'

/** `?page=2&edit=<policy id>`. Bad values fall back instead of throwing. */
const policySearchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  // API ids are numeric strings; a typed-in `?edit=4` parses as a number.
  edit: z
    .union([z.string().min(1), z.number().int().positive()])
    .transform(String)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_app/warning/policy/')({
  validateSearch: policySearchSchema,
  loaderDeps: ({ search: { page } }) => ({ page }),
  // Prefetch the table page (also on link hover) without blocking the form.
  loader: ({ context: { queryClient }, deps: { page } }) => {
    const { pageSize } = usePolicyTablePrefs.getState()
    // Errors are shown by the table itself, so a failed prefetch is ignored here.
    queryClient.query(warningPoliciesQueryOptions({ page, pageSize })).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Warning Policy') }] }),
  component: PolicyPage,
})
