import {
  AlignLeft,
  Calendar,
  CircleDot,
  Hash,
  ListChecks,
  type LucideIcon,
  Paperclip,
  SquareCheck,
  SquareChevronDown,
  Star,
  Type,
} from 'lucide-react'

import type { AudienceKind, FieldType, FormStatus } from './types/custom-forms.types'

/**
 * Permission codes. The API has no Custom Form codes yet; these follow its
 * `module.screen.action` pattern (Backend Dependencies, "Custom Form"). The mock grants all.
 */
export const CF_CODES = {
  /** The Forms list and the builder (HR, admins). */
  formsView: 'forms.forms.view',
  /** + New Form and Duplicate. */
  formsCreate: 'forms.forms.create',
  formsEdit: 'forms.forms.edit',
  /** Publish, Close and Reopen. */
  formsPublish: 'forms.forms.publish',
  formsDelete: 'forms.forms.delete',
  /** The Responses page and one response. */
  responsesView: 'forms.responses.view',
  responsesExport: 'forms.responses.export',
  /** My Forms (everyone). */
  myFormsView: 'forms.my_forms.view',
  myFormsSubmit: 'forms.my_forms.submit',
} as const

/** Where the backend gap is written up. */
export const BACKEND_DEPENDENCY = 'Custom Form'

export const FORM_PAGE_SIZE = 10
export const FORM_PAGE_SIZES = [10, 20, 50] as const

/** The API's limits, checked in the builder too. */
export const LIMITS = {
  title: 150,
  description: 2000,
  category: 60,
  label: 200,
  helpText: 500,
  option: 120,
  options: 30,
  fields: 100,
  sectionTitle: 150,
  /** Longest text answer. */
  text: 5000,
} as const

/** Rating scales: 3 to 10 stars, 5 by default. */
export const RATING_MIN_SCALE = 3
export const RATING_MAX_SCALE = 10
export const RATING_DEFAULT_SCALE = 5

export interface ChipMeta {
  label: string
  className: string
}

/** Status chips (text and colour; never colour alone), as the Talent Management chips. */
export const STATUS_META: Record<FormStatus, ChipMeta> = {
  draft: {
    label: 'Draft',
    className: 'bg-[#EFEFEF] text-[#5C5C5C] dark:bg-muted dark:text-muted-foreground',
  },
  published: {
    label: 'Published',
    className: 'bg-[#2CBD4D]/[0.18] text-[#2E9E48] dark:bg-green-500/15 dark:text-green-400',
  },
  closed: {
    label: 'Closed',
    className: 'bg-[#FFE3E3] text-[#D83838] dark:bg-red-500/15 dark:text-red-300',
  },
}

/** My Forms: where the caller stands with a form. */
export const ASSIGNED_META = {
  todo: {
    label: 'To do',
    className: 'bg-[#EBEFF8] text-[#263871] dark:bg-sky-500/15 dark:text-sky-300',
  },
  submitted: STATUS_META.published,
  closed: STATUS_META.closed,
} as const satisfies Record<string, ChipMeta>
export const SUBMITTED_LABEL = 'Submitted'

export interface FieldTypeMeta {
  label: string
  icon: LucideIcon
  /** What `min` / `max` mean for the type, or `null` when it has none. */
  limits: { min: string; max: string; integer: boolean } | null
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeMeta> = {
  short_text: {
    label: 'Short text',
    icon: Type,
    limits: { min: 'Min length', max: 'Max length', integer: true },
  },
  long_text: {
    label: 'Long text',
    icon: AlignLeft,
    limits: { min: 'Min length', max: 'Max length', integer: true },
  },
  number: {
    label: 'Number',
    icon: Hash,
    limits: { min: 'Min value', max: 'Max value', integer: false },
  },
  date: { label: 'Date', icon: Calendar, limits: null },
  single_choice: { label: 'Single choice', icon: CircleDot, limits: null },
  multiple_choice: {
    label: 'Multiple choice',
    icon: ListChecks,
    limits: { min: 'Min picks', max: 'Max picks', integer: true },
  },
  dropdown: { label: 'Dropdown', icon: SquareChevronDown, limits: null },
  checkbox: { label: 'Checkbox', icon: SquareCheck, limits: null },
  file: { label: 'File upload', icon: Paperclip, limits: null },
  rating: { label: 'Rating', icon: Star, limits: null },
}

export const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  everyone: 'Everyone',
  departments: 'Departments',
  branches: 'Branches',
  people: 'People',
}

export const STATUS_FILTER_LABELS = {
  all: 'All',
  draft: 'Drafts',
  published: 'Published',
  closed: 'Closed',
} as const
