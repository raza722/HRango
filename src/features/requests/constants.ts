import type { ComponentType, SVGProps } from 'react'

import {
  ExpenseRequestIcon,
  LeaveRequestIcon,
  LoanRequestIcon,
  OfficialVisitRequestIcon,
  PromotionRequestIcon,
  PunchRequestIcon,
  RelaxationRequestIcon,
  RequestSettingsIcon,
  ResignationRequestIcon,
  RestDayRequestIcon,
  ShiftRequestIcon,
  TravelRequestIcon,
  WorkFromHomeRequestIcon,
} from '@/components/icons/request-icons'

import type {
  ApprovalView,
  PunchRequestType,
  RequestAction,
  RequestKind,
  RequestStatus,
} from './types/requests.types'

export interface RequestMenuItem {
  /** URL segment: `/requests/<slug>`. */
  slug: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Built request type, or a placeholder until designed. */
  kind: RequestKind | null
  /** What the design has for the type, shown on its placeholder. */
  planned?: string
  /** Pages under the item (Settings): `/requests/<slug>/<child slug>`. */
  children?: readonly { slug: string; label: string }[]
}

/** The Requests sub menu, in the design's order (icons from Figma). */
export const REQUEST_MENU: readonly RequestMenuItem[] = [
  { slug: 'punch', label: 'Punch', icon: PunchRequestIcon, kind: 'punch' },
  {
    slug: 'expense',
    label: 'Expense',
    icon: ExpenseRequestIcon,
    kind: null,
    planned: 'Expense claims: several claims sent together, each with its receipt.',
  },
  {
    slug: 'leave',
    label: 'Leave',
    icon: LeaveRequestIcon,
    kind: null,
    planned: 'Leave type, dates, short leave, balance card, attachment and reason.',
  },
  { slug: 'shift', label: 'Shift Requests', icon: ShiftRequestIcon, kind: 'shift' },
  {
    slug: 'loan-advances',
    label: 'Loan & Advances',
    icon: LoanRequestIcon,
    kind: null,
    planned: 'Type, category, amount, required date, guarantors and repayment.',
  },
  {
    slug: 'work-from-home',
    label: 'Work From Home',
    icon: WorkFromHomeRequestIcon,
    kind: null,
    planned: 'Dates with the shifts of each day, reason and bulk approval.',
  },
  {
    slug: 'official-visits',
    label: 'Official Visits',
    icon: OfficialVisitRequestIcon,
    kind: null,
    planned: 'Visit details with requests, approvals, delegates and consents.',
  },
  {
    slug: 'promotion',
    label: 'Promotion',
    icon: PromotionRequestIcon,
    kind: null,
    planned: 'Grade, level, designation, job title, salary and effective date.',
  },
  {
    slug: 'relaxation',
    label: 'Relaxation',
    icon: RelaxationRequestIcon,
    kind: null,
    planned: 'Date, start and end time and reason, against the day’s time slot.',
  },
  {
    slug: 'rest-days',
    label: 'Rest Days',
    icon: RestDayRequestIcon,
    kind: null,
    planned: 'Roster, dates, selected days, payable and reason.',
  },
  {
    slug: 'travel',
    label: 'Travel',
    icon: TravelRequestIcon,
    kind: null,
    planned: 'Purpose, advances, travel details, hotel and ticket bookings.',
  },
  // Not drawn in the Requests menu; the API has the type (Figma App Version: Air Tickets).
  {
    slug: 'air-tickets',
    label: 'Air Tickets',
    icon: TravelRequestIcon,
    kind: null,
    planned: 'Title, claim and travel dates, from / to, amount and the ticket.',
  },
  // The design gives Transfer the Travel icon.
  { slug: 'transfer', label: 'Transfer', icon: TravelRequestIcon, kind: 'transfer' },
  {
    slug: 'resignation',
    label: 'Resignation',
    icon: ResignationRequestIcon,
    kind: null,
    planned: 'Type, resignation and last working dates, notice period and reason.',
  },
  // Not drawn; the API has the type (Request Flows lists "Requisition").
  {
    slug: 'requisition',
    label: 'Requisition',
    icon: ExpenseRequestIcon,
    kind: null,
    planned: 'Title, type, needed-by date, items and justification.',
  },
  {
    slug: 'settings',
    label: 'Settings',
    icon: RequestSettingsIcon,
    kind: null,
    children: [
      { slug: 'restrictions', label: 'Request Restriction' },
      { slug: 'delegation', label: 'Delegation' },
      { slug: 'flows', label: 'Request Flows' },
    ],
  },
]

export const KIND_LABELS: Record<RequestKind, { title: string; list: string; approvals: string }> =
  {
    punch: { title: 'Punch Request', list: 'Punch Request', approvals: 'Punch Approval' },
    shift: { title: 'Shift Request', list: 'Shift Requests', approvals: 'Shift Approval' },
    transfer: {
      title: 'Transfer Request',
      list: 'Transfer Request',
      approvals: 'Transfer Approvals',
    },
  }

/**
 * Status chips: pale background, the text in the Figma status colour (Pending
 * #EBA51E, Completed #2CBD4D, Rejected #D83838, Cancelling #F87927,
 * Cancelled #8B5CF6).
 */
export const STATUS_META: Record<RequestStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-[#FFF3D9] text-[#EBA51E] dark:bg-amber-500/15 dark:text-amber-300',
  },
  completed: {
    label: 'Completed',
    className: 'bg-[#D7F5DF] text-[#2CBD4D] dark:bg-green-500/15 dark:text-green-400',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-[#D83838] dark:bg-red-500/20 dark:text-red-300',
  },
  cancelling: {
    label: 'Cancelling',
    className: 'bg-orange-100 text-[#F87927] dark:bg-orange-500/20 dark:text-orange-300',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-violet-100 text-[#8B5CF6] dark:bg-violet-500/20 dark:text-violet-300',
  },
}

/**
 * Transfer's chips and status tabs: amber Pending, and a completed request is
 * "Approved" in green, as drawn.
 */
export const TRANSFER_STATUS_META: Record<RequestStatus, { label: string; className: string }> = {
  ...STATUS_META,
  completed: {
    label: 'Approved',
    className: 'bg-[#E1F6E6] text-[#51B969] dark:bg-green-500/15 dark:text-green-400',
  },
}

export const PUNCH_TYPE_LABELS: Record<PunchRequestType, string> = {
  check_in: 'Check In',
  check_out: 'Check Out',
  break_out: 'Break Out',
  break_in: 'Break In',
}

export const APPROVAL_VIEW_LABELS: Record<ApprovalView, string> = {
  requested: 'Requested',
  delegates: 'Delegates',
  consents: 'Consents',
  cancellations: 'Cancellations',
}

export const ACTION_LABELS: Record<RequestAction, string> = {
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
  flow: 'Flow',
  history: 'History',
  cancel: 'Cancel',
  decide: 'Approve/Reject',
  consent: 'Consent',
  forward: 'Forward',
}

export const REQUEST_PAGE_SIZE = 10
