import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * White panel. It is a CSS size container (`@container`), so content inside
 * can respond to the card's own width with `@md:` / `@3xl:` variants, which
 * keeps layouts right whether the sidebar is open, collapsed or a drawer.
 */
function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="card"
      className={cn('@container rounded-md bg-card text-card-foreground shadow-xs', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6',
        className,
      )}
      {...props}
    />
  )
}

/** Card heading; `as` sets the level (an `h1` when the card is the page's main title). */
function CardTitle({
  className,
  as: Heading = 'h2',
  ...props
}: ComponentProps<'h2'> & { as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <Heading
      data-slot="card-title"
      className={cn('text-xl leading-tight font-normal text-heading sm:text-2xl', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('ml-auto flex items-center gap-2', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-4 py-5 sm:px-6', className)} {...props} />
}

function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-4 pb-5 sm:px-6', className)}
      {...props}
    />
  )
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
