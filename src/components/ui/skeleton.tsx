import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * A loading placeholder. A soft light band sweeps across it (`animate-shimmer` on `::before`);
 * with "reduce motion" the band is hidden and the block stays still.
 */
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0 before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent motion-reduce:before:hidden dark:before:via-white/[0.06]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
