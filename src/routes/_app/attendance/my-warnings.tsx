import { createFileRoute } from '@tanstack/react-router'

import { MyWarningsPage } from '@/features/warning'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/attendance/my-warnings')({
  head: () => ({ meta: [{ title: pageTitle('My Warnings') }] }),
  component: MyWarningsPage,
})
