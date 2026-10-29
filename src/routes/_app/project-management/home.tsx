import { createFileRoute } from '@tanstack/react-router'

import { HomeDashboard } from '@/features/project-management/components/dashboards/home-dashboard'
import { pageTitle } from '@/lib/constants'

/** Project Management → Home Dashboard: the signed-in person's work across their workspaces. */
export const Route = createFileRoute('/_app/project-management/home')({
  head: () => ({ meta: [{ title: pageTitle('Home Dashboard') }] }),
  component: HomeDashboard,
})
