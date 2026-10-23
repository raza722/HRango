import { setupWorker } from 'msw/browser'

import { setMockApiRecovery } from '@/lib/axios'
import { env } from '@/lib/env'

import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

function startOptions(): Parameters<typeof worker.start>[0] {
  const apiBase = new URL(env.VITE_API_BASE_URL, window.location.origin)
  return {
    serviceWorker: { url: `${env.BASE_URL}mockServiceWorker.js` },
    quiet: env.PROD,
    onUnhandledFrame({ frame, defaults }) {
      // Only warn about API calls nobody mocked; ignore assets, fonts, HMR.
      const { data } = frame
      const url =
        typeof data === 'object' &&
        data !== null &&
        'request' in data &&
        data.request instanceof Request
          ? data.request.url
          : ''
      if (url.startsWith(apiBase.href)) defaults.warn()
    },
  }
}

/**
 * Starts the service worker before the app renders, so the very first request
 * is already mocked. Requests outside the API base pass through untouched.
 */
export async function startMockServiceWorker(): Promise<void> {
  await worker.start(startOptions())
  setMockApiRecovery(restartMockServiceWorker)
}

let restarting: Promise<boolean> | null = null

/**
 * The browser stops a service worker that has had nothing to do for a while (a tab left
 * in the background throttles the keep-alive ping that normally prevents it), and the
 * worker it starts afresh no longer knows this page, so every API call falls through to
 * the host and fails. Stopping and starting the worker registers the page again; the API
 * client then retries the request that failed. Concurrent callers share one restart.
 */
export function restartMockServiceWorker(): Promise<boolean> {
  restarting ??= (async () => {
    try {
      // `stop()` waits for the worker's reply; a worker that is gone for good never sends it.
      await Promise.race([worker.stop(), new Promise((resolve) => setTimeout(resolve, 2000))])
      await worker.start(startOptions())
      return true
    } catch (error) {
      console.error('[mocks] The mock service worker could not be restarted.', error)
      return false
    } finally {
      restarting = null
    }
  })()
  return restarting
}
