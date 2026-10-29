import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/custom-form/')({
  beforeLoad: () => {
    throw redirect({ to: '/custom-form/forms', replace: true })
  },
})
