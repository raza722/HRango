import { HttpResponse } from 'msw'
import { z } from 'zod'

import type { ApiItem, Paginated } from '@/types/api'

import { CURRENT_EMPLOYEE_ID } from '../scheduling/seed'
import { apiPath, errorResponse, paginate, readPageParams } from '../utils'

export const base = (path: string) => apiPath(`/payroll${path}`)

export const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })

export const notFound = (what: string) =>
  errorResponse(404, `That ${what} could not be found.`, { code: 'NOT_FOUND' })

export const conflict = (
  message: string,
  code = 'CONFLICT',
  fieldErrors?: Record<string, string>,
) => errorResponse(409, message, { code, ...(fieldErrors ? { fieldErrors } : {}) })

export async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  const body: unknown = await request.json().catch(() => null)
  return schema.safeParse(body)
}

/** First issue of a failed parse, with its field, as the API's 422 body. */
export function rejected(error: z.ZodError) {
  const issue = error.issues[0]
  const field = issue?.path.join('.') ?? ''
  return invalid(
    issue?.message ?? 'Some fields are not valid.',
    field ? { [field]: issue?.message ?? '' } : undefined,
  )
}

export const ok = <T>(data: T) => HttpResponse.json<ApiItem<T>>({ data })

export function page<T>(url: URL, items: readonly T[]) {
  const { page: number, pageSize } = readPageParams(url)
  return HttpResponse.json<Paginated<T>>(paginate(items, number, pageSize))
}

/** Rows whose text contains `?q=` (the API's search; `?search=` still read) case-insensitively. */
export function searched<T>(url: URL, items: readonly T[], text: (item: T) => string): T[] {
  const search = (url.searchParams.get('q') ?? url.searchParams.get('search') ?? '')
    .trim()
    .toLowerCase()
  return search ? items.filter((item) => text(item).toLowerCase().includes(search)) : [...items]
}

export const param = (url: URL, name: string) => {
  const value = url.searchParams.get(name)
  return value === null || value === '' ? undefined : value
}

export const numberParam = (url: URL, name: string) => {
  const value = param(url, name)
  if (value === undefined) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

/** `?from=` / `?to=` bounds on a number. */
export const between = (value: number, from: number | undefined, to: number | undefined) =>
  (from === undefined || value >= from) && (to === undefined || value <= to)

export const now = () => new Date().toISOString()
export const ME = CURRENT_EMPLOYEE_ID

export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')
export const month = z.string().regex(/^\d{4}-\d{2}$/, 'Choose a month')
export const name = z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters')
export const money = z
  .number({ error: 'Enter an amount' })
  .min(0, 'The amount cannot be negative')
  .max(1e10)

/** The next code in a series: `PR-00009` after `PR-00008`. */
export function nextCode(prefix: string, codes: readonly string[], width = 5): string {
  const highest = codes.reduce((max, code) => {
    const number = Number(code.replace(/\D/g, ''))
    return Number.isFinite(number) && number > max ? number : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(width, '0')}`
}
