import type { ComponentType, ReactNode, SVGProps } from 'react'
import { AlertDialog, Dialog } from 'radix-ui'

import { cn } from '@/lib/utils'

import { CloseIcon } from './mp-icons'
import { accent, dialogButton } from './mp-styles'

const overlayClass =
  'fixed inset-0 z-50 bg-black/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'

const panelClass =
  'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] bg-card text-heading shadow-[0_4px_4px_rgba(0,0,0,0.25)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'

/** Popup titles: Poppins Medium 20/30 #303030. */
const popupTitle = 'text-xl leading-[1.875rem] font-medium text-title'

/**
 * The "Delete Plan Year" / "Delete Budget" popup: title, the design's picture,
 * the question, then Cancel and the purple action.
 */
export function ConfirmPopup({
  open,
  onOpenChange,
  title,
  message,
  icon: Icon,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  confirmLabel: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClass} />
        <AlertDialog.Content
          className={cn(panelClass, 'max-w-[31.5625rem] items-center px-6 py-7')}
        >
          <AlertDialog.Title className={popupTitle}>{title}</AlertDialog.Title>
          <Icon className="mt-4 h-[4.3rem] w-auto text-[#7469E8] dark:text-[#A39BFF]" />
          <AlertDialog.Description className="mt-6 max-w-[20.875rem] text-center text-sm leading-[1.3125rem] font-medium text-[#292929] dark:text-heading">
            {message}
          </AlertDialog.Description>
          <div className="mt-7 flex flex-wrap justify-center gap-3.5">
            <AlertDialog.Cancel className={cn(dialogButton, accent.outline)}>
              Cancel
            </AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={onConfirm}
              className={cn(dialogButton, 'min-w-[9.8125rem]', accent.bg)}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

/**
 * The module's popups (Add Budget Duration, Add Position Title, Employee Position):
 * a white 10px panel, the title on the left, the close cross in the corner.
 */
export function MpDialog({
  title,
  onClose,
  children,
  className,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(panelClass, 'max-w-[33.1875rem]', className)}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8">
            <Dialog.Title className={cn(popupTitle, 'pt-3')}>{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-[#1C1B1F] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 dark:text-heading"
            >
              <CloseIcon className="size-4" />
            </Dialog.Close>
          </div>
          <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-7 sm:px-8">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
