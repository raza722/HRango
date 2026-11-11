import type { CSSProperties } from 'react'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'

import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { MAKER_NAME, PRODUCT_LOGO, PRODUCT_NAME } from '@/lib/brand'
import { toSafeRedirect } from '@/lib/utils'

import { LoginForm } from './login-form'
import { LoginShowcase } from './login-showcase'

const routeApi = getRouteApi('/login')

/** Staggered entrance: each block rises a little after the one before. */
const rise = (step: number): CSSProperties => ({ animationDelay: `${String(80 + step * 120)}ms` })

/**
 * The page is always the dark "night" look, whatever theme the app is in: the outer `dark` switches
 * the form's tokens to their dark values, and the page tunes a few of them on the element inside
 * (field fill and border, labels, a deeper violet button with readable white text, a lighter red for
 * errors on navy). They sit one level down because the `.dark` token rule outranks utilities.
 */
const NIGHT_TOKENS =
  '[color-scheme:dark] [--card:#111b2e] [--input:#26344d] [--label:#94a3b8] [--field-foreground:#f8fafc] [--ring:#a78bfa] [--primary:#7c3aed] [--destructive:#f87171] [--muted-foreground:#94a3b8] [&_input:-webkit-autofill]:shadow-[inset_0_0_0_100px_#111b2e] [&_input:-webkit-autofill]:[-webkit-text-fill-color:#f8fafc]'

/** Public sign-in screen. After sign-in it returns to `?redirect=` (same-origin paths only). */
export function LoginPage() {
  const { redirect } = routeApi.useSearch()
  const router = useRouter()

  return (
    <div className="dark">
      <div
        className={`${NIGHT_TOKENS} relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0b1220] text-[#e2e8f0]`}
      >
        <header className="flex items-center justify-between gap-4 px-6 pt-6 sm:px-10 lg:px-14 lg:pt-8">
          <div className="flex items-center gap-3">
            <img
              src={PRODUCT_LOGO.iconColor}
              alt=""
              width={472}
              height={345}
              className="h-8 w-auto"
            />
            <span className="text-2xl font-bold tracking-[-0.01em] text-white">{PRODUCT_NAME}</span>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 pt-2 pb-8 sm:px-10 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-6">
          <section
            className="w-full max-w-[452px] animate-rise self-center motion-reduce:animate-none lg:shrink-0"
            style={rise(1)}
          >
            <p className="text-xs font-semibold tracking-[0.18em] text-[#a78bfa] uppercase">
              Welcome back
            </p>
            <h1 className="mt-3.5 text-[2rem] leading-[1.1] font-semibold tracking-[-0.02em] text-white sm:text-[2.875rem]">
              Sign in to your workspace
            </h1>
            <p className="mt-3.5 mb-7 font-inter text-base leading-relaxed text-[#94a3b8]">
              Use your work email to open {PRODUCT_NAME}.
            </p>
            <LoginForm
              onSuccess={() => {
                router.history.push(toSafeRedirect(redirect))
              }}
            />
            <p className="mt-5 flex items-start gap-3 rounded-xl border border-[#1e2a42] bg-[#0f182a] px-4 py-3.5 font-inter text-[0.8125rem] leading-relaxed text-[#94a3b8]">
              <ShieldCheck aria-hidden="true" className="mt-px size-5 shrink-0 text-[#34d399]" />
              Accounts are set up by your HR team. Forgot your password? Ask your HR administrator
              to set a new one.
            </p>
          </section>

          <LoginShowcase
            className="order-first animate-rise motion-reduce:animate-none lg:order-none lg:flex-1"
            style={rise(0)}
          />
        </main>

        <footer className="px-6 pt-2 pb-8 font-inter text-[0.8125rem] text-[#7c8ba5] sm:px-10 lg:px-14">
          © {new Date().getFullYear()} {PRODUCT_NAME} · Powered by {MAKER_NAME}
        </footer>
      </div>
    </div>
  )
}
