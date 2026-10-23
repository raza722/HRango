import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface RosterDialogShellProps {
  title: ReactNode
  description?: ReactNode
  /** Called for ×, Escape and a click outside; the caller decides whether to close. */
  onRequestClose: () => void
  /** Buttons at the bottom right. */
  footer?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * The Roster modals as drawn: a wide white panel, the title (Inter Medium 20 #303030) with a
 * rule under it, a scrolling body and the buttons at the bottom right.
 */
export function RosterDialogShell({
  title,
  description,
  onRequestClose,
  footer,
  children,
  className,
}: RosterDialogShellProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onRequestClose()
      }}
    >
      <DialogContent className={cn('max-w-5xl font-inter', className)}>
        <DialogHeader className="border-b pb-4 sm:pt-6 sm:pb-5">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-medium text-title sm:text-xl">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="mt-1 text-base font-medium text-title">
                {description}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
        </DialogHeader>
        <div className="@container min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 border-t px-5 py-4 sm:gap-5 sm:px-8">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
