import type { ComponentType, SVGProps } from 'react'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

import type { PlanYearAction } from '../../types/benefits.types'
import {
  CalendarClockIcon,
  DeleteIcon,
  EditIcon,
  MoreVertIcon,
  OpenInNewIcon,
  PlusIcon,
} from '../shared/benefit-icons'
import { smallText } from '../shared/benefit-styles'

const GROUPS: readonly (readonly {
  action: PlanYearAction
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  iconClass: string
}[])[] = [
  [
    { action: 'edit', label: 'Edit', Icon: EditIcon, iconClass: 'h-4 w-4' },
    { action: 'delete', label: 'Delete', Icon: DeleteIcon, iconClass: 'h-[1.125rem] w-4' },
  ],
  [
    {
      action: 'open-enrollment',
      label: 'Open Enrollment',
      Icon: OpenInNewIcon,
      iconClass: 'h-4 w-4',
    },
    { action: 'new-hire', label: 'New Hire', Icon: PlusIcon, iconClass: 'h-[0.97rem] w-[0.97rem]' },
    {
      action: 'life-event',
      label: 'Qualifying Life Event',
      Icon: CalendarClockIcon,
      iconClass: 'h-[1.2rem] w-[1.14rem]',
    },
  ],
]

/**
 * The plan year's ⋮ menu (187px, 10px corners): Edit, Delete, a rule, then Open Enrollment,
 * New Hire and Qualifying Life Event, each with its icon.
 */
export function PlanYearRowMenu({
  name,
  allowed,
  onSelect,
}: {
  name: string
  /** The actions the user may take (permissions); the others are left out. */
  allowed: readonly PlanYearAction[]
  onSelect: (action: PlanYearAction) => void
}) {
  const groups = GROUPS.map((group) =>
    group.filter((item) => allowed.includes(item.action)),
  ).filter((group) => group.length > 0)
  if (groups.length === 0) return null
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger
        aria-label={`Actions for ${name}`}
        className="flex size-8 items-center justify-center rounded-md text-[#1C1B1F] outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 data-[state=open]:bg-muted dark:text-heading"
      >
        <MoreVertIcon className="h-[0.91rem] w-[0.19rem]" />
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          align="end"
          sideOffset={2}
          collisionPadding={8}
          className="z-50 w-[11.6875rem] rounded-[10px] bg-popover py-1.5 text-popover-foreground shadow-[0_2px_10px_rgba(0,0,0,0.25)] data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {groups.map((group, index) => (
            <div key={group[0]?.action}>
              {index > 0 && (
                <MenuPrimitive.Separator className="mx-px my-1.5 h-px bg-[#D9D9D9] dark:bg-border" />
              )}
              {group.map(({ action, label, Icon, iconClass }) => (
                <MenuPrimitive.Item
                  key={action}
                  onSelect={() => {
                    onSelect(action)
                  }}
                  className={cn(
                    smallText,
                    'flex h-[2.1875rem] cursor-default items-center gap-[0.6875rem] px-[0.875rem] outline-none select-none focus:bg-[#7469E8]/10 pointer-coarse:h-11',
                  )}
                >
                  <span className="flex w-4 shrink-0 justify-center text-[#1C1B1F] dark:text-heading">
                    <Icon className={iconClass} />
                  </span>
                  {label}
                </MenuPrimitive.Item>
              ))}
            </div>
          ))}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}
