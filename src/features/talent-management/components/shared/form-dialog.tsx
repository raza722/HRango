import { type BaseSyntheticEvent, type ReactNode, useId, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
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
 * A popup form as the profile frames draw them (Add Academic, Add Contract, Add Dependents …):
 * the title, the fields, then Cancel and Save. Open while rendered; Escape and Cancel close it,
 * first asking to discard the changes when the form has any (`dirty`), as Roster and Warning do.
 * Server errors that name no field show under the buttons.
 */
export function FormDialog({
  title,
  description,
  onClose,
  onSubmit,
  saving,
  saveLabel = 'Save',
  rootError,
  dirty = false,
  wide = false,
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
  /** The form has unsaved changes: closing asks first. */
  dirty?: boolean
  /** The Add / Edit Employee form: wider, with a scrolling body. */
  wide?: boolean
  children: ReactNode
}) {
  const formId = useId()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose()
      }}
    >
      <DialogContent
        showClose={false}
        className={cn(wide ? wideDialogClass : dialogClass, dialogFieldsClass)}
      >
        <div className={cn(wide && 'px-6 pt-6')}>
          <DialogTitle className={dialogTitleClass}>{title}</DialogTitle>
          <DialogDescription className="sr-only">{description ?? title}</DialogDescription>
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
          <Button type="button" onClick={requestClose} className={cancelButtonClass}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving} className={saveButtonClass}>
            {saveLabel}
          </Button>
          {rootError && (
            <p role="alert" className="basis-full text-sm text-destructive">
              {rootError}
            </p>
          )}
        </div>
        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={setConfirmDiscard}
          title="Discard your changes?"
          description="This form has changes that are not saved. They will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          variant="destructive"
          onConfirm={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
