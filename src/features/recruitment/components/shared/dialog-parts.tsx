import { type BaseSyntheticEvent, type ReactNode, useId } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { FieldLayoutContext } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { btn, dialogFieldType, footerButton } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { ListError } from './list-parts'

/**
 * A Recruitment form in the Payroll dialog look (Inter labels above the fields, green Save,
 * red Cancel). Open while rendered; Escape and Cancel close it. A server error that names no
 * field shows beside the buttons.
 */
export function FormDialog({
  title,
  description,
  onClose,
  onSubmit,
  saving,
  saveLabel = 'Save',
  rootError,
  children,
  className,
}: {
  title: string
  description?: string
  onClose: () => void
  /** The form's `handleSubmit(…)`. */
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
  saving: boolean
  saveLabel?: string
  rootError?: string | undefined
  children: ReactNode
  className?: string
}) {
  const formId = useId()
  return (
    <AppDialog
      title={title}
      description={description}
      onRequestClose={onClose}
      className={cn('max-w-3xl', dialogFieldType, className)}
      footer={
        <>
          {rootError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {rootError}
            </p>
          )}
          <Button
            type="submit"
            form={formId}
            disabled={saving}
            className={cn(footerButton, btn.green)}
          >
            {saveLabel}
          </Button>
          <Button type="button" onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="grid gap-5"
        >
          {children}
        </form>
      </FieldLayoutContext>
    </AppDialog>
  )
}

/** Two fields side by side once the dialog is wide enough. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 @xl:grid-cols-2">{children}</div>
}

/**
 * A record's detail popup: its header line, the content (or skeleton / error with retry), and
 * the record's actions at the bottom with Close.
 */
export function DetailDialog({
  title,
  description,
  onClose,
  actions,
  loading,
  error,
  onRetry,
  what,
  children,
}: {
  title: string
  description?: ReactNode
  onClose: () => void
  actions?: ReactNode
  loading: boolean
  error?: unknown
  onRetry?: () => void
  /** "the opening", for the error message. */
  what: string
  children: ReactNode
}) {
  return (
    <AppDialog
      title={title}
      description={description}
      onRequestClose={onClose}
      className="max-w-4xl"
      footer={
        <>
          {actions}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className={cn(footerButton, btn.outline)}
          >
            Close
          </Button>
        </>
      }
    >
      {error ? (
        <ListError error={error} what={what} onRetry={onRetry ?? (() => undefined)} />
      ) : loading ? (
        <div aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading {what}</span>
          <Skeleton className="h-6 w-1/2 bg-muted" />
          <Skeleton className="h-28 w-full bg-muted" />
          <Skeleton className="h-40 w-full bg-muted" />
        </div>
      ) : (
        <div className="grid gap-6">{children}</div>
      )}
    </AppDialog>
  )
}

/** A heading inside a detail popup, with optional buttons on its right. */
export function DetailSection({
  title,
  actions,
  children,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h3 id={id} className="text-sm font-semibold text-heading">
          {title}
        </h3>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

/** Label / value pairs in two or three columns (one on a phone). */
export function FactList({
  facts,
  label,
}: {
  facts: readonly { label: string; value: ReactNode }[]
  label: string
}) {
  return (
    <dl aria-label={label} className="grid gap-x-6 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="grid min-w-0 gap-0.5">
          <dt className="text-xs text-label">{fact.label}</dt>
          <dd className="min-w-0 text-sm break-words text-heading">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Free text (description, cover letter, remarks) with its line breaks. */
export function Prose({ children }: { children: string | null }) {
  if (!children) return <p className="text-sm text-muted-foreground">Nothing written.</p>
  return <p className="text-sm whitespace-pre-line text-heading">{children}</p>
}

/** A small filled button in a detail popup's footer or section (Edit, Publish, Hire …). */
export function ActionButton({
  children,
  onClick,
  tone = 'navy',
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  tone?: keyof typeof btn
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('h-10 rounded-[4px] px-4 font-inter text-sm font-medium', btn[tone])}
    >
      {children}
    </Button>
  )
}
