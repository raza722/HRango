import type { ComponentProps } from 'react'
import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Sheet(props: ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

interface SheetContentProps extends ComponentProps<typeof SheetPrimitive.Content> {
  side?: 'left' | 'right'
  showClose?: boolean
  /** Dim the page behind the sheet. Turn off for panels that edit what is behind them. */
  overlay?: boolean
}

function SheetContent({
  className,
  children,
  side = 'left',
  showClose = true,
  overlay = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      {overlay && (
        <SheetPrimitive.Overlay
          data-slot="sheet-overlay"
          className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        />
      )}
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 z-50 flex h-full flex-col shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:animate-in data-[state=open]:duration-300',
          side === 'left' &&
            'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          side === 'right' &&
            'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-md p-1 opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <XIcon className="size-5" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={className} {...props} />
}

function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" className={className} {...props} />
  )
}

export { Sheet, SheetContent, SheetDescription, SheetTitle }
