import { z } from 'zod'

import {
  INTERVIEW_STATUSES,
  OFFER_STATUSES,
  OPENING_STATUSES,
  SOURCES,
  STAGES,
} from './types/recruitment.types'

/*
 * The Recruitment pages' URL state: search, filters, page, the open record (`view`), the form
 * (`dialog` / `edit`) and tabs. Bad values fall back; the defaults are left out of the URL.
 */

const text = z.string().trim().min(1).optional().catch(undefined)
const id = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(z.string().min(1))
  .optional()
  .catch(undefined)
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)
const flag = z.boolean().optional().catch(undefined)
const page = z.number().int().min(1).default(1).catch(1)
const create = z.enum(['create']).optional().catch(undefined)

const THIS_YEAR = new Date().getFullYear()

export const DASHBOARD_SEARCH_DEFAULTS = { year: THIS_YEAR } as const

/** `/recruitment/dashboard?year=&month=`. */
export const dashboardSearchSchema = z.object({
  year: z.number().int().min(2000).max(2100).default(THIS_YEAR).catch(THIS_YEAR),
  month: z.number().int().min(1).max(12).optional().catch(undefined),
})
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>

export const PAGE_SEARCH_DEFAULTS = { page: 1 } as const

/** `/recruitment/openings?q=&status=&departmentId=&branchId=&jobTitleId=&page=&view=&edit=&dialog=create`. */
export const openingsSearchSchema = z.object({
  q: text,
  status: z.enum(OPENING_STATUSES).optional().catch(undefined),
  departmentId: id,
  branchId: id,
  jobTitleId: id,
  page,
  view: id,
  edit: id,
  dialog: create,
})
export type OpeningsSearch = z.infer<typeof openingsSearchSchema>

/** `/recruitment/candidates?q=&source=&cityId=&page=&view=&edit=&dialog=create`. */
export const candidatesSearchSchema = z.object({
  q: text,
  source: z.enum(SOURCES).optional().catch(undefined),
  cityId: id,
  page,
  view: id,
  edit: id,
  dialog: create,
})
export type CandidatesSearch = z.infer<typeof candidatesSearchSchema>

export const APPLICATION_TABS = ['overview', 'timeline', 'interviews', 'offers'] as const
export type ApplicationTab = (typeof APPLICATION_TABS)[number]

export const APPLICATIONS_SEARCH_DEFAULTS = { page: 1, mode: 'board', tab: 'overview' } as const

/**
 * `/recruitment/applications?mode=board|list&q=&jobOpeningId=&applicantId=&stage=&activeOnly=true
 * &fromDate=&toDate=&page=&view=<id>&tab=&dialog=create`.
 */
export const applicationsSearchSchema = z.object({
  mode: z.enum(['board', 'list']).default('board').catch('board'),
  q: text,
  jobOpeningId: id,
  applicantId: id,
  stage: z.enum(STAGES).optional().catch(undefined),
  activeOnly: flag,
  fromDate: day,
  toDate: day,
  page,
  view: id,
  tab: z.enum(APPLICATION_TABS).default('overview').catch('overview'),
  dialog: create,
})
export type ApplicationsSearch = z.infer<typeof applicationsSearchSchema>

/**
 * `/recruitment/interviews?mine=true&past=true&status=&interviewerId=&jobOpeningId=&fromDate=
 * &toDate=&q=&page=&view=<id>&dialog=create`. Without `past` (or a From date) the list starts
 * today: upcoming interviews first, not last month's history.
 */
export const interviewsSearchSchema = z.object({
  mine: flag,
  past: flag,
  q: text,
  status: z.enum(INTERVIEW_STATUSES).optional().catch(undefined),
  interviewerId: id,
  jobOpeningId: id,
  fromDate: day,
  toDate: day,
  page,
  view: id,
  dialog: create,
})
export type InterviewsSearch = z.infer<typeof interviewsSearchSchema>

/** `/recruitment/offers?status=&jobOpeningId=&q=&page=&view=<id>&dialog=create`. */
export const offersSearchSchema = z.object({
  q: text,
  status: z.enum(OFFER_STATUSES).optional().catch(undefined),
  jobOpeningId: id,
  page,
  view: id,
  dialog: create,
})
export type OffersSearch = z.infer<typeof offersSearchSchema>

/** `/recruitment/settings?q=&dialog=create&edit=<id>`. */
export const settingsSearchSchema = z.object({
  q: text,
  edit: id,
  dialog: create,
})
export type SettingsSearch = z.infer<typeof settingsSearchSchema>
