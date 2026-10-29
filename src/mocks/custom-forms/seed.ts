import { addDays, format, subDays } from 'date-fns'

import type { AudienceKind, FieldType, FormStatus } from '@/features/custom-forms'

import { DIRECTORY } from '../employees/seed'

// Sample data of the Custom Form mock: four forms built from the shared company directory
// (src/mocks/employees/seed.ts). The signed-in mock user is Shelley Kannes (`em_shelley`).
//  - Employee Satisfaction Survey 2026: published to everyone, anonymous, one response per
//    person, with answers from 14 colleagues (not Shelley, so she can still fill it in);
//  - IT Equipment Request: published to Shelley and the software team, as often as needed;
//    Shelley asked for a monitor twelve days ago;
//  - Annual Health Check Registration: closed, for the Lahore head office branch;
//  - Exit Interview: a draft nobody sees yet.

export interface OptionRec {
  id: string
  label: string
}

export interface FieldRec {
  id: string
  sectionId: string | null
  type: FieldType
  label: string
  helpText: string | null
  required: boolean
  options: OptionRec[]
  min: number | null
  max: number | null
}

export interface SectionRec {
  id: string
  title: string
  description: string | null
}

export interface FormRec {
  id: string
  title: string
  description: string | null
  category: string | null
  closesOn: string | null
  status: FormStatus
  audience: { kind: AudienceKind; ids: string[] }
  oneResponsePerPerson: boolean
  anonymous: boolean
  sections: SectionRec[]
  /** In order: those before the first section, then each section's. */
  fields: FieldRec[]
  createdById: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  closedAt: string | null
  rowVersion: string
}

export interface AnswerRec {
  fieldId: string
  value: string | number | boolean | string[] | null
}

export interface ResponseRec {
  id: string
  formId: string
  /** Kept on anonymous forms too (one response per person, the author's own list), never shown to HR. */
  employeeId: string
  submittedAt: string
  answers: AnswerRec[]
}

let version = 0
export const nextRowVersion = () => {
  version += 1
  return (Date.now() * 1000 + version).toString(16).padStart(16, '0')
}

const day = (date: Date) => format(date, 'yyyy-MM-dd')
const at = (date: Date, hour: number) => {
  const copy = new Date(date)
  copy.setHours(hour, (hour * 7) % 60, 0, 0)
  return copy.toISOString()
}

/** A field with options `o1`, `o2` … under its own id. */
function field(
  id: string,
  type: FieldType,
  label: string,
  extra: Partial<Omit<FieldRec, 'id' | 'type' | 'label' | 'options'>> & { options?: string[] } = {},
): FieldRec {
  const { options = [], ...rest } = extra
  return {
    id,
    sectionId: null,
    type,
    label,
    helpText: null,
    required: false,
    min: null,
    max: null,
    ...rest,
    options: options.map((option, index) => ({ id: `${id}_o${String(index + 1)}`, label: option })),
  }
}

const opt = (fieldId: string, index: number) => `${fieldId}_o${String(index + 1)}`

// --- the forms ----------------------------------------------------------------------------------

function satisfactionSurvey(today: Date): FormRec {
  const published = subDays(today, 20)
  return {
    id: 'cf_survey',
    title: 'Employee Satisfaction Survey 2026',
    description:
      'Tell us how work is going. Answers are anonymous: HR sees the totals and the comments, never who wrote them.',
    category: 'Engagement',
    closesOn: day(addDays(today, 14)),
    status: 'published',
    audience: { kind: 'everyone', ids: [] },
    oneResponsePerPerson: true,
    anonymous: true,
    sections: [
      { id: 'cf_survey_s1', title: 'Your work', description: 'Your role and your workload.' },
      { id: 'cf_survey_s2', title: 'Your team', description: null },
    ],
    fields: [
      field('cf_survey_f1', 'rating', 'How satisfied are you with your role?', {
        sectionId: 'cf_survey_s1',
        required: true,
        max: 5,
      }),
      field('cf_survey_f2', 'single_choice', 'Is your workload manageable?', {
        sectionId: 'cf_survey_s1',
        required: true,
        options: ['Always', 'Usually', 'Sometimes', 'Rarely'],
      }),
      field('cf_survey_f3', 'multiple_choice', 'Which benefits matter most to you?', {
        sectionId: 'cf_survey_s1',
        helpText: 'Pick up to three.',
        required: true,
        options: ['Health cover', 'Flexible hours', 'Training budget', 'Remote work', 'Bonuses'],
        min: 1,
        max: 3,
      }),
      field('cf_survey_f4', 'dropdown', 'How often does your manager give you feedback?', {
        sectionId: 'cf_survey_s2',
        required: true,
        options: ['Every week', 'Every month', 'Every quarter', 'Rarely'],
      }),
      field('cf_survey_f5', 'long_text', 'What would make work better for you?', {
        sectionId: 'cf_survey_s2',
        max: 1000,
      }),
    ],
    createdById: 'em_shelley',
    createdAt: at(subDays(today, 24), 10),
    updatedAt: at(published, 9),
    publishedAt: at(published, 9),
    closedAt: null,
    rowVersion: nextRowVersion(),
  }
}

/** Shelley and the software team. */
const IT_AUDIENCE = ['em_shelley', 'em_bilal', 'em_haroon', 'em_rehan', 'em_mahnoor', 'em_maryam']

function itEquipmentRequest(today: Date): FormRec {
  const published = subDays(today, 60)
  return {
    id: 'cf_it',
    title: 'IT Equipment Request',
    description:
      'Ask IT for a laptop, monitor or other equipment. You can send as many as you need.',
    category: 'IT',
    closesOn: null,
    status: 'published',
    audience: { kind: 'people', ids: IT_AUDIENCE },
    oneResponsePerPerson: false,
    anonymous: false,
    sections: [],
    fields: [
      field('cf_it_f1', 'dropdown', 'Equipment', {
        required: true,
        options: ['Laptop', 'Monitor', 'Keyboard and mouse', 'Headset', 'Docking station'],
      }),
      field('cf_it_f2', 'number', 'Quantity', { required: true, min: 1, max: 5 }),
      field('cf_it_f3', 'date', 'Needed by', { required: true }),
      field('cf_it_f4', 'single_choice', 'Urgency', {
        required: true,
        options: ['Low', 'Normal', 'High'],
      }),
      field('cf_it_f5', 'long_text', 'Why do you need it?', {
        helpText: 'A sentence or two for the IT team.',
        required: true,
        min: 10,
        max: 500,
      }),
      field('cf_it_f6', 'file', 'Quotation or photo', { helpText: 'Optional.' }),
      field('cf_it_f7', 'checkbox', 'I will return the equipment when I leave the company', {
        required: true,
      }),
    ],
    createdById: 'em_shelley',
    createdAt: at(subDays(today, 62), 11),
    updatedAt: at(published, 12),
    publishedAt: at(published, 12),
    closedAt: null,
    rowVersion: nextRowVersion(),
  }
}

function healthCheck(today: Date): FormRec {
  const closed = subDays(today, 10)
  return {
    id: 'cf_health',
    title: 'Annual Health Check Registration',
    description: 'Book your free health check at the head office clinic.',
    category: 'Wellbeing',
    closesOn: day(closed),
    status: 'closed',
    audience: { kind: 'branches', ids: ['br_lhr_ho'] },
    oneResponsePerPerson: true,
    anonymous: false,
    sections: [],
    fields: [
      field('cf_health_f1', 'single_choice', 'Preferred slot', {
        required: true,
        options: ['Morning', 'Afternoon'],
      }),
      field('cf_health_f2', 'checkbox', 'I have a condition the doctor should know about'),
      field('cf_health_f3', 'short_text', 'Anything else?', { max: 200 }),
    ],
    createdById: 'em_sadia',
    createdAt: at(subDays(today, 45), 10),
    updatedAt: at(closed, 18),
    publishedAt: at(subDays(today, 40), 9),
    closedAt: at(closed, 18),
    rowVersion: nextRowVersion(),
  }
}

function exitInterview(today: Date): FormRec {
  return {
    id: 'cf_exit',
    title: 'Exit Interview',
    description: 'For people leaving the company, on their last week.',
    category: 'Off-boarding',
    closesOn: null,
    status: 'draft',
    audience: { kind: 'everyone', ids: [] },
    oneResponsePerPerson: true,
    anonymous: false,
    sections: [],
    fields: [
      field('cf_exit_f1', 'date', 'Last working day', { required: true }),
      field('cf_exit_f2', 'single_choice', 'Main reason for leaving', {
        required: true,
        options: ['Career growth', 'Pay', 'Relocation', 'Work–life balance', 'Other'],
      }),
      field('cf_exit_f3', 'rating', 'Your overall experience here', { required: true, max: 10 }),
      field('cf_exit_f4', 'long_text', 'What could we have done better?'),
    ],
    createdById: 'em_shelley',
    createdAt: at(subDays(today, 3), 15),
    updatedAt: at(subDays(today, 2), 16),
    publishedAt: null,
    closedAt: null,
    rowVersion: nextRowVersion(),
  }
}

export function seedForms(): FormRec[] {
  const today = new Date()
  return [
    exitInterview(today),
    satisfactionSurvey(today),
    itEquipmentRequest(today),
    healthCheck(today),
  ]
}

// --- the responses ------------------------------------------------------------------------------

const COMMENTS = [
  'More time for training would help.',
  null,
  'Clearer priorities from the leadership team.',
  null,
  'A quieter space to focus.',
  'Happy overall, thank you.',
  null,
]

function surveyResponses(today: Date): ResponseRec[] {
  const people = DIRECTORY.filter((person) => person.id !== 'em_shelley').slice(0, 14)
  return people.map((person, index) => {
    const picks = [opt('cf_survey_f3', index % 5), opt('cf_survey_f3', (index + 2) % 5)]
    return {
      id: `cf_survey_r${String(index + 1)}`,
      formId: 'cf_survey',
      employeeId: person.id,
      submittedAt: at(subDays(today, 19 - index), 9 + (index % 8)),
      answers: [
        { fieldId: 'cf_survey_f1', value: [4, 5, 3, 4, 2, 5, 4][index % 7] ?? 4 },
        {
          fieldId: 'cf_survey_f2',
          value: opt('cf_survey_f2', [1, 0, 1, 2, 1, 3, 0][index % 7] ?? 1),
        },
        { fieldId: 'cf_survey_f3', value: index % 3 === 0 ? picks.slice(0, 1) : picks },
        { fieldId: 'cf_survey_f4', value: opt('cf_survey_f4', [1, 0, 2, 1, 3][index % 5] ?? 1) },
        { fieldId: 'cf_survey_f5', value: COMMENTS[index % COMMENTS.length] ?? null },
      ],
    }
  })
}

function itResponses(today: Date): ResponseRec[] {
  const request = (
    id: string,
    employeeId: string,
    daysAgo: number,
    equipment: number,
    quantity: number,
    urgency: number,
    reason: string,
  ): ResponseRec => ({
    id,
    formId: 'cf_it',
    employeeId,
    submittedAt: at(subDays(today, daysAgo), 11),
    answers: [
      { fieldId: 'cf_it_f1', value: opt('cf_it_f1', equipment) },
      { fieldId: 'cf_it_f2', value: quantity },
      { fieldId: 'cf_it_f3', value: day(subDays(today, daysAgo - 7)) },
      { fieldId: 'cf_it_f4', value: opt('cf_it_f4', urgency) },
      { fieldId: 'cf_it_f5', value: reason },
      { fieldId: 'cf_it_f6', value: null },
      { fieldId: 'cf_it_f7', value: true },
    ],
  })
  return [
    request('cf_it_r1', 'em_haroon', 30, 0, 1, 2, 'My laptop no longer holds a charge.'),
    request('cf_it_r2', 'em_shelley', 12, 1, 1, 1, 'A second screen for the payroll reviews.'),
    request('cf_it_r3', 'em_mahnoor', 5, 3, 2, 0, 'Headsets for the two QA test benches.'),
  ]
}

function healthResponses(today: Date): ResponseRec[] {
  const people = ['em_shelley', 'em_ayesha', 'em_hina', 'em_omer', 'em_sadia']
  return people.map((employeeId, index) => ({
    id: `cf_health_r${String(index + 1)}`,
    formId: 'cf_health',
    employeeId,
    submittedAt: at(subDays(today, 30 - index * 3), 10 + index),
    answers: [
      { fieldId: 'cf_health_f1', value: opt('cf_health_f1', index % 2) },
      { fieldId: 'cf_health_f2', value: index === 2 },
      { fieldId: 'cf_health_f3', value: index === 0 ? 'Please book me before 10 am.' : null },
    ],
  }))
}

export function seedResponses(): ResponseRec[] {
  const today = new Date()
  return [...surveyResponses(today), ...itResponses(today), ...healthResponses(today)]
}
