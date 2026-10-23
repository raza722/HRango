import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/payroll/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/payroll/settings/general', replace: true })
  },
})
