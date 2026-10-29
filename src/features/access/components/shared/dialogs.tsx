import { type BaseSyntheticEvent, type ReactNode, useId } from 'react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { FieldLayoutContext } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import {
  cancelButtonClass,
  dialogClass,
  dialogFieldsClass,
  dialogTitleClass,
  saveButtonClass,
} from '../../utils/styles'

/**
 * A popup form in the newer modules' look: the title, the fields, then Cancel and the action.
 * Open while rendered; Escape and Cancel close it. Errors that name no field show under the
 * buttons.
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
  description?: ReactNode
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showClose={false} className={cn(dialogClass, dialogFieldsClass, className)}>
        <div>
          <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
          <DialogDescription className={cn(description ? 'mt-1 text-sm' : 'sr-only')}>
            {description ?? title}
          </DialogDescription>
        </div>
        <FieldLayoutContext value="vertical">
          <form
            id={formId}
            noValidate
            onSubmit={(event) => void onSubmit(event)}
            className="@container grid min-h-0 gap-5 overflow-y-auto pt-6"
          >
            {children}
          </form>
        </FieldLayoutContext>
        <div className="flex flex-wrap items-center gap-4 pt-6">
          <Button
            type="button"
            onClick={onClose}
            className={cn(cancelButtonClass, 'max-sm:min-w-0 max-sm:flex-1')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={saving}
            className={cn(saveButtonClass, 'max-sm:min-w-0 max-sm:flex-1')}
          >
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

/** "Disable Sara Khan’s account?": a named question, Cancel then the named action. */
export function ConfirmAction({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant={destructive ? 'destructive' : 'default'}
      onConfirm={() => {
        onConfirm()
        onClose()
      }}
    />
  )
}
