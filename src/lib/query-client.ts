import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ApiError } from './api-error'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
    queryMeta: {
      /** Toast shown when the query fails. Omit to stay silent (show inline state instead). */
      errorMessage?: string
    }
    mutationMeta: {
      /** Toast text on success; omit for no toast. */
      successMessage?: string
      /** Toast text on failure; defaults to the API error message. */
      errorMessage?: string
      /** Skip the global error toast (the caller handles it, e.g. inline field errors). */
      suppressErrorToast?: boolean
    }
  }
}

/**
 * Creates a QueryClient with app-wide defaults. A factory, so tests get a
 * fresh cache per test.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.errorMessage)
          toast.error(query.meta.errorMessage, { description: error.message })
      },
    }),
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage)
      },
      onError: (error, _variables, _onMutateResult, mutation) => {
        if (mutation.meta?.suppressErrorToast || error.kind === 'cancelled') return
        toast.error(mutation.meta?.errorMessage ?? error.message)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Do not retry 4xx answers; retry network/5xx failures twice.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.isClientError) && failureCount < 2,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/** The browser app's single QueryClient instance. */
export const queryClient = createQueryClient()
