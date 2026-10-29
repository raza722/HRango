import { MissingPunchMenuIcon } from '@/components/icons/attendance-menu-icons'

/** Attendance menu entries that are not built yet. */
export const PLANNED_SECTIONS = {
  'missing-punch': {
    label: 'Missing Punch',
    icon: MissingPunchMenuIcon,
    planned: 'Days with a missing check in or out, and the requests to fix them.',
  },
} as const

export type PlannedSection = keyof typeof PLANNED_SECTIONS

export const sectionLabel = (slug: string) =>
  slug in PLANNED_SECTIONS ? PLANNED_SECTIONS[slug as PlannedSection].label : 'Attendance'
