import type { ReactNode } from 'react'

import { FieldLayoutContext } from '@/components/form'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { transferCardClass, transferFieldsClass } from './transfer-styles'

/**
 * The Transfer popups: the request on a white card (title, fields with their
 * labels on the left, buttons at the bottom right) and the Application card
 * beside it. On narrow screens the Application goes under the form.
 */
export function TransferDialogShell({
  title,
  onClose,
  footer,
  aside,
  children,
}: {
  title: string
  onClose: () => void
  footer: ReactNode
  /** The Application card. */
  aside: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showClose={false}
        className="block max-w-[72rem] overflow-y-auto rounded-none bg-transparent p-0 shadow-none"
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,40rem)_minmax(0,1fr)]">
          <div className={cn(transferCardClass, 'grid')}>
            <div className="px-6 pt-6 sm:px-8 sm:pt-8">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="sr-only">{title}</DialogDescription>
            </div>
            <div className={cn('@container px-6 py-6 sm:px-8', transferFieldsClass)}>
              <FieldLayoutContext value="horizontal">{children}</FieldLayoutContext>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 px-6 pb-8 sm:px-8">
              {footer}
            </div>
          </div>
          {aside}
        </div>
      </DialogContent>
    </Dialog>
  )
}
