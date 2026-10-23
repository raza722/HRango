import { Loader2, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface TrashConfirmDialogProps {
  open: boolean
  message: string
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** The red-bin confirmation from the designs, with Yes (green) and No (red). */
export function TrashConfirmDialog({
  open,
  message,
  pending = false,
  onConfirm,
  onCancel,
}: TrashConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel()
      }}
    >
      <AlertDialogContent className="max-w-sm items-center text-center font-inter">
        <Trash2
          aria-hidden="true"
          className="mx-auto size-14 text-destructive"
          strokeWidth={1.75}
        />
        <AlertDialogTitle className="sr-only">Delete schedule</AlertDialogTitle>
        {/* Figma: "Are you sure you want …" Inter Regular 22 #000; Yes / No Inter Medium 16. */}
        <AlertDialogDescription className="text-lg leading-snug text-heading sm:text-[1.375rem]">
          {message}
        </AlertDialogDescription>
        <div className="flex justify-center gap-4 pt-2">
          <Button
            variant="success"
            size="lg"
            disabled={pending}
            onClick={onConfirm}
            className="min-w-20 text-base font-medium"
          >
            {pending && <Loader2 className="animate-spin" />}
            Yes
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={pending}
            onClick={onCancel}
            className="min-w-20 text-base font-medium"
          >
            No
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
