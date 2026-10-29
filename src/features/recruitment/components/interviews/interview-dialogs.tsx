import { type Control, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Star } from 'lucide-react'

import { FormField, SelectField, TextareaField } from '@/components/form'
import { SearchSelectField } from '@/features/payroll'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { toOptionalId } from '../../api/recruitment.mappers'
import { INTERVIEW_RESULT_META, RECOMMENDATION_LABELS } from '../../constants'
import { useCompleteInterview, useEvaluateInterview } from '../../hooks/use-recruitment'
import {
  completeFormSchema,
  type CompleteFormValues,
  evaluationFormSchema,
  type EvaluationFormValues,
} from '../../schemas/recruitment-forms.schema'
import {
  type Interview,
  INTERVIEW_RESULTS,
  type InterviewDetail,
  RECOMMENDATIONS,
} from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { blank } from '../../utils/format'
import { FormDialog } from '../shared/dialog-parts'
import { Segmented } from '../shared/segmented'

// --- complete -----------------------------------------------------------------------------------

/** Complete: held (with its result) or a no show, and remarks. */
export function CompleteDialog({
  interview,
  onClose,
}: {
  interview: Interview
  onClose: () => void
}) {
  const complete = useCompleteInterview()
  const form = useForm<CompleteFormValues>({
    resolver: zodResolver(completeFormSchema),
    defaultValues: { status: 'completed', result: '', remarks: '' },
  })
  const status = useWatch({ control: form.control, name: 'status' })
  const submit = form.handleSubmit(async (values) => {
    try {
      await complete.mutateAsync({
        record: interview,
        body: {
          status: values.status,
          result: values.status === 'completed' && values.result ? values.result : null,
          remarks: blank(values.remarks),
        },
      })
      onClose()
    } catch (error) {
      showServerErrors(error, form.setError, ['status', 'result', 'remarks'])
    }
  })
  return (
    <FormDialog
      title="Complete Interview"
      description={`${interview.applicantName} · round ${String(interview.roundNo)}, ${interview.title}`}
      onClose={onClose}
      onSubmit={submit}
      saving={complete.isPending}
      saveLabel="Complete"
      rootError={form.formState.errors.root?.message}
      className="max-w-xl"
    >
      <FormField label="Outcome">
        {() => (
          <Segmented
            label="Outcome"
            value={status}
            options={[
              { value: 'completed', label: 'Held' },
              { value: 'no_show', label: 'No show' },
            ]}
            onChange={(next) => {
              form.setValue('status', next)
              if (next === 'no_show') form.setValue('result', '')
            }}
          />
        )}
      </FormField>
      {status === 'completed' && (
        <SelectField
          control={form.control}
          name="result"
          label="Result"
          required
          placeholder="Select Result"
          options={INTERVIEW_RESULTS.map((value) => ({
            value,
            label: INTERVIEW_RESULT_META[value].label,
          }))}
        />
      )}
      <TextareaField
        control={form.control}
        name="remarks"
        label="Remarks"
        rows={3}
        maxLength={4000}
      />
    </FormDialog>
  )
}

// --- evaluation ---------------------------------------------------------------------------------

/** 1 to 5 stars as a radio group: each star is named ("3 out of 5"), so no colour is needed. */
function RatingField({ control }: { control: Control<EvaluationFormValues> }) {
  const { field, fieldState } = useController({ control, name: 'rating' })
  return (
    <FormField label="Rating" required error={fieldState.error?.message}>
      {(a11y) => (
        <div
          role="radiogroup"
          id={a11y.id}
          aria-describedby={a11y['aria-describedby']}
          aria-invalid={a11y['aria-invalid']}
          aria-label="Rating"
          className="flex flex-wrap items-center gap-1"
        >
          {[1, 2, 3, 4, 5].map((value) => {
            const on = field.value >= value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={field.value === value}
                aria-label={`${String(value)} out of 5`}
                onClick={() => {
                  field.onChange(value)
                }}
                className="rounded-sm p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    'size-6',
                    on ? 'fill-[#F5A035] text-[#F5A035]' : 'text-muted-foreground',
                  )}
                />
              </button>
            )
          })}
          <span className="ml-2 text-sm text-field-foreground">
            {field.value > 0 ? `${String(field.value)} / 5` : 'Not rated'}
          </span>
        </div>
      )}
    </FormField>
  )
}

/**
 * Evaluate: one interviewer's rating (1–5), recommendation, strengths, concerns and comments.
 * Saving again for the same interviewer replaces theirs. Starts with you when you are on the
 * panel and have not rated yet.
 */
export function EvaluationDialog({
  interview,
  onClose,
}: {
  interview: InterviewDetail
  onClose: () => void
}) {
  const evaluate = useEvaluateInterview()
  const me = useAuthStore((state) => state.user?.employeeId ?? null)
  const pending = interview.interviewers.filter((row) => !row.hasEvaluated)
  const first =
    interview.interviewers.find((row) => row.employeeId === me && !row.hasEvaluated) ??
    pending[0] ??
    interview.interviewers.find((row) => row.employeeId === me) ??
    interview.interviewers[0]
  const valuesFor = (employeeId: string | null): EvaluationFormValues => {
    const existing = interview.evaluations.find((row) => row.employeeId === employeeId)
    return {
      employeeId,
      rating: existing?.rating ?? 0,
      recommendation: existing?.recommendation ?? 'hire',
      strengths: existing?.strengths ?? '',
      concerns: existing?.concerns ?? '',
      comments: existing?.comments ?? '',
    }
  }
  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationFormSchema),
    defaultValues: valuesFor(first?.employeeId ?? null),
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await evaluate.mutateAsync({
        id: interview.id,
        body: {
          employeeId: toOptionalId(values.employeeId),
          rating: values.rating,
          recommendation: values.recommendation,
          strengths: blank(values.strengths),
          concerns: blank(values.concerns),
          comments: blank(values.comments),
        },
      })
      onClose()
    } catch (error) {
      showServerErrors(error, form.setError, [
        'employeeId',
        'rating',
        'recommendation',
        'strengths',
        'concerns',
        'comments',
      ])
    }
  })
  return (
    <FormDialog
      title="Evaluate Interview"
      description={`${interview.applicantName} · round ${String(interview.roundNo)}, ${interview.title}`}
      onClose={onClose}
      onSubmit={submit}
      saving={evaluate.isPending}
      saveLabel="Save Evaluation"
      rootError={form.formState.errors.root?.message}
    >
      <SearchSelectField
        control={form.control}
        name="employeeId"
        label="Interviewer"
        required
        options={interview.interviewers.map((row) => ({
          value: row.employeeId,
          label: row.employeeName,
          hint: row.hasEvaluated
            ? 'Evaluated (saving replaces it)'
            : (row.jobTitleName ?? 'Not evaluated yet'),
        }))}
        placeholder="Select Interviewer"
        onValueChange={(employeeId) => {
          form.reset(valuesFor(employeeId))
        }}
      />
      <RatingField control={form.control} />
      <SelectField
        control={form.control}
        name="recommendation"
        label="Recommendation"
        required
        options={RECOMMENDATIONS.map((value) => ({ value, label: RECOMMENDATION_LABELS[value] }))}
      />
      <TextareaField
        control={form.control}
        name="strengths"
        label="Strengths"
        rows={2}
        maxLength={4000}
      />
      <TextareaField
        control={form.control}
        name="concerns"
        label="Concerns"
        rows={2}
        maxLength={4000}
      />
      <TextareaField
        control={form.control}
        name="comments"
        label="Comments"
        rows={2}
        maxLength={4000}
      />
    </FormDialog>
  )
}
