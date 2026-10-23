import { createFileRoute } from '@tanstack/react-router'

import { JobTitleFormPage } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/job-titles/new')({
  head: () => ({ meta: [{ title: pageTitle('New Job Title') }] }),
  component: () => <JobTitleFormPage />,
})
