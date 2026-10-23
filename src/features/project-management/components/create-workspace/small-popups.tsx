import { type SyntheticEvent, useId, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

import { CancelButton, CloseButton, DoneButton, FormError } from './wizard-controls'
import { wz } from './wizard-styles'

/** Focus goes back to a given element (the dropdown or row the popup came from). */
const restoreFocus = (target: () => HTMLElement | null) => (event: Event) => {
  const element = target()
  if (!element) return
  event.preventDefault()
  element.focus()
}

interface TemplateNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "New Template" (788:112744) or "Rename" (780:94338). */
  title: string
  /** "Name" or "Status Template Name". */
  label: string
  initialName: string
  /** Why a name cannot be used, or null. */
  validate: (name: string) => string | null
  onSave: (name: string) => void
  returnFocus: () => HTMLElement | null
}

/** The template name popups: 644 wide, #F1F5F9, a name field, Cancel and the green Save. */
export function TemplateNameDialog({
  open,
  onOpenChange,
  returnFocus,
  ...props
}: TemplateNameDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={wz.smallPopupOverlay} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={wz.smallPopup}
          onCloseAutoFocus={restoreFocus(returnFocus)}
        >
          <TemplateNameForm
            {...props}
            onClose={() => {
              onOpenChange(false)
            }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function TemplateNameForm({
  title,
  label,
  initialName,
  validate,
  onSave,
  onClose,
}: Omit<TemplateNameDialogProps, 'open' | 'onOpenChange' | 'returnFocus'> & {
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const problem = validate(name)
    if (problem) {
      setError(problem)
      return
    }
    onSave(name.trim())
    onClose()
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <DialogPrimitive.Title className={cn(wz.title, 'pt-0.5')}>{title}</DialogPrimitive.Title>
        <DialogPrimitive.Close asChild>
          <CloseButton className="-mt-2" />
        </DialogPrimitive.Close>
      </div>
      <label htmlFor={inputId} className={cn(wz.label, 'mt-[0.9375rem]')}>
        {label}
      </label>
      <div className={cn(wz.field, wz.fieldFocus, 'mt-3', error && wz.fieldInvalid)}>
        <input
          id={inputId}
          value={name}
          autoFocus
          maxLength={60}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          placeholder="Enter template name..."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            wz.value,
            'min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#454545]',
          )}
        />
      </div>
      <FormError id={errorId} message={error ?? undefined} />
      <div className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-[3.75rem] sm:gap-[1.5625rem]">
        <CancelButton onClick={onClose} />
        <button type="submit" className={wz.save}>
          Save
        </button>
      </div>
    </form>
  )
}

/** A yes / no question in the template popups' layout (the delete confirmations). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  onConfirm,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  returnFocus: () => HTMLElement | null
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={wz.smallPopupOverlay} />
        <DialogPrimitive.Content
          role="alertdialog"
          className={wz.smallPopup}
          onCloseAutoFocus={restoreFocus(returnFocus)}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className={cn(wz.title, 'pt-0.5')}>
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <CloseButton className="-mt-2" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className={cn(wz.intro, 'mt-4')}>
            {message}
          </DialogPrimitive.Description>
          <div className="mt-8 flex flex-wrap justify-center gap-3 sm:mt-12 sm:gap-[1.5625rem]">
            <DialogPrimitive.Close asChild>
              <CancelButton />
            </DialogPrimitive.Close>
            <DoneButton
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </DoneButton>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
