import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { DatePickerField, SelectField, TextareaField, TextField } from '@/components/form'

import { CHANGE_TYPE_LABELS, OUTCOME_LABELS } from '../../constants'
import { useFinaliseAppraisal } from '../../hooks/use-performance'
import {
  FINALISE_FIELD_OF,
  finaliseFormSchema,
  finaliseFormToInput,
  type FinaliseFormValues,
  finaliseToForm,
  suggestedFinalScore,
} from '../../schemas/performance-forms.schema'
import { type AppraisalDetail, CHANGE_TYPES, OUTCOMES } from '../../types/performance.types'
import { showServerErrors } from '../../utils/form-errors'
import { formatScore } from '../../utils/format'
import { labelForScore } from '../../utils/scores'
import { FormDialog } from '../shared/dialogs'

const FIELDS = Object.keys({
  finalScore: '',
  outcome: '',
  changeType: '',
  changeValue: '',
  effectiveDate: '',
  finalComments: '',
} satisfies Record<keyof FinaliseFormValues, string>)

/**
 * Finalise (`POST /performance/appraisals/{id}/finalise`): the final score (the suggestion from
 * the goals and manager scores, which HR may change within the scale), the outcome, an increment
 * for an increment or a promotion, and closing comments.
 */
export function FinaliseDialog({
  appraisal,
  onClose,
}: {
  appraisal: AppraisalDetail
  onClose: () => void
}) {
  const finalise = useFinaliseAppraisal()
  const scores = appraisal.scale.map((level) => level.score)
  const min = scores.length ? Math.min(...scores) : 0
  const max = scores.length ? Math.max(...scores) : 100
  const form = useForm<FinaliseFormValues>({
    resolver: zodResolver(finaliseFormSchema(min, max)),
    defaultValues: finaliseToForm(appraisal),
  })
  const [outcome, finalScore, changeType] = useWatch({
    control: form.control,
    name: ['outcome', 'finalScore', 'changeType'],
  })
  const suggestion = suggestedFinalScore(appraisal)
  const typed = Number(finalScore)
  const level =
    finalScore.trim() && Number.isFinite(typed) ? labelForScore(appraisal.scale, typed) : null
  const withIncrement = outcome === 'increment' || outcome === 'promotion'

  const submit = form.handleSubmit(async (values) => {
    try {
      await finalise.mutateAsync({
        id: appraisal.id,
        input: finaliseFormToInput(values, appraisal),
      })
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS, FINALISE_FIELD_OF)
      return
    }
    onClose()
  })

  return (
    <FormDialog
      title="Finalise Appraisal"
      description={`${appraisal.employeeName} · ${appraisal.cycleName}`}
      onClose={onClose}
      onSubmit={submit}
      saving={finalise.isPending}
      saveLabel="Finalise"
      rootError={form.formState.errors.root?.message}
    >
      <p className="rounded-lg bg-[#F5F7FB] px-4 py-3 text-xs leading-relaxed text-title dark:bg-muted">
        Suggested final score <strong>{formatScore(suggestion)}</strong>
        {appraisal.goalsScore !== null && appraisal.goalsWeight > 0
          ? ` — goals ${formatScore(appraisal.goalsScore)} × ${String(appraisal.goalsWeight)}% and manager review ${formatScore(appraisal.managerScore)} × ${String(100 - appraisal.goalsWeight)}%`
          : ` — the manager review`}
        . The scale runs from {formatScore(min)} to {formatScore(max)}.
      </p>
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="finalScore"
          label="Final Score"
          required
          inputMode="decimal"
          description={level ? `Rating: ${level}` : undefined}
        />
        <SelectField
          control={form.control}
          name="outcome"
          label="Outcome"
          required
          options={OUTCOMES.map((value) => ({ value, label: OUTCOME_LABELS[value] }))}
        />
        {withIncrement && (
          <>
            <SelectField
              control={form.control}
              name="changeType"
              label="Increment Type"
              options={CHANGE_TYPES.map((value) => ({ value, label: CHANGE_TYPE_LABELS[value] }))}
            />
            <TextField
              control={form.control}
              name="changeValue"
              label={changeType === 'percent' ? 'Increment (%)' : 'Increment Amount'}
              required={outcome === 'increment'}
              inputMode="decimal"
              placeholder={changeType === 'percent' ? 'e.g. 10' : 'e.g. 15000'}
            />
            <DatePickerField
              control={form.control}
              name="effectiveDate"
              label="Effective Date"
              required={outcome === 'increment'}
            />
          </>
        )}
        <TextareaField
          control={form.control}
          name="finalComments"
          label="Final Comments"
          placeholder="What was decided and why"
          className="@md:col-span-2"
        />
      </div>
    </FormDialog>
  )
}
