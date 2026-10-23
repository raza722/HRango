import { getRouteApi, useRouter } from '@tanstack/react-router'

import logoUrl from '@/assets/brand/logo-top-edge.svg'
import { APP_NAME, COMPANY_NAME } from '@/lib/constants'
import { toSafeRedirect } from '@/lib/utils'

import { LoginForm } from './login-form'

const routeApi = getRouteApi('/login')

/** Public sign-in screen. After sign-in it returns to `?redirect=` (same-origin paths only). */
export function LoginPage() {
  const { redirect } = routeApi.useSearch()
  const router = useRouter()

  return (
    // minmax(0,1fr): the column may not grow past the screen to fit long text.
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <img src={logoUrl} alt={COMPANY_NAME} className="h-12 w-auto self-start" />
        <div className="max-w-md">
          <h1 className="text-3xl leading-snug font-medium">People operations, in one place.</h1>
          <p className="mt-4 text-sidebar-subtle">
            Recruitment, attendance, payroll, performance and warnings for every Top Edge
            Technologies team.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">
          © {new Date().getFullYear()} {COMPANY_NAME}
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-primary/20 blur-3xl"
        />
      </aside>

      <main className="flex min-w-0 flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
        <div className="flex w-full max-w-md justify-center rounded-md bg-sidebar py-4 lg:hidden">
          <img src={logoUrl} alt={COMPANY_NAME} className="h-10 w-auto" />
        </div>
        <div className="w-full max-w-md rounded-md bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl text-heading">Sign in</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">to {APP_NAME}</p>
          <LoginForm
            onSuccess={() => {
              router.history.push(toSafeRedirect(redirect))
            }}
          />
        </div>
      </main>
    </div>
  )
}
