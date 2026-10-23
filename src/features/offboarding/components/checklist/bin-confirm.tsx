import { Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { btn, footerButton } from '@/features/payroll'
import { cn } from '@/lib/utils'

/** The checklist frames' delete question: the red bin, then green Yes and red No. */
export function BinConfirm({
  open,
  onOpenChange,
  title,
  message = 'Are you sure you want to Delete this?',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** For screen readers; the design shows only the question. */
  title: string
  message?: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm items-center gap-5 px-8 py-7 text-center">
        <Trash2
          aria-hidden="true"
          className="mx-auto size-14 fill-[#E14848]/90 text-[#E14848]"
          strokeWidth={1.75}
        />
        <AlertDialogTitle className="sr-only">{title}</AlertDialogTitle>
        <AlertDialogDescription className="font-inter text-[1.375rem] leading-snug font-normal text-heading">
          {message}
        </AlertDialogDescription>
        <div className="flex justify-center gap-3">
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(footerButton, btn.green, 'min-w-16')}
          >
            Yes
          </AlertDialogAction>
          <AlertDialogCancel
            className={cn(footerButton, btn.red, 'min-w-16 border-0 hover:text-white')}
          >
            No
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
