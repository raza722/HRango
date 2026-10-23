import { createFileRoute } from '@tanstack/react-router'

import { LeavesLayout } from '@/features/leaves'

/** Leaves: the sub menu (My Leaves, Leave Applications, Settings) over its pages. */
export const Route = createFileRoute('/_app/leaves')({
  component: LeavesLayout,
})
