import { z } from 'zod'

import { FORM_PAGE_SIZE, FORM_PAGE_SIZES } from './constants'
import { FORM_STATUSES } from './types/custom-forms.types'

const optionalText = z.string().trim().min(1).max(200).optional().catch(undefined)
const page = z.number().int().min(1).default(1).catch(1)
const pageSize = z
  .number()
  .int()
  .refine((size) => (FORM_PAGE_SIZES as readonly number[]).includes(size))
  .default(FORM_PAGE_SIZE)
  .catch(FORM_PAGE_SIZE)

/** Builder panes on a narrow screen (side by side on a wide one). */
export const BUILDER_PANES = ['build', 'preview'] as const
export type BuilderPane = (typeof BUILDER_PANES)[number]

/**
 * `/custom-form/forms?q=&status=&page=&pageSize=&edit=new|<id>&pane=build|preview`: the list's
 * search, status tab and pager, and the form open in the builder. Bad values fall back.
 */
export const formsSearchSchema = z.object({
  q: optionalText,
  status: z.enum(FORM_STATUSES).optional().catch(undefined),
  page,
  pageSize,
  edit: optionalText,
  pane: z.enum(BUILDER_PANES).default('build').catch('build'),
})
export type FormsSearch = z.infer<typeof formsSearchSchema>
export const FORMS_SEARCH_DEFAULTS = {
  page: 1,
  pageSize: FORM_PAGE_SIZE,
  pane: 'build',
} as const

export const MY_FORMS_TABS = ['assigned', 'submissions'] as const

/**
 * `/custom-form/my-forms?tab=assigned|submissions&q=&page=&pageSize=&fill=<formId>&response=<id>`:
 * the tab, its search and pager, the form being filled and the submission being viewed.
 */
export const myFormsSearchSchema = z.object({
  tab: z.enum(MY_FORMS_TABS).default('assigned').catch('assigned'),
  q: optionalText,
  page,
  pageSize,
  fill: optionalText,
  response: optionalText,
})
export type MyFormsSearch = z.infer<typeof myFormsSearchSchema>
export const MY_FORMS_SEARCH_DEFAULTS = {
  tab: 'assigned',
  page: 1,
  pageSize: FORM_PAGE_SIZE,
} as const

/**
 * `/custom-form/responses?formId=&q=&page=&pageSize=&response=<id>`: the form, the respondent
 * search, the pager and the response being viewed.
 */
export const responsesSearchSchema = z.object({
  formId: optionalText,
  q: optionalText,
  page,
  pageSize,
  response: optionalText,
})
export type ResponsesSearch = z.infer<typeof responsesSearchSchema>
export const RESPONSES_SEARCH_DEFAULTS = { page: 1, pageSize: FORM_PAGE_SIZE } as const
