import { createFileRoute, redirect } from '@tanstack/react-router'

import { useAuthStore } from '@/stores/auth-store'

/** The signed-in person's own employee profile (the sidebar's My Profile). */
export const Route = createFileRoute('/_app/my-profile')({
  beforeLoad: () => {
    const employeeId = useAuthStore.getState().user?.employeeId
    if (!employeeId) throw redirect({ to: '/', replace: true })
    throw redirect({
      to: '/talent-management/employees/$employeeId',
      params: { employeeId },
      replace: true,
    })
  },
})
