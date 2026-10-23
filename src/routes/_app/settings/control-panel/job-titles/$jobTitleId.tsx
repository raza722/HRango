import { createFileRoute } from '@tanstack/react-router'

import { JobTitleFormPage, jobTitleResource } from '@/features/settings'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/control-panel/job-titles/$jobTitleId')({
  loader: ({ context: { queryClient }, params: { jobTitleId } }) => {
    queryClient.query(jobTitleResource.detailQuery(jobTitleId)).catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Edit Job Title') }] }),
  component: function EditJobTitleRoute() {
    const { jobTitleId } = Route.useParams()
    // `key` gives each record a fresh form when moving between edit pages.
    return <JobTitleFormPage key={jobTitleId} jobTitleId={jobTitleId} />
  },
})
