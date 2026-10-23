import { type ReactNode, type SubmitEventHandler, useId } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { FieldLayoutContext } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { settingsType } from './type-styles'

interface SettingsFormCardProps {
  /** "Branch Create", "Job Title"… */
  title: string
  description?: ReactNode
  /** The list this form belongs to (back arrow), e.g. `{ label: 'Back to branches', link: { to: … } }`. */
  back?: { label: string; link: LinkProps }
  onSubmit: SubmitEventHandler<HTMLFormElement>
  onCancel: () => void
  isSaving?: boolean
  isLoading?: boolean
  /** Shown instead of the fields when the record could not be loaded. */
  loadError?: Error | null
  onRetry?: () => void
  submitLabel?: string
  children: ReactNode
}

/**
 * A Settings form as drawn: a white card with the title, fields with labels
 * on the left (above them on narrow screens), and Save (green) / Cancel (red)
 * at the bottom right.
 */
export function SettingsFormCard({
  title,
  description,
  back,
  onSubmit,
  onCancel,
  isSaving = false,
  isLoading = false,
  loadError = null,
  onRetry,
  submitLabel = 'Save',
  children,
}: SettingsFormCardProps) {
  const titleId = useId()

  return (
    <Card aria-labelledby={titleId} className={cn('w-full rounded-xl', settingsType.form)}>
      <CardHeader className="justify-start gap-3 pt-6 sm:px-8 sm:pt-7">
        {back && (
          <Button asChild variant="ghost" size="icon-sm" className="-ml-1.5 text-field-foreground">
            <Link {...back.link} aria-label={back.label}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <CardTitle id={titleId} as="h1" className="text-xl font-medium sm:text-xl">
            {title}
          </CardTitle>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </CardHeader>

      {loadError ? (
        <CardContent className="sm:px-8">
          <ErrorState message={loadError.message} onRetry={onRetry} className="shadow-none" />
        </CardContent>
      ) : (
        <form noValidate aria-labelledby={titleId} onSubmit={onSubmit}>
          <FieldLayoutContext value="horizontal">
            <CardContent className="pt-6 sm:px-8 sm:pt-8">
              {isLoading ? (
                <div aria-busy="true" className="grid gap-6">
                  <span className="sr-only">Loading…</span>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <fieldset
                  disabled={isSaving}
                  className="grid min-w-0 gap-5 @xl:gap-6 @[72rem]:grid-cols-2 @[72rem]:gap-x-12"
                >
                  <legend className="sr-only">{title}</legend>
                  {children}
                </fieldset>
              )}
            </CardContent>
          </FieldLayoutContext>
          <CardFooter className="flex-wrap justify-end gap-3 pt-3 pb-7 sm:gap-5 sm:px-8 sm:pb-8">
            <Button
              type="submit"
              variant="success"
              size="lg"
              disabled={isSaving || isLoading}
              className="min-w-24 flex-1 px-5 text-base font-medium @sm:flex-none"
            >
              {isSaving && <Loader2 className="animate-spin" />}
              {isSaving ? 'Saving…' : submitLabel}
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={onCancel}
              disabled={isSaving}
              className="min-w-24 flex-1 px-5 text-base font-medium @sm:flex-none"
            >
              Cancel
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
