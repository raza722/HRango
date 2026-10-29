import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { MY_FORMS_SEARCH_DEFAULTS, MyFormsPage, myFormsSearchSchema } from '@/features/custom-forms'
import { pageTitle } from '@/lib/constants'

/** My Forms: the forms assigned to the caller and their own submissions. */
export const Route = createFileRoute('/_app/custom-form/my-forms')({
  validateSearch: myFormsSearchSchema,
  search: { middlewares: [stripSearchParams(MY_FORMS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('My Forms') }] }),
  component: MyFormsPage,
})
