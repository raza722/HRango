import type { ComponentType, SVGProps } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { MoreVertIcon } from './mp-icons'

export interface RowMenuItem {
  label: string
  onSelect: () => void
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  disabled?: boolean
}

/**
 * The rows' ⋮ menu as drawn: a white 5px card with a soft shadow, items in
 * Poppins Medium 14 #292929 with their icons. Opens from the keyboard too.
 */
export function RowMenu({ label, items }: { label: string; items: readonly RowMenuItem[] }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        className="inline-flex size-8 items-center justify-center rounded-md text-[#1C1B1F] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 data-[state=open]:bg-muted dark:text-heading"
      >
        <MoreVertIcon className="h-[0.91rem] w-[0.1875rem]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[8.8125rem] rounded-[5px] py-3 shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
      >
        {items.map(({ label: itemLabel, onSelect, icon: Icon, disabled }) => (
          <DropdownMenuItem
            key={itemLabel}
            disabled={disabled}
            onSelect={onSelect}
            className={cn(
              'gap-4 px-4 py-2 text-sm font-medium text-[#292929] dark:text-heading [&_svg]:text-[#1C1B1F] dark:[&_svg]:text-heading',
            )}
          >
            <span aria-hidden="true" className="flex w-5 justify-center">
              {Icon && <Icon className="h-[1.1rem] w-auto" />}
            </span>
            {itemLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
