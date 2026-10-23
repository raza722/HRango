import { createFileRoute } from '@tanstack/react-router'

import { RequestsLayout } from '@/features/requests'

/** Requests: the sub menu of request types beside the chosen type. */
export const Route = createFileRoute('/_app/requests')({
  component: RequestsLayout,
})
