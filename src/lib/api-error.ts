import { isAxiosError } from 'axios'

import type { ApiErrorBody } from '@/types/api'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'cancelled' | 'unknown'

interface ApiErrorInit {
  message: string
  status: number
  kind: ApiErrorKind
  code?: string | undefined
  fieldErrors?: Record<string, string> | undefined
  cause?: unknown
}

/**
 * The single error type the app deals with. Every failed request is turned
 * into an `ApiError` by the axios interceptor, so UI code never inspects raw
 * axios errors. Registered as TanStack Query's `defaultError`.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError'
  /** HTTP status, or 0 when no response was received. */
  readonly status: number
  readonly kind: ApiErrorKind
  /** Machine-readable code from the API body, e.g. `POLICY_DUPLICATE`. */
  readonly code: string | undefined
  /** Server-side validation messages keyed by form field path. */
  readonly fieldErrors: Record<string, string>

  constructor({ message, status, kind, code, fieldErrors, cause }: ApiErrorInit) {
    super(message, { cause })
    this.status = status
    this.kind = kind
    this.code = code
    this.fieldErrors = fieldErrors ?? {}
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  /** 4xx responses are the caller's fault and are not worth retrying. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'The request was not valid.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'The requested record was not found.',
  409: 'This change conflicts with existing data.',
  422: 'Some fields need your attention.',
  500: 'Something went wrong on our side. Please try again.',
}

/** True for the `{ message, code?, fieldErrors? }` body every API error carries. */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  )
}

/** Converts anything thrown by a request into an {@link ApiError}. */
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') {
      return new ApiError({
        message: 'Request cancelled.',
        status: 0,
        kind: 'cancelled',
        cause: error,
      })
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({
        message: 'The server took too long to respond.',
        status: 0,
        kind: 'timeout',
        cause: error,
      })
    }
    if (!error.response) {
      return new ApiError({
        message: 'Cannot reach the server. Check your connection.',
        status: 0,
        kind: 'network',
        cause: error,
      })
    }

    const { status } = error.response
    const data: unknown = error.response.data
    const body = isApiErrorBody(data) ? data : undefined
    return new ApiError({
      message: body?.message ?? FALLBACK_MESSAGES[status] ?? `Request failed (${status}).`,
      status,
      kind: 'http',
      code: body?.code,
      fieldErrors: body?.fieldErrors,
      cause: error,
    })
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message, status: 0, kind: 'unknown', cause: error })
  }
  return new ApiError({ message: 'Unexpected error.', status: 0, kind: 'unknown', cause: error })
}
