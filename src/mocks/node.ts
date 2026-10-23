import { setupServer } from 'msw/node'

import { handlers } from './handlers'

/** Same handlers as the browser worker, for Vitest (see src/test/setup.ts). */
export const server = setupServer(...handlers)
