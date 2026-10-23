import { ConfirmDialog } from './confirm-dialog'

interface UnsavedChangesDialogProps {
  /** From `useUnsavedChangesGuard`. */
  guard: { isBlocked: boolean; proceed: () => void; stay: () => void }
}

/** "Discard your changes?" shown when leaving a form with unsaved edits. */
export function UnsavedChangesDialog({ guard }: UnsavedChangesDialogProps) {
  return (
    <ConfirmDialog
      open={guard.isBlocked}
      onOpenChange={(open) => {
        if (!open) guard.stay()
      }}
      title="Discard your changes?"
      description="This form has changes that are not saved. They will be lost if you leave."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      variant="destructive"
      onConfirm={guard.proceed}
    />
  )
}
