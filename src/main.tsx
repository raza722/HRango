import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/app'
import { createAppRouter } from '@/app/router'
import { connectApiClientToSession } from '@/app/session'
import { env } from '@/lib/env'
import { queryClient } from '@/lib/query-client'

async function enableMocking(): Promise<void> {
  if (!env.VITE_ENABLE_MOCKS) return
  // Loaded on demand, so a build with mocks off never downloads MSW.
  const { startMockServiceWorker } = await import('@/mocks/browser')
  await startMockServiceWorker()
}

async function bootstrap(): Promise<void> {
  await enableMocking()

  const router = createAppRouter({ queryClient })
  connectApiClientToSession(router, queryClient)

  const container = document.getElementById('root')
  if (!container) throw new Error('Missing #root element in index.html')

  createRoot(container).render(
    <StrictMode>
      <App router={router} queryClient={queryClient} />
    </StrictMode>,
  )
}

void bootstrap()
