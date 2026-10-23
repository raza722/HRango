import { useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react'

import { FormField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api-error'
import { isMockApi } from '@/lib/env'

import { DEMO_ACCOUNT } from '../constants'
import { useLogin } from '../hooks/use-auth'
import { type LoginInput, loginSchema } from '../schemas/login.schema'

interface LoginFormProps {
  /** Runs after the session is stored. */
  onSuccess: () => Promise<void> | void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })
  const password = useController({ control: form.control, name: 'password' })
  const serverError = form.formState.errors.root?.server?.message

  const submit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
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

      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        placeholder="name@topedge.tech"
      />

      <FormField label="Password" error={password.fieldState.error?.message}>
        {(a11y) => (
          <div className="relative">
            <Input
              {...a11y}
              ref={password.field.ref}
              name={password.field.name}
              value={password.field.value}
              onChange={password.field.onChange}
              onBlur={password.field.onBlur}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => {
                setShowPassword((value) => !value)
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-label outline-none hover:text-field-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        )}
      </FormField>

      <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-1">
        {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
        Sign in
      </Button>

      {isMockApi && (
        <div className="rounded-md border border-dashed border-input px-4 py-3 text-sm text-muted-foreground">
          <p>
            Mock API is on. Demo account:{' '}
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
