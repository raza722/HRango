import { createFileRoute } from '@tanstack/react-router'

import { RejectionReasonsPage, settingsSearchSchema } from '@/features/recruitment'
import { pageTitle } from '@/lib/constants'

/** Recruitment Settings: the rejection reasons. */
export const Route = createFileRoute('/_app/recruitment/settings')({
  validateSearch: settingsSearchSchema,
  head: () => ({ meta: [{ title: pageTitle('Recruitment Settings') }] }),
  component: RejectionReasonsPage,
})
