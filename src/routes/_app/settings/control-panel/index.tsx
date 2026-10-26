import { createFileRoute, redirect } from '@tanstack/react-router'

import { can } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

/** The Control Panel opens on the first screen the user may view (General Settings for an admin). */
const SCREENS = [
  { to: '/settings/control-panel/general', code: 'organisation.general.view' },
  { to: '/settings/control-panel/branches', code: 'organisation.branches.view' },
  { to: '/settings/control-panel/locations', code: 'organisation.locations.view' },
  { to: '/settings/control-panel/areas', code: 'organisation.areas.view' },
  { to: '/settings/control-panel/job-titles', code: 'organisation.job_titles.view' },
] as const

export const Route = createFileRoute('/_app/settings/control-panel/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user
    const first = SCREENS.find((screen) => can(user, screen.code)) ?? SCREENS[0]
    throw redirect({ to: first.to, replace: true })
  },
})
