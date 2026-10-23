import { TriangleAlert, X } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

import { btn, footerButton } from '../../utils/styles'

/**
 * The designs' confirmations: a red cross (Close this Payroll) or an amber
 * warning (Perform this action?), the question, and green Yes / red No.
 */
export function ConfirmAction({
  open,
  onOpenChange,
  message,
  tone = 'warning',
  title,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
  tone?: 'warning' | 'danger'
  /** For screen readers; the design shows only the message. */
  title?: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm items-center gap-5 px-8 py-7 text-center">
        {tone === 'danger' ? (
          <span
            aria-hidden="true"
            className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#EB3434] text-white"
          >
            <X className="size-7" strokeWidth={3} />
          </span>
        ) : (
          <TriangleAlert
            aria-hidden="true"
            className="mx-auto size-14 fill-[#FFB100] text-white"
            strokeWidth={1.5}
          />
        )}
        <AlertDialogTitle className="sr-only">{title ?? message}</AlertDialogTitle>
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
