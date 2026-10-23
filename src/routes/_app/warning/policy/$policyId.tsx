import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PolicyDetailPage, warningPolicyQueryOptions } from '@/features/warning'
import { ApiError } from '@/lib/api-error'
import { pageTitle } from '@/lib/constants'

function PolicyNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-md bg-card px-6 py-12 text-center shadow-xs">
      <SearchX className="size-10 text-label" aria-hidden="true" />
      <h1 className="text-xl text-heading">Policy not found</h1>
      <p className="text-sm text-muted-foreground">It may have been deleted.</p>
      <Button variant="outline" asChild>
        <Link to="/warning/policy">
          <ArrowLeft /> Back to policies
        </Link>
      </Button>
    </div>
  )
}

export const Route = createFileRoute('/_app/warning/policy/$policyId')({
  loader: async ({ context: { queryClient }, params: { policyId } }) => {
    try {
      // `staleTime: 'static'` = use cached data if present, otherwise fetch (ensureQueryData).
      const policy = await queryClient.query({
        ...warningPolicyQueryOptions(policyId),
        staleTime: 'static',
      })
      return { title: policy.title }
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: pageTitle(loaderData?.title ?? 'Policy') }] }),
  component: PolicyDetailPage,
  notFoundComponent: PolicyNotFound,
})
