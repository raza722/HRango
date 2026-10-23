import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  label?: string
}

export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Centred spinner for route-level pending states. */
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} className="[&_svg]:size-8" />
    </div>
  )
}
