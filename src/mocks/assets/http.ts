import { HttpResponse } from 'msw'
import { z } from 'zod'

import type { ApiItem, Paginated } from '@/types/api'

import { mockFileUrl } from '../files/handlers'
import { errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'

/*
 * Response helpers for the Assets and Off Boarding mocks, shaped like the backend:
 * 201 on create, 204 on delete, 409 when the rowVersion is stale, errors as
 * {message, code, fieldErrors}.
 */

export const authed = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

export const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    ...(fieldErrors ? { fieldErrors } : {}),
  })

export const notFound = (what: string) =>
  errorResponse(404, `${what} not found`, { code: 'NOT_FOUND' })

export const conflict = (message: string, code = 'CONFLICT', field?: string) =>
  errorResponse(409, message, { code, ...(field ? { fieldErrors: { [field]: message } } : {}) })

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
export const created = <T>(data: T) => HttpResponse.json<ApiItem<T>>({ data }, { status: 201 })
export const noContent = () => new HttpResponse(null, { status: 204 })

export function page<T>(url: URL, items: readonly T[]) {
  const { page: number, pageSize } = readPageParams(url)
  return HttpResponse.json<Paginated<T>>(paginate(items, number, pageSize))
}

export const param = (url: URL, name: string) => {
  const value = url.searchParams.get(name)
  return value === null || value === '' ? undefined : value
}

/** `?q=` matched against some of the row's text (case-insensitive). */
export const matches = (url: URL, ...texts: (string | null | undefined)[]) => {
  const q = (param(url, 'q') ?? '').trim().toLowerCase()
  return !q || texts.some((text) => (text ?? '').toLowerCase().includes(q))
}

export const now = () => new Date().toISOString()

export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date')

/** The next code in a series: `AST-00009` after `AST-00008`. */
export function nextCode(prefix: string, codes: readonly string[], width = 5): string {
  const highest = codes.reduce((max, code) => {
    const number = Number(code.replace(/\D/g, ''))
    return Number.isFinite(number) && number > max ? number : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(width, '0')}`
}

/** A fresh rowVersion, as the database hands out on every write. */
export const nextVersion = () => Math.random().toString(16).slice(2, 18).padEnd(16, '0')

/** 409 when the client's rowVersion is not the record's current one. */
export function stale(
  record: { rowVersion: string },
  sent: string | null | undefined,
  what: string,
) {
  if (!sent) return invalid(`rowVersion is required to edit ${what}.`, { rowVersion: 'Required' })
  if (sent !== record.rowVersion) {
    return conflict(`Someone else changed this ${what}. Reload it and try again`)
  }
  return null
}

/** How a mocked record shows its file: id, name (when the mock knows it) and a link. */
export const fileRef = (fileId: string | null, fileName: string | null) =>
  fileId ? { id: fileId, name: fileName, url: mockFileUrl(fileId) } : null

/** A file id sent with a form: optional, a string or number id. */
export const fileIdSchema = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => (value === null || value === undefined ? null : String(value)))

/** An id sent as a string or a number (the backend takes both). */
export const idSchema = (message: string) =>
  z.union([z.string().min(1, message), z.number()]).transform((value) => String(value))

export const optionalId = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) =>
    value === null || value === undefined || value === '' ? null : String(value),
  )

export const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep it under ${String(max)} characters`)
    .nullish()
    .transform((value) => (value?.trim() ? value.trim() : null))
