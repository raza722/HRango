import type { ComponentProps, ReactNode } from 'react'
import { DropdownMenu as Menu } from 'radix-ui'

import { cn } from '@/lib/utils'

import { ChevronRightIcon } from './workspace-icons'
import { menuStyles } from './workspace-styles'

/**
 * The List view's menus (task row menu 288:156930, column header menu 1:11452): a white card of
 * bordered rows with purple icons, sub menus opening to the side.
 */
export function PmMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(menuStyles.content, className)}
        {...props}
      />
    </Menu.Portal>
  )
}

export function PmMenuItem({
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.Item> & { icon?: ReactNode }) {
  return (
    <Menu.Item className={cn(menuStyles.item, className)} {...props}>
      {icon && <span className={menuStyles.icon}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Menu.Item>
  )
}

export function PmMenuSub({ children, ...props }: ComponentProps<typeof Menu.Sub>) {
  return <Menu.Sub {...props}>{children}</Menu.Sub>
}

export function PmMenuSubTrigger({
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.SubTrigger> & { icon?: ReactNode }) {
  return (
    <Menu.SubTrigger className={cn(menuStyles.item, className)} {...props}>
      {icon && <span className={menuStyles.icon}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRightIcon className="h-3 w-1.5 shrink-0 text-[#7127EA] dark:text-[#C4ABFF]" />
    </Menu.SubTrigger>
  )
}

export function PmMenuSubContent({
  className,
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof Menu.SubContent>) {
  return (
    <Menu.Portal>
      <Menu.SubContent
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(menuStyles.content, className)}
        {...props}
      />
    </Menu.Portal>
  )
}

/** A choice with a check (Task Type, Sorting Order). */
export function PmMenuCheckItem({
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Menu.CheckboxItem> & { icon?: ReactNode }) {
  return (
    <Menu.CheckboxItem
      className={cn(
        menuStyles.item,
        'data-[state=checked]:bg-[#F0E9FD] dark:data-[state=checked]:bg-[#7127EA]/25',
        className,
      )}
      {...props}
    >
      {icon && <span className={menuStyles.icon}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </Menu.CheckboxItem>
  )
}

export function PmMenuLabel({ className, ...props }: ComponentProps<typeof Menu.Label>) {
  return <Menu.Label className={cn(menuStyles.label, className)} {...props} />
}

export function PmMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn(menuStyles.separator, className)} {...props} />
}

export const PmMenu = Menu.Root
export const PmMenuTrigger = Menu.Trigger
export const PmMenuGroup = Menu.Group
