import type { LucideIcon } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** A round, coloured action button (the Payrolls list: Edit, View, Run, Stop…). */
export function ActionIcon({
  icon: Icon,
  label,
  tooltip,
  colour,
  onClick,
  disabled = false,
  tooltipClassName,
}: {
  icon: LucideIcon
  /** The accessible name: "Run, Head Office (Pakistan-PKR)". */
  label: string
  tooltip: string
  /** Background colour class, e.g. `bg-[#2CBD4D]`. */
  colour: string
  onClick: () => void
  disabled?: boolean
  /** The tooltip's type (default Poppins Regular 14 #FFFFFF, as the Payrolls list draws it). */
  tooltipClassName?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-white transition-opacity outline-none hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 disabled:opacity-40',
            colour,
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent className={cn('text-sm', tooltipClassName)}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
