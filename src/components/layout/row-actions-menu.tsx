import { type LucideIcon, MoreVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface RowAction {
  label: string
  onSelect: () => void
  icon?: LucideIcon
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface RowActionsMenuProps {
  actions: readonly RowAction[]
  /** Accessible name for the kebab button, e.g. "Actions for Grace Minutes". */
  label?: string
  /** The items' type, as the module's frames draw it (see `rowMenuItemClass`). */
  itemClassName?: string
}

/** Kebab (⋮) button that opens a menu of row actions such as View, Edit, Delete. */
export function RowActionsMenu({
  actions,
  label = 'Row actions',
  itemClassName,
}: RowActionsMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className="text-chip hover:text-field-foreground data-[state=open]:text-field-foreground"
        >
          <MoreVertical className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem] py-2">
        {actions.map(({ label: itemLabel, onSelect, icon: Icon, variant, disabled }) => (
          <DropdownMenuItem
            key={itemLabel}
            variant={variant}
            disabled={disabled}
            onSelect={onSelect}
            className={itemClassName}
          >
            {Icon && <Icon />}
            {itemLabel}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
