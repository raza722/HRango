import type { ComponentType, SVGProps } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

import { PLAN_CATEGORIES } from '../../constants'
import type { PlanCategory } from '../../types/benefits.types'
import {
  AddIcon,
  DentalIcon,
  HsaIcon,
  LifeIcon,
  MedicalIcon,
  OthersIcon,
  RetirementIcon,
  VisionIcon,
} from '../shared/benefit-icons'
import { accent, bodyText, buttonClass } from '../shared/benefit-styles'

const ICONS: Record<PlanCategory, { Icon: ComponentType<SVGProps<SVGSVGElement>>; size: string }> =
  {
    medical: { Icon: MedicalIcon, size: 'h-[1.035rem] w-[1.1875rem]' },
    dental: { Icon: DentalIcon, size: 'h-[1.06rem] w-[1.05rem]' },
    vision: { Icon: VisionIcon, size: 'h-[0.875rem] w-[1.275rem]' },
    retirement: { Icon: RetirementIcon, size: 'h-[1.325rem] w-[0.846rem]' },
    hsa: { Icon: HsaIcon, size: 'h-[1.1875rem] w-[1.0625rem]' },
    life: { Icon: LifeIcon, size: 'h-[1.1125rem] w-[0.827rem]' },
    others: { Icon: OthersIcon, size: 'h-[0.94rem] w-[1.1rem]' },
  }

/**
 * + Add New Plan and its category menu (245px, 10px corners): Medical, Dental, Vision,
 * Retirement, Health Savings Account, Life Insurance, Others. Each opens the Add Plan form.
 */
export function AddPlanMenu() {
  const navigate = useNavigate()
  return (
    <MenuPrimitive.Root modal={false}>
      <MenuPrimitive.Trigger className={cn(buttonClass, accent.bg, 'px-3')}>
        <AddIcon className="size-[0.8125rem]" />
        Add New Plan
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          align="end"
          sideOffset={-24}
          alignOffset={16}
          collisionPadding={8}
          className="z-50 w-[15.3125rem] rounded-[10px] bg-popover px-0 py-[0.6rem] text-popover-foreground shadow-[0_2px_10px_rgba(0,0,0,0.25)] data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {PLAN_CATEGORIES.map((category) => {
            const { Icon, size } = ICONS[category.value]
            return (
              <MenuPrimitive.Item
                key={category.value}
                onSelect={() => {
                  void navigate({ to: '/benefits/plans/new', search: { category: category.value } })
                }}
                className={cn(
                  bodyText,
                  'flex h-11 cursor-default items-center gap-[0.6875rem] px-[0.9375rem] outline-none select-none focus:bg-[#7469E8]/10',
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center text-[#1C1B1F] dark:text-heading">
                  <Icon className={size} />
                </span>
                {category.label}
              </MenuPrimitive.Item>
            )
          })}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}
