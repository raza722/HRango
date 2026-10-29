import { ArrowLeft, CircleCheck, FileQuestion } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { CF_CODES } from '../../constants'
import { useAssignedForm, useSubmitResponse } from '../../hooks/use-custom-forms'
import { dateText, stampText } from '../../utils/format'
import {
  cancelButtonClass,
  cardClass,
  outlineButtonClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { FillForm } from '../fill/fill-form'
import { EmptyBox, LoadError, LoadingBlock, PageHeaderCard } from '../shared/page-parts'

/**
 * Filling one form (`/custom-form/my-forms?fill=<id>`): what it is, the questions, Submit. A
 * form that takes no more answers from the caller (closed, or answered once already) says so
 * and offers the caller's answer instead.
 */
export function FillView({
  formId,
  onBack,
  onSubmitted,
  onViewResponse,
}: {
  formId: string
  onBack: () => void
  onSubmitted: () => void
  onViewResponse: (responseId: string) => void
}) {
  const query = useAssignedForm(formId)
  const submit = useSubmitResponse()
  const canSubmit = useCan(CF_CODES.myFormsSubmit)
  const back = (
    <Button
      variant="outline"
      onClick={onBack}
      className={cn(toolbarButtonClass, outlineButtonClass, 'gap-1.5 px-4 text-xs')}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to My Forms
    </Button>
  )

  if (query.isPending) {
    return (
      <>
        <PageHeaderCard title="My Forms" actions={back} />
        <div className={cn(cardClass, 'p-4 sm:p-6')}>
          <LoadingBlock label="the form" rows={5} />
        </div>
      </>
    )
  }
  if (query.error) {
    return (
      <>
        <PageHeaderCard title="My Forms" actions={back} />
        {query.error.isNotFound ? (
          <div className={cn(cardClass, 'p-4 sm:p-6')}>
            <EmptyBox icon={<FileQuestion />} title="This form is not available to you">
              It may have been removed, or it is meant for other people.
            </EmptyBox>
          </div>
        ) : (
          <LoadError
            error={query.error}
            onRetry={() => {
              void query.refetch()
            }}
          />
        )}
      </>
    )
  }

  const form = query.data
  const notes = [
    form.category,
    form.closesOn ? `Closes ${dateText(form.closesOn)}` : null,
    form.anonymous ? 'Anonymous: your name is not shown with your answers' : null,
    form.oneResponsePerPerson ? 'One response per person' : null,
  ].filter((note): note is string => note !== null)

  return (
    <>
      <PageHeaderCard title={form.title} actions={back}>
        {notes.length > 0 && (
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-grey"
            aria-label="About this form"
          >
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        {form.description && (
          <p className="text-sm whitespace-pre-line text-title dark:text-heading">
            {form.description}
          </p>
        )}
      </PageHeaderCard>

      <section aria-label="Questions" className={cn(cardClass, 'p-4 sm:p-6')}>
        {form.canRespond && canSubmit ? (
          <FillForm
            definition={form}
            onSubmit={async (answers) => {
              await submit.mutateAsync({ formId: form.id, answers, definition: form })
              toast.success('Thank you. Your answers were sent.')
              onSubmitted()
            }}
            footer={
              <Button onClick={onBack} className={cancelButtonClass}>
                Cancel
              </Button>
            }
          />
        ) : (
          <EmptyBox
            icon={<CircleCheck />}
            title={
              form.status === 'closed'
                ? 'This form is closed'
                : form.myResponseCount > 0
                  ? 'You have answered this form'
                  : 'You cannot answer this form'
            }
          >
            <p>
              {form.status === 'closed'
                ? 'It takes no more answers.'
                : form.myResponseCount > 0
                  ? `It takes one response per person; yours was sent ${stampText(form.lastSubmittedAt)}.`
                  : 'Ask HR if you think you should.'}
            </p>
            {form.myResponseCount > 0 && form.lastResponseId && (
              <Button
                variant="outline"
                onClick={() => {
                  if (form.lastResponseId) onViewResponse(form.lastResponseId)
                }}
                className={cn(toolbarButtonClass, outlineButtonClass, 'mt-3 px-4 text-xs')}
              >
                View my answers
              </Button>
            )}
          </EmptyBox>
        )}
      </section>
    </>
  )
}
