import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  action?: ReactNode
  className?: string
}

/** Inline error panel with an optional retry button. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-md bg-card px-6 py-10 text-center shadow-xs',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg text-heading">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RotateCw /> Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  )
}
