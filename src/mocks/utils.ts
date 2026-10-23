import { delay, HttpResponse } from 'msw'

import { env } from '@/lib/env'
import type { ApiErrorBody, Paginated } from '@/types/api'

/** Absolute mock path under the configured API base, e.g. `/api/warning-policies`. */
export function apiPath(path: string): string {
  return `${env.VITE_API_BASE_URL.replace(/\/$/, '')}${path}`
}

/** Simulated network latency (`VITE_MOCK_LATENCY_MS`, 0 in tests). */
export async function latency(): Promise<void> {
  if (env.VITE_MOCK_LATENCY_MS > 0) await delay(env.VITE_MOCK_LATENCY_MS)
}

/**
 * JSON error in the API's standard shape. Typed as a plain `Response` so a
 * handler's success body type is inferred from its `HttpResponse.json` call.
 */
export function errorResponse(
  status: number,
  message: string,
  extra: Omit<ApiErrorBody, 'message'> = {},
): Response {
  return HttpResponse.json<ApiErrorBody>({ message, ...extra }, { status })
}

/** Token issued by the mock login handler. */
export const MOCK_TOKEN_PREFIX = 'mock-token.'

/** Returns a 401 response unless the request carries a mock bearer token. */
export function requireAuth(request: Request): Response | null {
  const header = request.headers.get('Authorization') ?? ''
  if (!header.startsWith(`Bearer ${MOCK_TOKEN_PREFIX}`)) {
    return errorResponse(401, 'Your session has expired. Please sign in again.', {
      code: 'UNAUTHENTICATED',
    })
  }
  return null
}

/** Reads `page` / `pageSize` from the query string with safe bounds. */
export function readPageParams(url: URL): { page: number; pageSize: number } {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '10', 10) || 10),
  )
  return { page, pageSize }
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paginated<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    meta: { page, pageSize, total, totalPages },
  }
}

/** Short random id with a readable prefix: `wp_k3j9x2`. */
export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Random hex string for mock tokens. Uses `crypto.getRandomValues`, which,
 * unlike `crypto.randomUUID`, also works on plain-HTTP origins such as
 * `http://192.168.x.x:5190` (non-secure contexts).
 */
export function randomHex(bytes = 16): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('')
}
