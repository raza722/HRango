import type { ReactNode } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import type { ChipMeta } from '../../constants'
import { chipClass, smallText } from './benefit-styles'

/** A status chip (Active: #DCF4ED with #1BC65F text, 5px corners). */
export function Chip({ meta, className }: { meta: ChipMeta; className?: string }) {
  return <span className={cn(chipClass, meta.className, className)}>{meta.label}</span>
}

/** A list that could not be loaded, with Try again. */
export function ListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <ErrorState
      title="This list could not be loaded"
      message={error instanceof ApiError ? error.message : 'Check your connection and try again.'}
      onRetry={onRetry}
      className="mx-4 mt-6 shadow-none sm:mx-8"
    />
  )
}

/**
 * Waits for the pickers' data (plan years, plans, people): a placeholder while it loads, a short
 * error with Try again if it fails, then the content.
 */
export function LookupsGate({
  query,
  children,
}: {
  query: { isPending: boolean; isError: boolean; refetch: () => unknown }
  children: ReactNode
}) {
  if (query.isPending) {
    return (
      <div aria-busy="true" className="grid gap-3.5 @xl:grid-cols-2">
        <span className="sr-only">Loading the plans</span>
        <Skeleton className="h-12 rounded-[6px]" />
        <Skeleton className="h-12 rounded-[6px]" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <p role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
        The plans could not be loaded.
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="font-medium underline outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35"
        >
          Try again
        </button>
      </p>
    )
  }
  return children
}

/** What an empty list shows: a line and, when there is one, the way to add the first record. */
export function EmptyList({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center whitespace-normal">
      <p className={cn(smallText, 'max-w-sm text-sm text-muted-foreground')}>{children}</p>
      {action}
    </div>
  )
}
