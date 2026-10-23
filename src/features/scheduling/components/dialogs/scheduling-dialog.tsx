import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { schedulingType } from '../type-styles'

interface SchedulingDialogProps {
  title?: ReactNode
  /** Screen-reader name when the design shows no title (wizard steps). */
  label?: string
  description?: ReactNode
  /** Two green bars at the top of the wizards: `{ current: 1, total: 2 }`. */
  steps?: { current: number; total: number }
  onRequestClose: () => void
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** `poppins` for the frames drawn in Poppins (Create New Rest Day); `inter` otherwise. */
  appearance?: 'inter' | 'poppins'
  /** Overrides the title's type (default Inter Medium 24 #000). */
  titleClassName?: string
}

/**
 * The Scheduling modals: an optional step indicator, title, a scrolling body
 * and the buttons at the bottom right (Back orange, Save green, Cancel red).
 */
export function SchedulingDialog({
  title,
  label,
  description,
  steps,
  onRequestClose,
  footer,
  children,
  className,
  appearance = 'inter',
  titleClassName,
}: SchedulingDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onRequestClose()
      }}
    >
      <DialogContent
        className={cn('max-w-4xl', appearance === 'inter' && schedulingType.dialog, className)}
      >
        <DialogHeader className="flex-col items-stretch gap-3 pb-2 sm:pb-3">
          {steps && (
            <div
              role="progressbar"
              aria-label="Step"
              aria-valuemin={1}
              aria-valuemax={steps.total}
              aria-valuenow={steps.current}
              aria-valuetext={`Step ${steps.current} of ${steps.total}`}
              className="flex justify-center gap-2"
            >
              {Array.from({ length: steps.total }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1.5 w-12 rounded-full',
                    index < steps.current ? 'bg-success' : 'bg-chip dark:bg-input',
                  )}
                />
              ))}
            </div>
          )}
          <div>
            <DialogTitle className={cn(!title && 'sr-only', titleClassName)}>
              {title ?? label}
            </DialogTitle>
            {description ? (
              <DialogDescription className="mt-1">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{label ?? title}</DialogDescription>
            )}
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

/** Section bar of the second wizard step ("Shift Scheduling", "Time Slot"…). */
export function SectionBar({ children }: { children: ReactNode }) {
  return (
    <h3 className={cn('-mx-5 bg-nav-active px-5 py-2 sm:-mx-8 sm:px-8', schedulingType.section)}>
      {children}
    </h3>
  )
}
