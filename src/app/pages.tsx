import { use, useEffect } from 'react'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'
import { Compass, Home } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth-store'

import { AuthenticatedLayout } from './layouts/authenticated-layout'
import { InShellContext } from './layouts/in-shell-context'

function NotFoundContent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Compass className="size-8" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium tracking-widest text-primary">404</p>
      <h1 className="text-2xl text-heading">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has moved.
      </p>
      <Button asChild>
        <Link to="/">
          <Home /> Back to dashboard
        </Link>
      </Button>
    </div>
  )
}

/**
 * 404 page, used for unknown URLs and for `throw notFound()` in loaders. Signed in, it is drawn
 * inside the app shell (sidebar and top bar, its `<main>`); signed out, in a `<main>` of its
 * own. The document title is the root route's ("Page not found | hRango", `routes/__root.tsx`).
 */
export function NotFoundPage() {
  const inShell = use(InShellContext)
  const signedIn = useAuthStore(selectIsAuthenticated)
  if (inShell) return <NotFoundContent />
  if (signedIn) {
    return (
      <AuthenticatedLayout>
        <NotFoundContent />
      </AuthenticatedLayout>
    )
  }
  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <NotFoundContent />
    </main>
  )
}

/** Route-level error boundary: retry re-runs loaders and resets failed queries. */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  return (
    <div className="mx-auto w-full max-w-3xl p-4">
      <ErrorState
        message={error instanceof Error ? error.message : 'An unexpected error occurred.'}
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
