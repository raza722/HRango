import { useId } from 'react'

import { RATING_DEFAULT_SCALE } from '../../constants'
import type { FieldSummary, FormFieldDef, ResponseSummary } from '../../types/custom-forms.types'
import { countText } from '../../utils/format'

/** The label of one counted value: an option, Yes / No, or "4 of 5". */
function valueLabel(field: FormFieldDef, value: string): string {
  if (field.type === 'checkbox') return value === 'true' ? 'Yes' : 'No'
  if (field.type === 'rating') return `${value} of ${String(field.max ?? RATING_DEFAULT_SCALE)}`
  return field.options.find((option) => option.id === value)?.label ?? 'Removed option'
}

/** One question's counts as bars, with the number and the share beside each. */
function FieldBars({ field, summary }: { field: FormFieldDef; summary: FieldSummary }) {
  const titleId = useId()
  const most = Math.max(1, ...summary.counts.map((item) => item.count))
  return (
    <section
      aria-labelledby={titleId}
      className="grid content-start gap-3 rounded-[10px] border border-[#E0E0E0] p-3.5 dark:border-border"
    >
      <div className="grid gap-0.5">
        <h3
          id={titleId}
          className="text-[0.8125rem] font-medium break-words text-title dark:text-heading"
        >
          {field.label}
        </h3>
        <p className="text-[0.6875rem] text-grey">
          {countText(summary.answered, 'answer')}
          {field.type === 'multiple_choice' && ' · people could pick more than one'}
        </p>
      </div>
      <ul className="grid gap-2">
        {summary.counts.map((item) => {
          const share = summary.answered > 0 ? Math.round((item.count / summary.answered) * 100) : 0
          const label = valueLabel(field, item.value)
          return (
            <li key={item.value} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 break-words text-title dark:text-heading">{label}</span>
                <span className="shrink-0 text-grey tabular-nums">
                  <span className="font-medium text-title dark:text-heading">{item.count}</span>
                  <span className="sr-only">
                    {' '}
                    {item.count === 1 ? 'answer' : 'answers'},
                  </span> · {share}%
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-2 overflow-hidden rounded-full bg-[#EBEFF8] dark:bg-muted"
              >
                <div
                  className="h-full rounded-full bg-sidebar dark:bg-primary"
                  style={{ width: `${String((item.count / most) * 100)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The choice-like questions of a form (choices, dropdowns, check boxes, ratings) as counts. */
export function ResponsesSummary({
  fields,
  summary,
}: {
  fields: readonly FormFieldDef[]
  summary: ResponseSummary
}) {
  const shown = summary.fields.flatMap((item) => {
    const field = fields.find((candidate) => candidate.id === item.fieldId)
    return field ? [{ field, item }] : []
  })
  if (shown.length === 0) {
    return <p className="text-sm text-grey">This form has no choice questions to count.</p>
  }
  return (
    <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
      {shown.map(({ field, item }) => (
        <FieldBars key={field.id} field={field} summary={item} />
      ))}
    </div>
  )
}
