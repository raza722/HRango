import { type ReactNode, useId, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  answerErrorKey,
  type AnswerValues,
  buildAnswersSchema,
  emptyAnswers,
  toAnswerInputs,
} from '../../schemas/answers.schema'
import type { AnswerInput, FormDefinition } from '../../types/custom-forms.types'
import { groupBySection, questionNumbers } from '../../utils/sections'
import { fieldsClass, saveButtonClass } from '../../utils/styles'
import { AnswerField } from './answer-field'

/**
 * The form people fill, built from the form's own definition: every question by its type, with
 * a validation schema made from the questions (required, numbers, options, limits). The builder's
 * live preview renders this same component with `preview`, so what HR sees is what people get.
 * `onSubmit` receives the answers as the API takes them; when it throws an `ApiError` with
 * `answers.<fieldId>` field errors they go on the questions, anything else becomes a toast.
 */
export function FillForm({
  definition,
  onSubmit,
  submitLabel = 'Submit',
  preview = false,
  disabled = false,
  footer,
}: {
  definition: FormDefinition
  onSubmit: (answers: AnswerInput[]) => Promise<void>
  submitLabel?: string
  preview?: boolean
  disabled?: boolean
  /** Next to the submit button (Cancel). */
  footer?: ReactNode
}) {
  const formId = useId()
  const { fields } = definition
  const schema = useMemo(() => buildAnswersSchema(fields), [fields])
  const form = useForm<AnswerValues>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: emptyAnswers(fields),
  })
  const groups = groupBySection(definition)
  const numbers = questionNumbers(groups)
  const busy = disabled || form.formState.isSubmitting

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(toAnswerInputs(fields, values))
    } catch (error) {
      if (!(error instanceof ApiError)) {
        toast.error('Something went wrong. Please try again.')
        return
      }
      let placed = false
      for (const [path, message] of Object.entries(error.fieldErrors)) {
        const key = answerErrorKey(path, fields)
        if (key) {
          form.setError(key, { type: 'server', message }, { shouldFocus: !placed })
          placed = true
        }
      }
      toast.error(placed ? 'Some answers need your attention.' : error.message)
    }
  })

  return (
    <form
      id={formId}
      noValidate
      aria-label={preview ? `Preview of ${definition.title || 'the form'}` : definition.title}
      onSubmit={(event) => void submit(event)}
      className={cn('grid gap-6', fieldsClass)}
    >
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#D5DCEB] px-4 py-8 text-center text-sm text-grey dark:border-border">
          {preview
            ? 'Questions you add show here as people will see them.'
            : 'This form has no questions.'}
        </p>
      )}
      {groups.map(({ section, fields: questions }) => (
        <section
          key={section?.id ?? 'start'}
          aria-label={section ? section.title || 'Untitled section' : undefined}
          className={cn(
            'grid gap-5',
            section &&
              'border-t border-[#E0E0E0] pt-5 first:border-t-0 first:pt-0 dark:border-border',
          )}
        >
          {section && (
            <div className="grid gap-1">
              <h3 className="text-base font-medium text-sidebar dark:text-heading">
                {section.title || 'Untitled section'}
              </h3>
              {section.description && <p className="text-xs text-grey">{section.description}</p>}
            </div>
          )}
          {questions.map((field) => (
            <AnswerField
              key={field.id}
              field={field}
              number={numbers.get(field.id) ?? 0}
              control={form.control}
              disabled={busy}
              preview={preview}
            />
          ))}
        </section>
      ))}
      {fields.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-[#E0E0E0] pt-5 dark:border-border">
          <Button type="submit" disabled={busy} className={saveButtonClass}>
            {form.formState.isSubmitting ? 'Sending…' : submitLabel}
          </Button>
          {footer}
        </div>
      )}
    </form>
  )
}
