import '@testing-library/jest-dom/vitest'

import { createElement } from 'react'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import type { LocationMapProps } from '@/components/map'
import { resetWarningViewPrefs } from '@/features/warning'
import { resetMockDb } from '@/mocks/handlers'
import { server } from '@/mocks/node'
import { resetAuthStore, resetSidebarStore, resetUiStore } from '@/stores'

// Whole-app renders run in parallel across many files; under that load a page can take more
// than Testing Library's default second to appear, so findBy / waitFor wait up to four.
configure({ asyncUtilTimeout: 4000 })

// --- jsdom gaps used by Radix primitives and our hooks -----------------------

const noop = () => undefined

/** Width the tests render at unless they call `setViewportWidth` (a small laptop). */
const DEFAULT_VIEWPORT_WIDTH = 1024

/** Evaluates `(min-width: Npx)` / `(max-width: Npx)` against `window.innerWidth`. */
function evaluateMediaQuery(query: string): boolean {
  const width = window.innerWidth
  const min = /min-width:\s*(\d+)px/.exec(query)
  const max = /max-width:\s*(\d+)px/.exec(query)
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: evaluateMediaQuery(query),
    media: query,
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: DEFAULT_VIEWPORT_WIDTH,
})

class ResizeObserverStub {
  observe = noop
  unobserve = noop
  disconnect = noop
}
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverStub })
}

// jsdom implements none of these; Radix Select and our scroll calls use them.
Object.assign(Element.prototype, {
  scrollIntoView: () => undefined,
  hasPointerCapture: () => false,
  releasePointerCapture: () => undefined,
})
window.scrollTo = () => undefined

// Leaflet needs real layout and tile images; tests get a labelled stand-in.
vi.mock('@/components/map/location-map', () => ({
  default: ({ label = 'Map' }: LocationMapProps) =>
    createElement('div', { role: 'group', 'aria-label': label }),
}))

vi.mock('@/components/map/geo-fence-map', () => ({
  default: ({ label = 'Geo fence map' }: { label?: string }) =>
    createElement('div', { role: 'group', 'aria-label': label }),
}))

// --- mock API ----------------------------------------------------------------

beforeAll(() => {
  // Fail loudly when a test hits an endpoint nobody mocked.
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  cleanup()
  window.innerWidth = DEFAULT_VIEWPORT_WIDTH
  server.resetHandlers()
  resetMockDb()
  localStorage.clear()
  sessionStorage.clear()
  resetAuthStore()
  resetSidebarStore()
  resetUiStore()
  resetWarningViewPrefs()
})

afterAll(() => {
  server.close()
})
