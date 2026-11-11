import { useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from 'lucide-react'

import { FormField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api-error'
import { env, isMockApi } from '@/lib/env'
import { cn } from '@/lib/utils'

import { DEMO_ACCOUNT } from '../constants'
import { useLogin } from '../hooks/use-auth'
import { type LoginInput, loginSchema } from '../schemas/login.schema'

/** Tall sign-in fields with room for the icon in front. */
const FIELD = 'h-12 rounded-xl pl-11 sm:pl-11 sm:text-[0.9375rem] pointer-coarse:h-12'
const LEADING_ICON =
  'pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-label'

interface LoginFormProps {
  /** Runs after the session is stored. */
  onSuccess: () => unknown
}

interface CredentialsFormProps extends LoginFormProps {
  signIn: (values: LoginInput) => Promise<unknown>
  emailPlaceholder: string
  /** Offers to fill in this account. */
  demoNote?: string
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const login = useLogin()
  return (
    <CredentialsForm
      signIn={login.mutateAsync}
      onSuccess={onSuccess}
      emailPlaceholder="name@topedge.tech"
      // Development builds against the local API have the same demo account (backend dev database).
      demoNote={
        isMockApi || env.DEV ? (isMockApi ? 'Mock API is on.' : 'Development API.') : undefined
      }
    />
  )
}

/** Email and password, with server errors inline. Customer and staff sign-in both use it. */
export function CredentialsForm({
  signIn,
  onSuccess,
  emailPlaceholder,
  demoNote,
}: CredentialsFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })
  const email = useController({ control: form.control, name: 'email' })
  const password = useController({ control: form.control, name: 'password' })
  const serverError = form.formState.errors.root?.server?.message

  const submit = form.handleSubmit(async (values) => {
    try {
      await signIn(values)
    } catch (error) {
      form.setError('root.server', {
        message: error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.',
      })
      return
    }
    await onSuccess()
  })

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5" aria-label="Sign in">
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {serverError}
        </div>
      )}

      <FormField label="Email" error={email.fieldState.error?.message}>
        {(a11y) => (
          <div className="relative">
            <Mail aria-hidden="true" className={LEADING_ICON} />
            <Input
              {...a11y}
              ref={email.field.ref}
              name={email.field.name}
              value={email.field.value}
              onChange={email.field.onChange}
              onBlur={email.field.onBlur}
              type="email"
              autoComplete="username"
              placeholder={emailPlaceholder}
              className={FIELD}
            />
          </div>
        )}
      </FormField>

      <FormField label="Password" error={password.fieldState.error?.message}>
        {(a11y) => (
          <div className="relative">
            <LockKeyhole aria-hidden="true" className={LEADING_ICON} />
            <Input
              {...a11y}
              ref={password.field.ref}
              name={password.field.name}
              value={password.field.value}
              onChange={password.field.onChange}
              onBlur={password.field.onBlur}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className={cn(FIELD, 'pr-12 sm:pr-12')}
            />
            <button
              type="button"
              onClick={() => {
                setShowPassword((value) => !value)
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-label outline-none hover:text-field-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {showPassword ? (
                <EyeOff className="size-[1.125rem]" />
              ) : (
                <Eye className="size-[1.125rem]" />
              )}
            </button>
          </div>
        )}
      </FormField>

      <Button
        type="submit"
        size="lg"
        disabled={form.formState.isSubmitting}
        className="mt-1 h-12 rounded-xl text-[0.9375rem] shadow-[0_12px_32px_-14px_var(--primary)] pointer-coarse:h-12"
      >
        Sign in
        {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
      </Button>

      {demoNote && (
        <div className="rounded-md border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">
          <p>
            {demoNote} Demo account:{' '}
            <span className="font-medium break-all text-field-foreground">
              {DEMO_ACCOUNT.email}
            </span>
          </p>
          <Button
            variant="link"
            className="mt-1 h-auto p-0"
            onClick={() => {
              form.reset({ ...DEMO_ACCOUNT })
            }}
          >
            Fill in the demo account
          </Button>
        </div>
      )}
    </form>
  )
}
