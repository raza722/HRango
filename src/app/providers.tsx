import { lazy, type ReactNode, Suspense } from 'react'
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { env } from '@/lib/env'

import { ThemeSync } from './theme-sync'

const ReactQueryDevtools =
  env.DEV && env.VITE_ENABLE_DEVTOOLS
    ? lazy(() =>
        import('@tanstack/react-query-devtools').then((module) => ({
          default: module.ReactQueryDevtools,
        })),
      )
    : null

interface AppProvidersProps {
  queryClient: QueryClient
  children: ReactNode
}

/** Global providers: server state, tooltips, toasts and theme syncing. */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeSync />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
      {ReactQueryDevtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </Suspense>
      )}
    </QueryClientProvider>
  )
}
