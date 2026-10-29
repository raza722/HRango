import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { RATING_DEFAULT_SCALE } from '../../constants'
import { useResponse } from '../../hooks/use-custom-forms'
import type { Answer, FormFieldDef, ResponseDetail } from '../../types/custom-forms.types'
import { answerText, stampText } from '../../utils/format'
import { groupBySection, questionNumbers } from '../../utils/sections'
import { saveButtonClass } from '../../utils/styles'
import { LoadError, LoadingBlock } from '../shared/page-parts'

/** One answer, read-only: a link for a file, stars for a rating, the text otherwise. */
function AnswerValue({ field, answer }: { field: FormFieldDef; answer: Answer | undefined }) {
  const text = answerText(field, answer)
  if (!text) return <span className="text-grey italic">Not answered</span>
  if (field.type === 'file' && answer?.file) {
    return (
      <a
        href={answer.file.url}
        target="_blank"
        rel="noreferrer"
        className="text-[#263871] underline-offset-2 hover:underline dark:text-sky-300"
      >
        {answer.file.name ?? 'Attached file'}
      </a>
    )
  }
  if (field.type === 'rating' && typeof answer?.value === 'number') {
    const scale = field.max ?? RATING_DEFAULT_SCALE
    const value = answer.value
    return (
      <span className="inline-flex items-center gap-1">
        <span aria-hidden="true" className="inline-flex">
          {Array.from({ length: scale }, (_, index) => (
            <Star
              key={index}
              className={cn(
                'size-4',
                index < value
                  ? 'fill-[#F5B301] text-[#F5B301]'
                  : 'text-[#CFCFCF] dark:text-muted-foreground',
              )}
            />
          ))}
        </span>
        <span>{text}</span>
      </span>
    )
  }
  return <span className="whitespace-pre-line">{text}</span>
}

/** A response's questions and answers, in the form's order. */
export function ResponseAnswers({ response }: { response: ResponseDetail }) {
  const groups = groupBySection(response.form)
  const numbers = questionNumbers(groups)
  const answers = new Map(response.answers.map((answer) => [answer.fieldId, answer]))
  return (
    <div className="grid gap-5">
      {groups.map(({ section, fields }) => (
        <section key={section?.id ?? 'start'} aria-label={section?.title} className="grid gap-3">
          {section && (
            <h3 className="border-t border-[#E0E0E0] pt-4 text-base font-medium text-sidebar first:border-t-0 first:pt-0 dark:border-border dark:text-heading">
              {section.title}
            </h3>
          )}
          <dl className="grid gap-3">
            {fields.map((field) => (
              <div
                key={field.id}
                className="grid gap-1 rounded-lg bg-[#F6F8FC] px-3.5 py-2.5 dark:bg-muted/50"
              >
                <dt className="text-xs font-medium text-grey">
                  {numbers.get(field.id)}. {field.label}
                </dt>
                <dd className="text-sm text-title dark:text-heading">
                  <AnswerValue field={field} answer={answers.get(field.id)} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

/** "View" on a response: the person (unless anonymous), when, and every answer. */
export function ResponseDialog({
  responseId,
  onClose,
}: {
  responseId: string
  onClose: () => void
}) {
  const response = useResponse(responseId)
  const data = response.data
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showClose={false} className="max-w-2xl gap-0 rounded-2xl p-0">
        <div className="grid gap-1 px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="font-sans text-xl font-semibold text-[#202020] dark:text-heading">
            {data ? data.form.title : 'Response'}
          </DialogTitle>
          <DialogDescription className="text-xs text-grey">
            {data
              ? `${data.respondent ? data.respondent.name : 'Anonymous'} · submitted ${stampText(data.submittedAt)}`
              : 'Loading the response…'}
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {response.isPending ? (
            <LoadingBlock label="the response" />
          ) : response.error ? (
            <LoadError
              error={response.error}
              onRetry={() => {
                void response.refetch()
              }}
            />
          ) : (
            <ResponseAnswers response={response.data} />
          )}
        </div>
        <div className="flex justify-end px-5 pb-5 sm:px-6 sm:pb-6">
          <Button onClick={onClose} className={saveButtonClass}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
