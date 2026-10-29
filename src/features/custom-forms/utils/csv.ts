import { format } from 'date-fns'

import { toCsv } from '@/features/payroll'
import { formatDateTime } from '@/lib/date'

import type { FormDefinition, FormResponse } from '../types/custom-forms.types'
import { answerText, slugOf } from './format'

/**
 * A form's responses as CSV, built in the browser: when, who (left out on an anonymous form),
 * then one column per question in the form's order, each answer as the table shows it.
 */
export function responsesCsv(
  form: Pick<FormDefinition, 'fields' | 'anonymous'>,
  responses: readonly FormResponse[],
): string {
  const people = form.anonymous ? [] : ['Respondent', 'Employee code', 'Department']
  const header = ['Submitted', ...people, ...form.fields.map((field) => field.label)]
  const rows = responses.map((response) => {
    const answers = new Map(response.answers.map((answer) => [answer.fieldId, answer]))
    return [
      formatDateTime(response.submittedAt),
      ...(form.anonymous
        ? []
        : [
            response.respondent?.name ?? '',
            response.respondent?.code ?? '',
            response.respondent?.departmentName ?? '',
          ]),
      ...form.fields.map((field) => answerText(field, answers.get(field.id))),
    ]
  })
  return toCsv(header, rows)
}

/** "employee-satisfaction-survey-2026-responses-2026-10-28.csv". */
export const responsesFileName = (title: string, today: Date) =>
  `${slugOf(title)}-responses-${format(today, 'yyyy-MM-dd')}.csv`
