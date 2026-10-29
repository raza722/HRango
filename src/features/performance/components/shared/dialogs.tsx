import { type BaseSyntheticEvent, type ReactNode, useId } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import {
  cancelButtonClass,
  dialogClass,
  dialogFieldsClass,
  dialogTitleClass,
  saveButtonClass,
  wideDialogClass,
} from '../../utils/styles'

/**
 * A popup form in the newer modules' look: the title, the fields, then Cancel and Save. Open
 * while rendered; Escape and Cancel close it. Errors that name no field show under the buttons.
 */
export function FormDialog({
  title,
  description,
  onClose,
  onSubmit,
  saving,
  saveLabel = 'Save',
  rootError,
  wide = false,
  extraActions,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  /** The form's `handleSubmit(…)`. */
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>
  saving: boolean
  saveLabel?: string
  rootError?: string | undefined
  wide?: boolean
  /** More buttons between Cancel and Save. */
  extraActions?: ReactNode
  children: ReactNode
}) {
  const formId = useId()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showClose={false}
        className={cn(wide ? wideDialogClass : dialogClass, dialogFieldsClass)}
      >
        <div className={cn(wide && 'px-6 pt-6')}>
          <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
          <DialogDescription className={cn(description ? 'mt-1 text-sm' : 'sr-only')}>
            {description ?? title}
          </DialogDescription>
        </div>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className={cn('@container grid min-h-0 gap-5 overflow-y-auto pt-6', wide && 'px-6 pb-2')}
        >
          {children}
        </form>
        <div className={cn('flex flex-wrap items-center gap-4 pt-6', wide && 'px-6 pb-6')}>
          <Button type="button" onClick={onClose} className={cancelButtonClass}>
            Cancel
          </Button>
          {extraActions}
          <Button type="submit" form={formId} disabled={saving} className={saveButtonClass}>
            {saveLabel}
          </Button>
          {rootError && (
            <p role="alert" className="basis-full text-sm text-destructive">
              {rootError}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A read-only popup (goal and cycle details): title, content, and its own buttons. */
export function ViewDialog({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showClose={false} className={cn(wideDialogClass, dialogFieldsClass)}>
        <div className="px-6 pt-6">
          <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
          <DialogDescription className={cn(description ? 'mt-1 text-sm' : 'sr-only')}>
            {description ?? title}
          </DialogDescription>
        </div>
        <div className="@container grid min-h-0 gap-5 overflow-y-auto px-6 pt-5 pb-2">
          {children}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-6 pt-4 pb-6">
          <Button type="button" onClick={onClose} className={cancelButtonClass}>
            Close
          </Button>
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The Filters popup of the lists: the caller's fields (on a draft it holds), then Cancel,
 * Apply (puts them in the URL) and Reset (clears them).
 */
export function FiltersDialog({
  onApply,
  onReset,
  onClose,
  children,
}: {
  onApply: () => void
  onReset: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showClose={false} className={cn(dialogClass, dialogFieldsClass)}>
        <DialogTitle className={dialogTitleClass}>Filters</DialogTitle>
        <DialogDescription className="sr-only">Choose what the list shows.</DialogDescription>
        <div className="@container grid min-h-0 gap-4 overflow-y-auto pt-6 sm:grid-cols-2">
          {children}
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-6">
          <Button type="button" onClick={onClose} className={cancelButtonClass}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply()
              onClose()
            }}
            className={saveButtonClass}
          >
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onReset()
              onClose()
            }}
            className="h-12 rounded-lg px-7 text-[0.9375rem] font-medium"
          >
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
