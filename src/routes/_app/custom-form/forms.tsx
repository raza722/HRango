import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { FORMS_SEARCH_DEFAULTS, FormsPage, formsSearchSchema } from '@/features/custom-forms'
import { pageTitle } from '@/lib/constants'

/** Forms: the list and the builder (`?edit=new|<id>`). */
export const Route = createFileRoute('/_app/custom-form/forms')({
  validateSearch: formsSearchSchema,
  search: { middlewares: [stripSearchParams(FORMS_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Forms') }] }),
  component: FormsPage,
})
