import { createFileRoute } from '@tanstack/react-router'

import { OffBoardingLayout } from '@/features/offboarding'

/** Settings → Off Boarding: its menu card plus the selected screen. */
export const Route = createFileRoute('/_app/settings/off-boarding')({
  component: OffBoardingLayout,
})
