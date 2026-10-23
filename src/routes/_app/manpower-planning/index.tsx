import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/manpower-planning/')({
  beforeLoad: () => {
    throw redirect({ to: '/manpower-planning/planning', replace: true })
  },
})
