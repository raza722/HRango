import { http, HttpResponse } from 'msw'
import type { z } from 'zod'

import type { ApiItem, Paginated } from '@/types/api'

import type { MockCollection } from '../collection'
import { createId, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'
import { newRowVersion } from './seed'

interface StoredRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

interface CrudOptions<TRecord extends StoredRecord, TInput, TOut> {
  /** Absolute mock path, e.g. `/api/organisation/branches`. */
  path: string
  /** Human name for messages, e.g. "branch". */
  label: string
  idPrefix: string
  collection: MockCollection<TRecord>
  /** The request body, as the API validates it (`rowVersion` is read separately). */
  schema: z.ZodType<TInput>
  /** The answer: the stored record plus the names and counts the API adds. */
  toOut: (record: TRecord) => TOut
  /** Fields a new record gets that the body does not carry (e.g. `companyId`). */
  extra?: () => Partial<TRecord>
  /** Query-string filters (`?locationId=`), matched against the record field of the same name. */
  filterKeys?: readonly (keyof TRecord & string)[]
  /** Business rules beyond the schema (references exist, duplicates…). */
  validate?: (input: TInput, existing: TRecord | undefined) => Response | null
  /** Refuses deletes that would orphan other records. */
  beforeDelete?: (record: TRecord) => Response | null
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** 422 in the API's shape: one message per field, from the first issue on it. */
export function validationFailed(issues: readonly z.core.$ZodIssue[]): Response {
  const fieldErrors: Record<string, string> = {}
  issues.forEach((issue) => {
    const field = String(issue.path[0] ?? '')
    if (field && !(field in fieldErrors)) fieldErrors[field] = issue.message
  })
  return errorResponse(422, 'Some fields need your attention.', {
    code: 'VALIDATION_FAILED',
    fieldErrors,
  })
}

/** 422 for a reference that does not exist or does not fit (`locationId`, `cityId`…). */
export function invalidField(field: string, message: string): Response {
  return errorResponse(422, message, {
    code: 'VALIDATION_FAILED',
    fieldErrors: { [field]: message },
  })
}

/** 409 for a record others still use. */
export function conflict(message: string): Response {
  return errorResponse(409, message, { code: 'CONFLICT' })
}

/**
 * The API's row-version rule for edits and deletes: missing → 422, stale → 409.
 * Returns `null` when the given version is the current one.
 */
export function checkRowVersion(
  given: unknown,
  current: { rowVersion: string },
  label: string,
): Response | null {
  if (typeof given !== 'string' || given === '') {
    return errorResponse(422, 'rowVersion is required.', {
      code: 'VALIDATION_FAILED',
      fieldErrors: { rowVersion: 'Required.' },
    })
  }
  return given === current.rowVersion
    ? null
    : conflict(`Someone else changed this ${label}. Reload it and try again`)
}

/**
 * Standard REST handlers for a Control Panel list, as `/api/organisation/*` serves them:
 * `GET path?page&pageSize&q&<filters>`, `GET path/:id`, `POST` (201), `PUT path/:id` with
 * `rowVersion` in the body, `DELETE path/:id?rowVersion=` (204).
 */
export function createCrudHandlers<TRecord extends StoredRecord, TInput extends object, TOut>(
  options: CrudOptions<TRecord, TInput, TOut>,
) {
  const {
    path,
    label,
    idPrefix,
    collection,
    schema,
    toOut,
    extra,
    filterKeys = [],
    validate,
    beforeDelete,
  } = options
  const notFound = () => errorResponse(404, `${capitalize(label)} not found`, { code: 'NOT_FOUND' })

  async function readBody(request: Request) {
    const body: unknown = await request.json().catch(() => null)
    return { body, parsed: schema.safeParse(body) }
  }

  return [
    http.get(path, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const url = new URL(request.url)
      const { page, pageSize } = readPageParams(url)
      const search = (url.searchParams.get('q') ?? '').trim().toLowerCase()
      const rows = collection
        .all()
        .filter((record) => !search || record.name.toLowerCase().includes(search))
        .filter((record) =>
          filterKeys.every((key) => {
            const wanted = url.searchParams.get(key)
            return !wanted || String(record[key]) === wanted
          }),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(toOut)
      return HttpResponse.json<Paginated<TOut>>(paginate(rows, page, pageSize))
    }),

    http.get<{ id: string }>(`${path}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = collection.find(params.id)
      return record ? HttpResponse.json<ApiItem<TOut>>({ data: toOut(record) }) : notFound()
    }),

    http.post(path, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const { parsed } = await readBody(request)
      if (!parsed.success) return validationFailed(parsed.error.issues)
      const refused = validate?.(parsed.data, undefined)
      if (refused) return refused

      const record = {
        ...extra?.(),
        ...parsed.data,
        id: createId(idPrefix),
        createdAt: new Date().toISOString(),
        updatedAt: null,
        rowVersion: newRowVersion(),
      } as unknown as TRecord
      collection.insert(record)
      return HttpResponse.json<ApiItem<TOut>>({ data: toOut(record) }, { status: 201 })
    }),

    http.put<{ id: string }>(`${path}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const existing = collection.find(params.id)
      if (!existing) return notFound()
      const { body, parsed } = await readBody(request)
      if (!parsed.success) return validationFailed(parsed.error.issues)
      const given = (body as { rowVersion?: unknown } | null)?.rowVersion
      const stale = checkRowVersion(given, existing, label)
      if (stale) return stale
      const refused = validate?.(parsed.data, existing)
      if (refused) return refused

      const updated: TRecord = {
        ...existing,
        ...parsed.data,
        updatedAt: new Date().toISOString(),
        rowVersion: newRowVersion(),
      }
      collection.update(existing.id, updated)
      return HttpResponse.json<ApiItem<TOut>>({ data: toOut(updated) })
    }),

    http.delete<{ id: string }>(`${path}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const existing = collection.find(params.id)
      if (!existing) return notFound()
      const given = new URL(request.url).searchParams.get('rowVersion')
      const stale = checkRowVersion(given, existing, label)
      if (stale) return stale
      const refused = beforeDelete?.(existing)
      if (refused) return refused
      collection.remove(existing.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

/** 409 when another record of the same kind already uses the name (case-insensitive). */
export function duplicateName<T extends { id: string; name: string }>(
  records: readonly T[],
  name: string,
  existing: T | undefined,
  label: string,
  scope?: (record: T) => boolean,
): Response | null {
  const wanted = name.trim().toLowerCase()
  const clash = records.some(
    (record) =>
      record.id !== existing?.id &&
      record.name.toLowerCase() === wanted &&
      (scope ? scope(record) : true),
  )
  if (!clash) return null
  const message = `A ${label} with this name already exists.`
  return errorResponse(409, message, {
    code: `${label.toUpperCase().replace(/\s+/g, '_')}_DUPLICATE`,
    fieldErrors: { name: message },
  })
}
