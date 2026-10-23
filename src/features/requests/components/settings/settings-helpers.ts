import { useState } from 'react'
import { z } from 'zod'

import type { SearchOption } from '@/features/payroll'
import { cn } from '@/lib/utils'

import {
  FLOW_REQUEST_TYPES,
  flowRequestTypeLabel,
  SETTINGS_REQUEST_TYPE_LABELS,
} from '../../settings.constants'
import { type FlowRequestType, SETTINGS_REQUEST_TYPES } from '../../types/request-settings.types'

/** "Punch Request" … "Work From Home Request", for the Request Types drop-downs. */
export const REQUEST_TYPE_OPTIONS: readonly SearchOption[] = SETTINGS_REQUEST_TYPES.map((type) => ({
  value: type,
  label: SETTINGS_REQUEST_TYPE_LABELS[type],
}))

/** Request Flow's Request Type: each type and its "… Cancel Request". */
export const FLOW_REQUEST_TYPE_OPTIONS: readonly SearchOption[] = FLOW_REQUEST_TYPES.map(
  (type) => ({ value: type, label: flowRequestTypeLabel(type) }),
)

/** Request Flows: the request type in the URL (`?type=`), Punch Request by default. */
export const flowSearchSchema = z.object({
  type: z
    .enum(FLOW_REQUEST_TYPES as readonly [FlowRequestType, ...FlowRequestType[]])
    .default('punch')
    .catch('punch'),
})
export type FlowSearch = z.infer<typeof flowSearchSchema>
export const FLOW_SEARCH_DEFAULTS = { type: 'punch' } as const

/**
 * View dialogs draw their fields as grey boxes, not faded white ones (the
 * disabled drop-downs, date pickers and text areas of the form).
 */
export const viewFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)

/** Ticked rows of a list. */
export function useTicks() {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string, on: boolean) => {
    setTicked((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const clear = () => {
    setTicked(new Set())
  }
  return { ticked, setTicked, toggle, clear }
}
