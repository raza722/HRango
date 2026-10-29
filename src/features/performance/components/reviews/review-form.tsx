import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ErrorState } from '@/components/feedback/error-state'
import { TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { appraisalStatusMeta } from '../../constants'
import {
  useMyEmployeeId,
  useReview,
  useReviewRights,
  useSaveReview,
} from '../../hooks/use-performance'
import {
  missingRatings,
  reviewFormSchema,
  reviewFormToInput,
  type ReviewFormValues,
  reviewToForm,
} from '../../schemas/performance-forms.schema'
import type { AppraisalDetail } from '../../types/performance.types'
import { showServerErrors } from '../../utils/form-errors'
import { formatDate, formatNumber, formatPeriod } from '../../utils/format'
import { ratingText, type ReviewPart, writablePart } from '../../utils/scores'
import {
  cancelButtonClass,
  cardClass,
  dialogFieldsClass,
  saveButtonClass,
  secondaryButtonClass,
} from '../../utils/styles'
import {
  AppraisalGoals,
  AppraisalNotes,
  RatingsTable,
  ScoreTiles,
  StageSteps,
} from '../appraisals/appraisal-parts'
import {
  BackButton,
  Chip,
  ConfirmAction,
  LoadingRows,
  PageHeaderCard,
  SectionCard,
} from '../shared/parts'

/** One criterion: its rating as a choice of the scale's levels, and a comment. */
function CriterionField({
  appraisal,
  index,
  part,
  form,
}: {
  appraisal: AppraisalDetail
  index: number
  part: ReviewPart
  form: ReturnType<typeof useForm<ReviewFormValues>>
}) {
  const row = appraisal.ratings[index]
  const error = form.formState.errors.ratings?.[index]?.rating?.message
  if (!row) return null
  const errorId = `rating-error-${row.criterionId}`
  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      className="grid gap-3 rounded-[10px] border border-[#E0E0E0] p-4 dark:border-border"
    >
      <legend className="px-1 text-sm font-medium text-title">
        {row.name} <span className="font-normal text-grey">({formatNumber(row.weight)}%)</span>
      </legend>
      {(row.description ?? row.kpiName) && (
        <p className="text-xs text-grey">
          {row.description}
          {row.kpiName ? ` KPI: ${row.kpiName}.` : ''}
        </p>
      )}
      {part === 'manager' && appraisal.hasSelfReview && (
        <p className="rounded-md bg-[#F5F7FB] px-3 py-2 text-xs text-title dark:bg-muted">
          <span className="font-medium">Self review:</span>{' '}
          {ratingText(appraisal.scale, row.selfRating)}
          {row.selfComment ? ` — ${row.selfComment}` : ''}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {appraisal.scale.map((level) => (
          <label
            key={level.score}
            className={cn(
              'relative inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#CFCFCF] px-3 py-2 text-xs text-title dark:border-input',
              'has-[:checked]:border-sidebar has-[:checked]:bg-sidebar has-[:checked]:text-white dark:has-[:checked]:border-primary dark:has-[:checked]:bg-primary',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
            )}
          >
            <input
              type="radio"
              value={String(level.score)}
              {...form.register(`ratings.${index}.rating`)}
              className="peer size-3.5 accent-current"
            />
            <span>
              <span className="font-medium">{formatNumber(level.score)}</span> · {level.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <TextareaField
        control={form.control}
        name={`ratings.${index}.comment`}
        label={`Comment on ${row.name}`}
        placeholder="Examples that back the rating"
      />
    </fieldset>
  )
}

/** The writable review: a rating and comment per criterion, overall comments, draft / submit. */
function ReviewEditor({
  appraisal,
  part,
  onDone,
}: {
  appraisal: AppraisalDetail
  part: ReviewPart
  onDone: () => void
}) {
  const save = useSaveReview()
  const [confirming, setConfirming] = useState(false)
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: reviewToForm(appraisal, part),
  })
  const fields = ['ratings', 'comments', 'developmentNeeds']

  const send = async (values: ReviewFormValues, submit: boolean) => {
    try {
      await save.mutateAsync({
        id: appraisal.id,
        part,
        input: reviewFormToInput(values, appraisal, part, submit),
      })
    } catch (error) {
      showServerErrors(error, form.setError, fields)
      return
    }
    if (submit) onDone()
  }

  const saveDraft = form.handleSubmit((values) => send(values, false))
  const trySubmit = form.handleSubmit((values) => {
    const missing = missingRatings(values)
    if (missing.length > 0) {
      for (const index of missing) {
        form.setError(`ratings.${index}.rating`, { message: 'Choose a rating' })
      }
      form.setError('root', { message: 'Rate every criterion before submitting.' })
      return
    }
    setConfirming(true)
  })
  const due = part === 'self' ? appraisal.selfReviewDueDate : appraisal.managerReviewDueDate

  return (
    <form
      noValidate
      onSubmit={(event) => void trySubmit(event)}
      aria-label={part === 'self' ? 'Self review' : 'Manager review'}
      className={cn(cardClass, dialogFieldsClass, '@container grid gap-5 p-4 sm:p-6')}
    >
      <div className="grid gap-1">
        <h2 className="text-base font-medium text-title">
          {part === 'self' ? 'Your Self Review' : `Manager Review of ${appraisal.employeeName}`}
        </h2>
        <p className="text-xs text-grey">
          Rate each criterion on the {appraisal.scale.length}-level scale.
          {due ? ` Due ${formatDate(due)}.` : ''} Save Draft keeps it for later; Submit sends it
          {part === 'self' ? ' to your manager' : ' for finalising'} and it can no longer change.
        </p>
      </div>
      <div className="grid gap-4">
        {appraisal.ratings.map((row, index) => (
          <CriterionField
            key={row.criterionId}
            appraisal={appraisal}
            index={index}
            part={part}
            form={form}
          />
        ))}
      </div>
      <SectionCard title="Goals in this cycle" as="h3">
        <AppraisalGoals appraisal={appraisal} />
      </SectionCard>
      <div className="grid gap-4 @lg:grid-cols-2">
        <TextareaField
          control={form.control}
          name="comments"
          label={part === 'self' ? 'Overall Comments' : 'Manager Comments'}
          placeholder={
            part === 'self'
              ? 'What went well, what got in the way'
              : 'The year in a few lines, for the employee'
          }
        />
        {part === 'manager' && (
          <TextareaField
            control={form.control}
            name="developmentNeeds"
            label="Development Needs"
            placeholder="Training or support for the next cycle"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={onDone} className={cancelButtonClass}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={save.isPending}
          onClick={() => void saveDraft()}
          className={secondaryButtonClass}
        >
          Save Draft
        </Button>
        <Button type="submit" disabled={save.isPending} className={saveButtonClass}>
          Submit Review
        </Button>
        {form.formState.errors.root?.message && (
          <p role="alert" className="basis-full text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
      </div>
      {confirming && (
        <ConfirmAction
          title={part === 'self' ? 'Submit self review' : 'Submit manager review'}
          description={
            part === 'self'
              ? 'Submit your self review to your manager? You can’t change it afterwards.'
              : `Submit the review of ${appraisal.employeeName}? It goes for finalising and can’t change afterwards.`
          }
          confirmLabel="Submit"
          onConfirm={() => {
            void send(form.getValues(), true)
          }}
          onClose={() => {
            setConfirming(false)
          }}
        />
      )}
    </form>
  )
}

/**
 * A review opened from the list (`?review=<id>`): the self review for the employee while it is
 * theirs to write, the manager review for the reviewer once the self review is in, and a
 * read-only view of both otherwise.
 */
export function ReviewView({ reviewId, onBack }: { reviewId: string; onBack: () => void }) {
  const query = useReview(reviewId)
  const myId = useMyEmployeeId()
  const rights = useReviewRights()
  const appraisal = query.data
  const part = appraisal ? writablePart(appraisal, myId, rights) : null
  return (
    <>
      <BackButton label="Back to reviews" onClick={onBack} />
      {query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : !appraisal ? (
        <div className={cn(cardClass, 'p-5')}>
          <LoadingRows rows={5} label="the review" />
        </div>
      ) : (
        <>
          <PageHeaderCard
            title={
              part === 'self'
                ? 'Self Review'
                : part === 'manager'
                  ? 'Manager Review'
                  : `Review: ${appraisal.employeeName}`
            }
            description={[
              appraisal.employeeName,
              appraisal.jobTitleName,
              `${appraisal.cycleName} (${formatPeriod(appraisal.periodStart, appraisal.periodEnd)})`,
              appraisal.reviewerName ? `Reviewer ${appraisal.reviewerName}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            actions={<Chip meta={appraisalStatusMeta(appraisal)} />}
          />
          <div className={cn(cardClass, '@container p-4 sm:p-5')}>
            <StageSteps status={appraisal.status} hasSelfReview={appraisal.hasSelfReview} />
          </div>
          {part ? (
            <ReviewEditor
              key={appraisal.rowVersion}
              appraisal={appraisal}
              part={part}
              onDone={onBack}
            />
          ) : (
            <div className={cn(cardClass, '@container grid gap-4 p-4 sm:p-5')}>
              <ScoreTiles appraisal={appraisal} />
              <SectionCard title="Ratings" as="h2">
                <RatingsTable appraisal={appraisal} />
              </SectionCard>
              <AppraisalNotes appraisal={appraisal} />
              <SectionCard title="Goals" as="h2">
                <AppraisalGoals appraisal={appraisal} />
              </SectionCard>
            </div>
          )}
        </>
      )}
    </>
  )
}
