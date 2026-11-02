import { useRouter } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'

import { CredentialsForm } from '@/features/auth'
import { PRODUCT_LOGO, PRODUCT_NAME } from '@/lib/brand'

import { usePlatformLogin } from '../hooks/use-platform'

/** Sign-in for hRango's own staff. Customers use /login; neither accepts the other's accounts. */
export function PlatformLoginPage() {
  const router = useRouter()
  const login = usePlatformLogin()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10 sm:px-6">
      <img
        src={PRODUCT_LOGO.fullColor}
        alt={PRODUCT_NAME}
        className="h-10 w-auto"
        width={121}
        height={40}
      />
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 sm:p-9">
        <p className="text-sm font-medium text-primary">{PRODUCT_NAME} staff</p>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold text-heading">Sign in</h1>
        <p className="mt-1.5 mb-7 text-sm text-muted-foreground">
          For the {PRODUCT_NAME} team. Company accounts sign in on the normal page.
        </p>
        <CredentialsForm
          signIn={login}
          emailPlaceholder="name@hrango.local"
          onSuccess={() => router.navigate({ to: '/platform', replace: true })}
        />
        <p className="mt-6 flex items-start gap-2 border-t border-border/70 pt-5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-px size-4 shrink-0 text-primary" />
          Forgot your password? Ask a Super Admin to set a new one.
        </p>
      </div>
    </main>
  )
}
