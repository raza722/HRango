import { env } from './env'

/** Product name used in titles and on the login screen (`VITE_APP_NAME`). */
export const APP_NAME = env.VITE_APP_NAME

export const COMPANY_NAME = 'Top Edge Technologies'

/** Default rows per page for list tables (the Figma tables show five). */
export const DEFAULT_PAGE_SIZE = 5

export const PAGE_SIZE_OPTIONS = [5, 10, 20] as const

/** Builds a document title: "Policy | Top Edge Technologies HRMS". */
export function pageTitle(title: string): string {
  return `${title} | ${APP_NAME}`
}
