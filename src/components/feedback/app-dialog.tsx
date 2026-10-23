import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AppDialogProps {
  title: ReactNode
  /** Shown to screen readers only, when the design has no visible title. */
  hideTitle?: boolean
  description?: ReactNode
  onRequestClose: () => void
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** Overrides the title's type (default: Inter Medium 24, as most dialog frames draw it). */
  titleClassName?: string
}

/**
 * A modal that is open while rendered: a title (optionally for screen
 * readers only), a scrolling body and the buttons at the bottom right.
 */
export function AppDialog({
  title,
  hideTitle = false,
  description,
  onRequestClose,
  footer,
  children,
  className,
  titleClassName,
}: AppDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onRequestClose()
      }}
    >
      <DialogContent className={cn('max-w-5xl', className)}>
        <DialogHeader className={cn('pb-2 sm:pb-3', hideTitle && 'pb-0 sm:pb-0')}>
          <div>
            <DialogTitle className={cn(hideTitle && 'sr-only', titleClassName)}>
              {title}
            </DialogTitle>
            <DialogDescription className={description ? 'mt-1' : 'sr-only'}>
              {description ?? title}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="@container min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-5">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 px-5 pt-2 pb-5 sm:gap-4 sm:px-8 sm:pb-6">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Width and text of the Save / Cancel buttons in a dialog footer (Figma: Inter Medium 16). */
export const dialogButtonClass = 'min-w-24 px-5 font-inter text-base font-medium'
