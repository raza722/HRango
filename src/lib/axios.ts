import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'

import { isApiErrorBody, normalizeError } from './api-error'
import { env } from './env'

interface ApiClientHooks {
  /** Returns the bearer token to attach, or null when signed out. */
  getAccessToken: () => string | null
  /** Called once per 401 response (sign out and go to the login page). */
  onUnauthorized: () => void
}

let hooks: ApiClientHooks = {
  getAccessToken: () => null,
  onUnauthorized: () => undefined,
}

/**
 * Connects the API client to app state without importing stores here.
 * Called once from `src/app/providers.tsx`.
 */
export function configureApiClient(next: ApiClientHooks): void {
  hooks = next
}

const clientConfig = {
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
}

/** Shared axios instance. Feature `api/` modules call this, never `axios` directly. */
export const apiClient = axios.create(clientConfig)

let platformHooks: ApiClientHooks = {
  getAccessToken: () => null,
  onUnauthorized: () => undefined,
}

/** Same as `configureApiClient`, for the session of hRango's own staff. */
export function configurePlatformClient(next: ApiClientHooks): void {
  platformHooks = next
}

/** hRango's own staff (`/platform/*`): their token, and a 401 here never signs a customer out. */
export const platformClient = axios.create(clientConfig)

platformClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = platformHooks.getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

platformClient.interceptors.response.use(undefined, (error: AxiosError) => {
  const apiError = normalizeError(error)
  const isLoginRequest = error.config?.url?.endsWith('/auth/login') ?? false
  if (apiError.isUnauthorized && !isLoginRequest) platformHooks.onUnauthorized()
  return Promise.reject(apiError)
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = hooks.getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

// --- mock API recovery -----------------------------------------------------------------------

type MockApiRecovery = () => Promise<boolean>

let recoverMockApi: MockApiRecovery | null = null

/**
 * Registers how to bring the in-browser mock API back when its service worker has been
 * dropped (`src/mocks/browser.ts` does this on start). A request that reached the host
 * instead of the mock is then retried once after the recovery.
 */
export function setMockApiRecovery(recover: MockApiRecovery | null): void {
  recoverMockApi = recover
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  /** Set on the one retry after a mock recovery, so a request never loops. */
  mockRecovered?: boolean
}

/** A page instead of JSON: the host answered because no mock intercepted the request. */
const looksLikeHtml = (data: unknown): boolean =>
  typeof data === 'string' && /^\s*<(!doctype|html)/i.test(data)

/** The dev server's proxy answering for an API it cannot reach: a gateway error with no API body. */
const isGatewayError = (response: AxiosResponse): boolean =>
  [502, 503, 504].includes(response.status) && !isApiErrorBody(response.data)

/**
 * True when the mock never saw the request: a host 404, an HTML page, or the dev proxy's
 * gateway error (`vite.config.ts` sends `/api` on to the real API when the worker misses it).
 */
function passedThroughMock(response: AxiosResponse): boolean {
  const data: unknown = response.data
  if (looksLikeHtml(data)) return true
  if (isGatewayError(response)) return true
  return response.status === 404 && !isApiErrorBody(data)
}

async function retryAfterRecovery(config: RetriableConfig): Promise<AxiosResponse | null> {
  if (!recoverMockApi || config.mockRecovered) return null
  const recovered = await recoverMockApi()
  if (!recovered) return null
  const retry: RetriableConfig = { ...config, mockRecovered: true }
  return apiClient.request(retry)
}

apiClient.interceptors.response.use(
  async (response) => {
    if (recoverMockApi && passedThroughMock(response)) {
      const retried = await retryAfterRecovery(response.config)
      if (retried) return retried
    }
    return response
  },
  async (error: AxiosError) => {
    if (recoverMockApi && error.response && error.config && passedThroughMock(error.response)) {
      const retried = await retryAfterRecovery(error.config)
      if (retried) return retried
    }
    const apiError = normalizeError(error)
    // The login call itself answers 401 for bad credentials; that is not an expired session.
    const isLoginRequest = error.config?.url?.endsWith('/auth/login') ?? false
    if (apiError.isUnauthorized && !isLoginRequest) hooks.onUnauthorized()
    return Promise.reject(apiError)
  },
)
