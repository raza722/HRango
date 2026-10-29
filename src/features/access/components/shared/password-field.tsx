import { useId, useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
  useWatch,
} from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'

import { FormField } from '@/components/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { PasswordRules } from './parts'

/**
 * A password input bound to a form field, with Show / Hide and, for a new password, the
 * strength rules ticked as they are met.
 */
export function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  showRules = false,
  autoComplete,
  className,
}: {
  control: Control<T>
  name: FieldPathByValue<T, string>
  label: string
  required?: boolean
  /** List the strength rules under the field (new passwords). */
  showRules?: boolean
  autoComplete: 'new-password' | 'current-password'
  className?: string
}) {
  const { field, fieldState } = useController({ control, name })
  const value = useWatch({ control, name }) as string
  const [shown, setShown] = useState(false)
  const rulesId = useId()
  return (
    <div className={cn('grid min-w-0 content-start gap-2', className)}>
      <FormField label={label} required={required} error={fieldState.error?.message}>
        {(a11y) => (
          <div className="relative">
            <Input
              {...a11y}
              aria-describedby={
                [a11y['aria-describedby'], showRules ? rulesId : undefined]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              ref={field.ref}
              name={field.name}
              type={shown ? 'text' : 'password'}
              autoComplete={autoComplete}
              value={value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              className="pr-11"
            />
            <button
              type="button"
              aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
              aria-pressed={shown}
              onClick={() => {
                setShown((current) => !current)
              }}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-grey outline-none hover:text-heading focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {shown ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        )}
      </FormField>
      {showRules && <PasswordRules value={value} id={rulesId} />}
    </div>
  )
}
