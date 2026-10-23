import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings/control-panel/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/control-panel/general', replace: true })
  },
})
