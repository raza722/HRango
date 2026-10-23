import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/benefits/')({
  beforeLoad: () => {
    throw redirect({ to: '/benefits/plan-years', replace: true })
  },
})
