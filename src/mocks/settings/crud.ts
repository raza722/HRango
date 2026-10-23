import { http, HttpResponse } from 'msw'
import type { z } from 'zod'

import type { ApiItem, Paginated } from '@/types/api'

import type { MockCollection } from '../collection'
import { createId, errorResponse, latency, paginate, readPageParams, requireAuth } from '../utils'

interface CrudOptions<TRecord extends { id: string; name: string }, TInput, TRow> {
  /** Absolute mock path, e.g. `/api/settings/branches`. */
  path: string
  /** Human name for messages, e.g. "branch". */
  label: string
  idPrefix: string
  collection: MockCollection<TRecord>
  schema: z.ZodType<TInput>
  /** Adds display names for list rows. */
  toRow: (record: TRecord) => TRow
  /** Query-string filters, e.g. `companyId`. */
  filterKeys?: readonly (keyof TRecord & string)[]
  /** Business rules beyond the schema (references exist, duplicates…). */
  validate?: (input: TInput, existing: TRecord | undefined) => Response | null
  /** Refuses deletes that would orphan other records. */
  beforeDelete?: (record: TRecord) => Response | null
}

/**
 * Standard REST handlers for a Control Panel list:
 * `GET path?page&pageSize&search&<filters>`, `GET path/:id`, `POST`, `PUT path/:id`, `DELETE path/:id`.
 */
export function createCrudHandlers<
  TRecord extends { id: string; name: string; createdAt: string; updatedAt: string },
  TInput extends object,
  TRow,
>(options: CrudOptions<TRecord, TInput, TRow>) {
  const {
    path,
    label,
    idPrefix,
    collection,
    schema,
    toRow,
    filterKeys = [],
    validate,
    beforeDelete,
  } = options
  const notFound = () => errorResponse(404, `The ${label} was not found.`, { code: 'NOT_FOUND' })

  async function readInput(request: Request) {
    const body: unknown = await request.json().catch(() => null)
    return schema.safeParse(body)
  }

  return [
    http.get(path, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const url = new URL(request.url)
      const { page, pageSize } = readPageParams(url)
      const search = (url.searchParams.get('search') ?? '').trim().toLowerCase()
      const rows = collection
        .all()
        .filter((record) => !search || record.name.toLowerCase().includes(search))
        .filter((record) =>
          filterKeys.every((key) => {
            const wanted = url.searchParams.get(key)
            return !wanted || String(record[key]) === wanted
          }),
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(toRow)
      return HttpResponse.json<Paginated<TRow>>(paginate(rows, page, pageSize))
    }),

    http.get<{ id: string }>(`${path}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const record = collection.find(params.id)
      return record ? HttpResponse.json<ApiItem<TRecord>>({ data: record }) : notFound()
    }),

    http.post(path, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const parsed = await readInput(request)
      if (!parsed.success)
        return errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })
      const refused = validate?.(parsed.data, undefined)
      if (refused) return refused

      const now = new Date().toISOString()
      const record = {
        ...parsed.data,
        id: createId(idPrefix),
        createdAt: now,
        updatedAt: now,
      } as unknown as TRecord
      collection.insert(record)
      return HttpResponse.json<ApiItem<TRecord>>({ data: record }, { status: 201 })
    }),

    http.put<{ id: string }>(`${path}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const existing = collection.find(params.id)
      if (!existing) return notFound()
      const parsed = await readInput(request)
      if (!parsed.success)
        return errorResponse(422, 'Some fields are not valid.', { code: 'VALIDATION_FAILED' })
      const refused = validate?.(parsed.data, existing)
      if (refused) return refused

      const updated: TRecord = { ...existing, ...parsed.data, updatedAt: new Date().toISOString() }
      collection.update(existing.id, updated)
      return HttpResponse.json<ApiItem<TRecord>>({ data: updated })
    }),

    http.delete<{ id: string }>(`${path}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized

      const existing = collection.find(params.id)
      if (!existing) return notFound()
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
  return clash
    ? errorResponse(409, `A ${label} with this name already exists.`, {
        code: 'DUPLICATE_NAME',
        fieldErrors: { name: `Choose a different name for this ${label}` },
      })
    : null
}
