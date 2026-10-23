import { createFileRoute } from '@tanstack/react-router'

import { LeaveSettingsLayout } from '@/features/leaves'

/** Leaves → Settings: the inner tabs General Settings | Leave Types | Leave Policies. */
export const Route = createFileRoute('/_app/leaves/settings')({
  component: LeaveSettingsLayout,
})
