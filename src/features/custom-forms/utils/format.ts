import { formatDateTime, formatDisplayDate } from '@/lib/date'

import { AUDIENCE_LABELS } from '../constants'
import type { Answer, FormAudience, FormFieldDef } from '../types/custom-forms.types'

/** "Everyone", "Departments: Software, Sales", "People: Shelley Kannes +4 more". */
export function audienceText(audience: FormAudience): string {
  if (audience.kind === 'everyone') return AUDIENCE_LABELS.everyone
  const names = audience.targets.map((target) => target.name)
  const shown =
    names.length <= 2
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${String(names.length - 2)} more`
  return `${AUDIENCE_LABELS[audience.kind]}: ${shown || '—'}`
}

export const dateText = (value: string | null) => (value ? formatDisplayDate(value) : '—')
export const stampText = (value: string | null) => (value ? formatDateTime(value) : '—')

const optionLabel = (field: FormFieldDef, id: string) =>
  field.options.find((option) => option.id === id)?.label ?? 'Removed option'

/** An answer as one line of text (tables, CSV, the response view); '' when not answered. */
export function answerText(field: FormFieldDef, answer: Answer | undefined): string {
  const value = answer?.value ?? null
  if (value === null || value === '') return ''
  switch (field.type) {
    case 'single_choice':
    case 'dropdown':
      return typeof value === 'string' ? optionLabel(field, value) : String(value)
    case 'multiple_choice':
      return Array.isArray(value) ? value.map((id) => optionLabel(field, id)).join(', ') : ''
    case 'checkbox':
      return value === true ? 'Yes' : 'No'
    case 'date':
      return typeof value === 'string' ? formatDisplayDate(value) : ''
    case 'rating':
      return `${String(value)} / ${String(field.max ?? 5)}`
    case 'file':
      return answer?.file?.name ?? (typeof value === 'string' ? 'Attached file' : '')
    default:
      return String(value)
  }
}

/** "3 responses", "1 response". */
export const countText = (count: number, noun: string) =>
  `${String(count)} ${noun}${count === 1 ? '' : 's'}`

/** A file-name friendly form title: "Employee Satisfaction Survey" → "employee-satisfaction-survey". */
export const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'form'
