import { createFileRoute } from '@tanstack/react-router'

import { RemindersPage } from '@/features/project-management/components/reminders/reminders-page'
import { pageTitle } from '@/lib/constants'

/** Project Management → Reminders: the signed-in person's reminders on tasks. */
export const Route = createFileRoute('/_app/project-management/reminders')({
  head: () => ({ meta: [{ title: pageTitle('Reminders') }] }),
  component: RemindersPage,
})
