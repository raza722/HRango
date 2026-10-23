import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  CanceledError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { describe, expect, it } from 'vitest'

import { ApiError, normalizeError } from './api-error'

const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders(), url: '/warning-policies' }

function httpError(status: number, data: unknown): AxiosError {
  const response: AxiosResponse = {
    status,
    statusText: '',
    data,
    headers: {},
    config,
  }
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response)
}

describe('normalizeError', () => {
  it('keeps the API message, code and field errors', () => {
    const error = normalizeError(
      httpError(409, {
        message: 'A policy with this title already exists.',
        code: 'POLICY_DUPLICATE',
        fieldErrors: { title: 'Choose a different title' },
      }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      kind: 'http',
      code: 'POLICY_DUPLICATE',
      message: 'A policy with this title already exists.',
      fieldErrors: { title: 'Choose a different title' },
    })
    expect(error.isClientError).toBe(true)
  })

  it('falls back to a friendly message when the body has none', () => {
    const error = normalizeError(httpError(500, '<html>oops</html>'))
    expect(error.message).toBe('Something went wrong on our side. Please try again.')
    expect(error.isClientError).toBe(false)
  })

  it('classifies network failures, timeouts and cancellations', () => {
    expect(normalizeError(new AxiosError('Network Error', 'ERR_NETWORK', config)).kind).toBe(
      'network',
    )
    expect(normalizeError(new AxiosError('timeout', 'ECONNABORTED', config)).kind).toBe('timeout')
    expect(normalizeError(new CanceledError()).kind).toBe('cancelled')
  })

  it('wraps plain errors and passes ApiErrors through', () => {
    const existing = new ApiError({ message: 'x', status: 404, kind: 'http' })
    expect(normalizeError(existing)).toBe(existing)
    expect(normalizeError(new Error('boom'))).toMatchObject({ kind: 'unknown', message: 'boom' })
  })
})
