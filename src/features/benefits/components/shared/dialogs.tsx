import type { ReactNode } from 'react'
import { AlertDialog as AlertDialogPrimitive, Dialog as DialogPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

import { CloseIcon, DeleteIllustration } from './benefit-icons'
import { accent, buttonClass, dialogTitleText, mediumText } from './benefit-styles'

const overlayClass =
  'fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'

const panelClass =
  'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[10px] bg-card text-card-foreground shadow-[0_4px_4px_rgba(0,0,0,0.25)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'

/**
 * The Benefits popups (Edit Plan Year 783px, New Open Enrollment Window 983px): white, 10px
 * corners, the title (Poppins Medium 20 #303030) and the close cross at the top right. The body
 * scrolls when the window is short.
 */
export function BxDialog({
  title,
  description,
  onClose,
  children,
  className,
}: {
  title: ReactNode
  /** For screen readers: what the step asks. */
  description: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content className={cn(panelClass, 'max-w-[48.9375rem]', className)}>
          <div className="flex items-start justify-between gap-4 px-4 pt-5 sm:px-[1.375rem] sm:pt-[1.8rem]">
            <DialogPrimitive.Title className={dialogTitleText}>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mt-3 -mr-1 flex size-[2.125rem] shrink-0 items-center justify-center rounded-md text-[#1C1B1F] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 sm:-mt-[1.1rem] sm:-mr-0.5 dark:text-heading"
            >
              <CloseIcon className="size-[1.125rem]" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * The "Delete Plan Year" popup: 505px, title, the calendar-with-cross drawing, the question in
 * Poppins Medium 14 #292929, then Cancel (outlined) and the purple delete button.
 */
export function DeleteConfirm({
  open,
  title,
  question,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  question: ReactNode
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <AlertDialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={overlayClass} />
        <AlertDialogPrimitive.Content
          className={cn(panelClass, 'max-w-[31.5625rem] items-center px-6 pt-7 pb-9 text-center')}
        >
          <AlertDialogPrimitive.Title className={cn(dialogTitleText, 'text-center')}>
            {title}
          </AlertDialogPrimitive.Title>
          <DeleteIllustration className="mt-4 h-[4.3rem] w-[4.1rem] text-[#7469E8]" />
          <AlertDialogPrimitive.Description
            className={cn(mediumText, 'mt-6 max-w-[20.875rem] text-[#292929] dark:text-heading')}
          >
            {question}
          </AlertDialogPrimitive.Description>
          <div className="mt-7 flex w-full flex-wrap justify-center gap-3.5">
            <AlertDialogPrimitive.Cancel
              className={cn(buttonClass, accent.outline, 'min-w-[8.4375rem]')}
            >
              Cancel
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                onConfirm()
              }}
              className={cn(buttonClass, accent.bg, 'min-w-[9.8125rem]')}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
