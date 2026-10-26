import { useState } from 'react'
import { z } from 'zod'

import type { SearchOption } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  FLOW_AUTHORITY_LABELS,
  FLOW_NODE_LABELS,
  FLOW_REQUEST_TYPES,
  flowRequestTypeLabel,
  SETTINGS_REQUEST_TYPE_LABELS,
} from '../../settings.constants'
import {
  FLOW_AUTHORITIES,
  FLOW_NODE_TYPES,
  type FlowRequestType,
  SETTINGS_REQUEST_TYPES,
} from '../../types/request-settings.types'

/** "Punch Request" … "Work From Home Request", for the Request Types drop-downs. */
export const REQUEST_TYPE_OPTIONS: readonly SearchOption[] = SETTINGS_REQUEST_TYPES.map((type) => ({
  value: type,
  label: SETTINGS_REQUEST_TYPE_LABELS[type],
}))

/** Request Flow's Request Type: each type and its "… Cancel Request". */
export const FLOW_REQUEST_TYPE_OPTIONS: readonly SearchOption[] = FLOW_REQUEST_TYPES.map(
  (type) => ({ value: type, label: flowRequestTypeLabel(type) }),
)

/**
 * Request Flows: `?type=` the request type (`leave`, or `leave-cancel` for its
 * cancellation; Punch Request by default), `?tab=` Flows or Authorities, and
 * `?flow=` the flow whose nodes are shown.
 */
export const flowSearchSchema = z.object({
  type: z
    .enum(FLOW_REQUEST_TYPES as readonly [FlowRequestType, ...FlowRequestType[]])
    .default('punch')
    .catch('punch'),
  tab: z.enum(['flows', 'authorities']).default('flows').catch('flows'),
  flow: z.string().max(40).optional().catch(undefined),
})
export type FlowSearch = z.infer<typeof flowSearchSchema>
export const FLOW_SEARCH_DEFAULTS = { type: 'punch', tab: 'flows' } as const

/** Approver kinds for the node editor's "Node". */
export const NODE_OPTIONS = FLOW_NODE_TYPES.map((type) => ({
  value: type,
  label: FLOW_NODE_LABELS[type],
}))

/** Authorities held under Request Settings → Authorities. */
export const AUTHORITY_OPTIONS: readonly SearchOption[] = FLOW_AUTHORITIES.map((authority) => ({
  value: authority,
  label: FLOW_AUTHORITY_LABELS[authority],
}))

/** "Active" / "In Active" as the API's isActive filter. */
export const ACTIVE_OPTIONS: readonly SearchOption[] = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'In Active' },
]

/** Puts an API error's field messages on a react-hook-form form, or its message at the top. */
export function fieldErrorOf<F extends string>(
  error: unknown,
  fields: readonly F[],
): { field: F; message: string } | { field: null; message: string } {
  if (error instanceof ApiError) {
    const field = fields.find((name) => error.fieldErrors[name])
    if (field) return { field, message: error.fieldErrors[field] ?? error.message }
    return { field: null, message: error.message }
  }
  return { field: null, message: 'Something went wrong. Try again.' }
}

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
