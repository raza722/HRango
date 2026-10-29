import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  RESPONSES_SEARCH_DEFAULTS,
  ResponsesPage,
  responsesSearchSchema,
} from '@/features/custom-forms'
import { pageTitle } from '@/lib/constants'

/** Form Responses: one form's answers (`?formId=`), counts and CSV export. */
export const Route = createFileRoute('/_app/custom-form/responses')({
  validateSearch: responsesSearchSchema,
  search: { middlewares: [stripSearchParams(RESPONSES_SEARCH_DEFAULTS)] },
  head: () => ({ meta: [{ title: pageTitle('Form Responses') }] }),
  component: ResponsesPage,
})
