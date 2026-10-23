import { cn } from '@/lib/utils'

import type { RequestStatus } from '../types/requests.types'
import type { StandardKindConfig } from './standard.types'

/*
 * The colours and type of the newer Requests frames (section 2697:5532),
 * as the Figma text layers are (docs/figma-typography.md, Requests family).
 */

/** Status chips: Poppins Medium 10 in the status colour on a pale fill. */
export const STANDARD_STATUS_META: Record<RequestStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-[#FFF3D9] text-[#EBA51E] dark:bg-amber-500/15 dark:text-amber-300',
  },
  completed: {
    label: 'Approved',
    className: 'bg-[#2CBD4D]/[0.18] text-[#51B969] dark:bg-green-500/15 dark:text-green-400',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-[#FFE3E3] text-[#D83838] dark:bg-red-500/15 dark:text-red-300',
  },
  cancelling: {
    label: 'Cancelling',
    className: 'bg-[#FFEDE0] text-[#F87927] dark:bg-orange-500/15 dark:text-orange-300',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-[#EFE9FE] text-[#8B5CF6] dark:bg-violet-500/15 dark:text-violet-300',
  },
}

export const statusLabel = (
  config: Pick<StandardKindConfig, 'statusLabels'>,
  status: RequestStatus,
) => config.statusLabels?.[status] ?? STANDARD_STATUS_META[status].label

/** Navy, maroon, and the popups' Flow / History / Save / Cancel, as drawn. */
export const standardButton = {
  navy: 'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary',
  maroon: 'bg-[#7E2448] text-white hover:bg-[#7E2448]/90',
  flow: 'bg-[#22C3F3] text-white hover:bg-[#22C3F3]/90',
  history: 'bg-[#F97C2E] text-white hover:bg-[#F97C2E]/90',
  green: 'bg-[#2CBD4D] text-white hover:bg-[#2CBD4D]/90',
  red: 'bg-[#E50141] text-white hover:bg-[#E50141]/90',
} as const

/** The popups' footer buttons: Inter Medium 16. */
export const standardFooterButton =
  'h-10 min-w-24 rounded-[4px] px-5 font-inter text-base font-medium'

/**
 * The lists' table: headers Poppins Medium 11 #303030 on the faint navy band,
 * cells Poppins Regular 12 #707070 (the frames draw 9–12 px; 12 per the
 * readability rule).
 */
export const standardTableClass = cn(
  'text-xs sm:text-xs [&_td]:h-12 [&_td]:px-3 [&_td]:text-grey [&_th]:h-10 [&_th]:bg-sidebar/[0.06] [&_th]:px-3 [&_th]:text-[0.6875rem] [&_th]:font-medium [&_th]:text-title',
  'dark:[&_th]:bg-muted [&_th:first-child]:rounded-l-md [&_th:last-child]:rounded-r-md',
)

/** View draws every box grey, not faded white. */
export const standardReadOnlyClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)
