import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings/off-boarding/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/off-boarding/checklist', replace: true })
  },
})
