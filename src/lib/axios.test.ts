import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/mocks/node'

import { ApiError } from './api-error'
import { apiClient, setMockApiRecovery } from './axios'

/** The host's answer when no mock intercepts a request: a 404 page, not an API body. */
const hostNotFound = () =>
  HttpResponse.text('<!doctype html><title>404 Not Found</title>', { status: 404 })

describe('mock API recovery', () => {
  afterEach(() => {
    setMockApiRecovery(null)
  })

  it('restarts the mock once and retries a request the host answered', async () => {
    const recover = vi.fn(() => Promise.resolve(true))
    setMockApiRecovery(recover)
    server.use(
      http.get('/api/ping', hostNotFound, { once: true }),
      http.get('/api/ping', () => HttpResponse.json({ ok: true })),
    )

    await expect(apiClient.get('/ping')).resolves.toMatchObject({ data: { ok: true } })
    expect(recover).toHaveBeenCalledTimes(1)
  })

  it('retries when the host serves the app page for an API path', async () => {
    const recover = vi.fn(() => Promise.resolve(true))
    setMockApiRecovery(recover)
    server.use(
      http.get('/api/ping', () => HttpResponse.text('<!doctype html><html></html>'), {
        once: true,
      }),
      http.get('/api/ping', () => HttpResponse.json({ ok: true })),
    )

    await expect(apiClient.get('/ping')).resolves.toMatchObject({ data: { ok: true } })
    expect(recover).toHaveBeenCalledTimes(1)
  })

  it('gives up after one retry', async () => {
    const recover = vi.fn(() => Promise.resolve(true))
    setMockApiRecovery(recover)
    server.use(http.get('/api/ping', hostNotFound))

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ status: 404 })
    expect(recover).toHaveBeenCalledTimes(1)
  })

  it('leaves a real 404 from the mock alone', async () => {
    const recover = vi.fn(() => Promise.resolve(true))
    setMockApiRecovery(recover)
    server.use(
      http.get('/api/ping', () =>
        HttpResponse.json({ message: 'No such ping.', code: 'PING_NOT_FOUND' }, { status: 404 }),
      ),
    )

    const error = await apiClient.get('/ping').catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'PING_NOT_FOUND' })
    expect(recover).not.toHaveBeenCalled()
  })

  it('does nothing without a registered recovery', async () => {
    server.use(http.get('/api/ping', hostNotFound))

    await expect(apiClient.get('/ping')).rejects.toMatchObject({ status: 404 })
  })
})
