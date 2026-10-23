import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { useFocusOnMount } from './use-focus-on-mount'
import { BackLink, CancelButton, CloseButton, DoneButton, FormError } from './wizard-controls'
import { wz } from './wizard-styles'

interface DetailLayoutProps {
  title: string
  /** Back, Cancel: leave the page without saving. */
  onDiscard: () => void
  onDone: () => void
  /** The red close: closes the whole wizard. */
  onClose: () => void
  error?: string | undefined
  /** Classes for the scrolling body (the statuses page scrolls its own column). */
  bodyClassName?: string
  children: ReactNode
}

/**
 * The layout of "Default Settings for Views / Organizer" and "Edit Statuses": Back at the top
 * left, the centred SemiBold 30 title, the close, and Cancel / Done at the bottom right.
 */
export function DetailLayout({
  title,
  onDiscard,
  onDone,
  onClose,
  error,
  bodyClassName,
  children,
}: DetailLayoutProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true)
  return (
    <>
      <header
        className={cn(
          wz.gutter,
          'grid shrink-0 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 pt-4 sm:grid-cols-[1fr_auto_1fr] sm:pt-[1.8125rem]',
        )}
      >
        <BackLink onClick={onDiscard} className="-ml-3 justify-self-start sm:ml-0" />
        <h2
          ref={headingRef}
          tabIndex={-1}
          className={cn(
            wz.pageTitle,
            'col-span-2 row-start-2 text-center outline-none sm:col-span-1 sm:row-start-1',
          )}
        >
          {title}
        </h2>
        <CloseButton
          label="Close Create Workspace"
          onClick={onClose}
          className="col-start-2 row-start-1 justify-self-end sm:col-start-3"
        />
      </header>
      <div className={cn(wz.body, wz.gutter, 'pt-6 sm:pt-[2.8125rem]', bodyClassName)}>
        {children}
      </div>
      <div className={cn(wz.gutter, 'shrink-0')}>
        <FormError message={error} />
        <div className={wz.footer}>
          <CancelButton onClick={onDiscard} />
          <DoneButton onClick={onDone} />
        </div>
      </div>
    </>
  )
}
