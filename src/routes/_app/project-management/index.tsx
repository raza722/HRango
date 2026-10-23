import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/project-management/')({
  beforeLoad: () => {
    throw redirect({ to: '/project-management/workspaces', replace: true })
  },
})
