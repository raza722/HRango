import { type ReactNode, useId } from 'react'
import { ChevronUp } from 'lucide-react'
import { Collapsible } from 'radix-ui'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface CollapsibleCardProps {
  title: ReactNode
  /** Buttons next to the chevron, e.g. "+ Add Form". */
  actions?: ReactNode
  /** Controlled open state; omit `open` for a card that cannot collapse. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  icon?: ReactNode
  /** Heading level of the title; `h1` when the card is the page's main content. */
  titleAs?: 'h1' | 'h2'
  children: ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Card with a title row, optional actions and (when `open` is given) a
 * chevron that collapses the body, as drawn for the Warning Policy and
 * Penalty tables.
 */
export function CollapsibleCard({
  title,
  actions,
  open,
  onOpenChange,
  icon,
  titleAs = 'h2',
  children,
  className,
  contentClassName,
}: CollapsibleCardProps) {
  const titleId = useId()
  const collapsible = open !== undefined

  const header = (
    <CardHeader className="pt-6">
      <div className="flex min-w-0 items-center gap-4">
        {icon}
        <CardTitle id={titleId} as={titleAs} className="break-words">
          {title}
        </CardTitle>
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {actions}
        {collapsible && (
          <Collapsible.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={open ? 'Collapse section' : 'Expand section'}
              className="text-field-foreground"
            >
              <ChevronUp
                className={cn('size-5 transition-transform duration-200', !open && 'rotate-180')}
                strokeWidth={1.75}
              />
            </Button>
          </Collapsible.Trigger>
        )}
      </div>
    </CardHeader>
  )

  if (!collapsible) {
    return (
      <Card aria-labelledby={titleId} className={className}>
        {header}
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    )
  }

  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} asChild>
      <Card aria-labelledby={titleId} className={cn(!open && 'pb-6', className)}>
        {header}
        <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <CardContent className={contentClassName}>{children}</CardContent>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  )
}
