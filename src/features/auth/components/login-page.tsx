import { getRouteApi, useRouter } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'

import { MAKER_NAME, PRODUCT_LOGO, PRODUCT_NAME } from '@/lib/brand'
import { toSafeRedirect } from '@/lib/utils'

import { LoginForm } from './login-form'
import { LoginShowcase } from './login-showcase'

const routeApi = getRouteApi('/login')

/** Public sign-in screen. After sign-in it returns to `?redirect=` (same-origin paths only). */
export function LoginPage() {
  const { redirect } = routeApi.useSearch()
  const router = useRouter()

  return (
    // minmax(0,1fr): the column may not grow past the screen to fit long text.
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-background lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <LoginShowcase />

      <main className="relative isolate flex min-w-0 flex-col items-center justify-center gap-6 overflow-hidden px-4 py-10 sm:px-6">
        {/* A soft glow in the brand colour, behind the card. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 -z-10 size-[28rem] rounded-full bg-primary/15 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-32 -z-10 size-[24rem] rounded-full bg-[#14b8a6]/10 blur-[110px]"
        />

        <div className="flex w-full max-w-md animate-rise flex-col items-center gap-2 text-center motion-reduce:animate-none lg:hidden">
          <img
            src={PRODUCT_LOGO.fullColor}
            alt={PRODUCT_NAME}
            className="h-10 w-auto"
            width={121}
            height={40}
          />
          <p className="text-sm text-muted-foreground">
            Attendance, leave, payroll and more, in one place.
          </p>
        </div>

        <div
          className="w-full max-w-md animate-rise rounded-2xl border border-border/60 bg-card p-6 shadow-[0_24px_60px_-30px_rgba(23,38,58,0.35)] motion-reduce:animate-none sm:p-9 dark:shadow-none"
          style={{ animationDelay: '150ms' }}
        >
          <p className="text-sm font-medium text-primary">Welcome back</p>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold text-heading">Sign in</h1>
          <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
            Use your work email to open {PRODUCT_NAME}.
          </p>
          <LoginForm
            onSuccess={() => {
              router.history.push(toSafeRedirect(redirect))
            }}
          />
          <p className="mt-6 flex items-start gap-2 border-t border-border/70 pt-5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-px size-4 shrink-0 text-primary" />
            Accounts are set up by your HR team. Forgot your password? Ask your HR administrator to
            set a new one.
          </p>
        </div>
        <p className="text-xs text-muted-foreground lg:hidden">Powered by {MAKER_NAME}</p>
      </main>
    </div>
  )
}
