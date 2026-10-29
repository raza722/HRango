import { createFileRoute, redirect } from '@tanstack/react-router'

/** Settings → Custom Forms opens the Custom Form module's builder. */
export const Route = createFileRoute('/_app/settings/custom-forms')({
  beforeLoad: () => {
    throw redirect({ to: '/custom-form/forms', replace: true })
  },
})
