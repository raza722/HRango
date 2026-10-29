import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { DatePickerField, TextField } from '@/components/form'
import { SearchSelectField } from '@/features/payroll'
import { parseDateValue } from '@/lib/date'

import { useAppraisalForms, useSaveCycle } from '../../hooks/use-performance'
import {
  CYCLE_FIELD_OF,
  cycleFormSchema,
  cycleFormToInput,
  type CycleFormValues,
  cycleToForm,
} from '../../schemas/performance-forms.schema'
import type { AppraisalForm, Cycle } from '../../types/performance.types'
import { showServerErrors } from '../../utils/form-errors'
import { FormDialog } from '../shared/dialogs'
import { Facts } from '../shared/parts'

const FIELDS = Object.keys(cycleToForm(null))

/** What the chosen appraisal form brings: rating scale, self review, goals weight, criteria. */
function FormSummary({ form }: { form: AppraisalForm }) {
  return (
    <div className="@container grid gap-3 rounded-lg bg-[#F5F7FB] px-4 py-3 dark:bg-muted">
      <Facts
        items={[
          { label: 'Rating Scale', value: form.ratingScaleName },
          {
            label: 'Self Review',
            value: form.hasSelfReview ? 'Yes, then the manager' : 'No, manager only',
          },
          { label: 'Goals Weight', value: `${String(form.goalsWeight)}% of the final score` },
        ]}
      />
      {form.criteria.length > 0 && (
        <p className="text-xs text-grey">
          Criteria:{' '}
          {form.criteria
            .map((criterion) => `${criterion.name} (${String(criterion.weight)}%)`)
            .join(', ')}
        </p>
      )}
    </div>
  )
}

/**
 * Add / Edit Review Cycle (`CycleIn`): the name, the appraisal form (which sets the rating
 * scale, whether there is a self review and the goals weight), the period and the review due
 * dates. A launched cycle keeps its form.
 */
export function CycleFormDialog({ cycle, onClose }: { cycle: Cycle | null; onClose: () => void }) {
  const save = useSaveCycle()
  const forms = useAppraisalForms()
  const form = useForm<CycleFormValues>({
    resolver: zodResolver(cycleFormSchema),
    defaultValues: cycleToForm(cycle),
  })
  const [formId, startDate, selfDue] = useWatch({
    control: form.control,
    name: ['formId', 'startDate', 'selfReviewDueDate'],
  })
  const chosen = forms.data?.find((item) => item.id === formId)
  const hasSelfReview = chosen?.hasSelfReview ?? true
  const locked = cycle !== null && cycle.status !== 'draft'
  const options = (forms.data ?? [])
    .filter((item) => item.isActive || item.id === cycle?.formId)
    .map((item) => ({ value: item.id, label: item.name, hint: item.ratingScaleName }))

  const submit = form.handleSubmit(async (values) => {
    const picked = forms.data?.find((item) => item.id === values.formId)
    try {
      await save.mutateAsync({
        id: cycle?.id,
        input: cycleFormToInput(values, cycle, picked?.hasSelfReview ?? true),
      })
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS, CYCLE_FIELD_OF)
      return
    }
    onClose()
  })

  return (
    <FormDialog
      wide
      title={cycle ? 'Edit Review Cycle' : 'Add Review Cycle'}
      description={
        cycle
          ? `Edit ${cycle.name}.`
          : 'A review period: who takes part is added after, then the cycle is launched.'
      }
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel={cycle ? 'Save' : 'Add Cycle'}
      rootError={form.formState.errors.root?.message}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          placeholder="e.g. Annual Review 2027"
        />
        <SearchSelectField
          control={form.control}
          name="formId"
          label="Appraisal Form"
          required
          placeholder="Select Appraisal Form"
          options={options}
          disabled={locked}
        />
        {chosen && (
          <div className="@md:col-span-2">
            <FormSummary form={chosen} />
          </div>
        )}
        <DatePickerField control={form.control} name="startDate" label="Start Date" required />
        <DatePickerField
          control={form.control}
          name="endDate"
          label="End Date"
          required
          minDate={parseDateValue(startDate)}
        />
        {hasSelfReview && (
          <DatePickerField
            control={form.control}
            name="selfReviewDueDate"
            label="Self Review Due"
            minDate={parseDateValue(startDate)}
          />
        )}
        <DatePickerField
          control={form.control}
          name="managerReviewDueDate"
          label="Manager Review Due"
          minDate={parseDateValue(hasSelfReview && selfDue ? selfDue : startDate)}
        />
      </div>
      {locked && (
        <p className="text-xs text-muted-foreground">
          The cycle is launched, so its appraisal form can no longer change.
        </p>
      )}
    </FormDialog>
  )
}
