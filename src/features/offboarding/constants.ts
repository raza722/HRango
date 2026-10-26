import type { ChecklistFieldType, EoeReason, EoeScope, EoeStatus } from './types/offboarding.types'

export const EOE_REASON_LABELS: Record<EoeReason, string> = {
  termination: 'Termination',
  resignation: 'Resignation',
  retirement: 'Retirement',
  other: 'Other',
}

export const EOE_STATUS_META: Record<EoeStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-[#FFF1DE] text-[#F08035]/90' },
  completed: { label: 'Completed', className: 'bg-[#E3F8E8] text-[#51B969]' },
}

export const EOE_SCOPE_LABELS: Record<EoeScope, string> = {
  all: 'All',
  completed: 'Completed',
  pending: 'Pending',
}

export const CHECKLIST_FIELD_TYPE_LABELS: Record<ChecklistFieldType, string> = {
  number: 'Number',
  string: 'String',
  date: 'Date',
  boolean: 'Boolean',
}

/** Rows per page on the Off Boarding lists. */
export const OFFBOARDING_PAGE_SIZE = 10
