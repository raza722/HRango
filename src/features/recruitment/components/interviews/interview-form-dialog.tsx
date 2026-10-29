import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { startOfToday } from 'date-fns'

import { SelectField, TextareaField, TextField, TimePickerField } from '@/components/form'
import {
  DateField,
  EmployeeMultiSearchSelectField,
  type SearchOption,
  SearchSelectField,
} from '@/features/payroll'

import { INTERVIEW_MODE_LABELS, RC_CODES } from '../../constants'
import { useApplicationSearch } from '../../hooks/use-lookups'
import { useInterview, useSaveInterview } from '../../hooks/use-recruitment'
import {
  interviewFormSchema,
  type InterviewFormValues,
} from '../../schemas/recruitment-forms.schema'
import { INTERVIEW_MODES, type InterviewDetail } from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { interviewValues, toInterviewIn } from '../../utils/inputs'
import { withKnown } from '../../utils/options'
import { DetailDialog, FieldRow, FormDialog } from '../shared/dialog-parts'

const FIELDS = Object.keys(interviewValues(undefined, null))
const FIELD_OF = { scheduledAt: 'date' } as const

/**
 * Schedule / Edit Interview (`InterviewIn`): the application (fixed when scheduled from one), the
 * round's title, mode, date and time, length, venue or link, the interviewers and remarks.
 * Scheduling moves an earlier application to the Interview stage.
 */
export function InterviewFormDialog({
  id,
  application,
  onClose,
  onSaved,
}: {
  /** The interview to edit; null schedules a new one. */
  id: string | null
  /** Scheduling from an application: its id and how to name it. */
  application?: { id: string; label: string } | undefined
  onClose: () => void
  onSaved?: (interview: InterviewDetail) => void
}) {
  const query = useInterview(id)
  if (id && !query.data) {
    return (
      <DetailDialog
        title="Edit Interview"
        onClose={onClose}
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        what="the interview"
      >
        {null}
      </DetailDialog>
    )
  }
  return (
    <InterviewForm
      interview={query.data}
      application={application}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function InterviewForm({
  interview,
  application,
  onClose,
  onSaved,
}: {
  interview: InterviewDetail | undefined
  application: { id: string; label: string } | undefined
  onClose: () => void
  onSaved?: ((interview: InterviewDetail) => void) | undefined
}) {
  const save = useSaveInterview()
  const [text, setText] = useState('')
  const fixed = interview !== undefined || application !== undefined
  const search = useApplicationSearch(text, !fixed)
  // The date picker starts today: an interview is not booked in the past.
  const [firstDay] = useState(() => startOfToday())
  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(interviewFormSchema),
    defaultValues: interviewValues(
      interview
        ? { ...interview, interviewerIds: interview.interviewers.map((row) => row.employeeId) }
        : undefined,
      application?.id ?? null,
    ),
  })
  const applicationOptions: SearchOption[] = interview
    ? [
        {
          value: interview.applicationId,
          label: interview.applicantName,
          hint: interview.jobOpeningTitle,
        },
      ]
    : application
      ? [{ value: application.id, label: application.label }]
      : search.options

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: interview?.id,
        input: toInterviewIn(values, interview?.rowVersion),
      })
      if (onSaved) onSaved(saved)
      else onClose()
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS, FIELD_OF)
    }
  })

  return (
    <FormDialog
      title={interview ? 'Edit Interview' : 'Schedule Interview'}
      description={
        interview
          ? `${interview.applicantName} · round ${String(interview.roundNo)}`
          : 'The interviewers see it under Interviews (Mine).'
      }
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel={interview ? 'Save' : 'Schedule'}
      rootError={form.formState.errors.root?.message}
    >
      <SearchSelectField
        control={form.control}
        name="applicationId"
        label="Application"
        required
        disabled={fixed}
        options={withKnown(applicationOptions, form.getValues('applicationId'), application?.label)}
        placeholder="Select Application"
        onSearch={fixed ? undefined : setText}
        loading={search.loading}
      />
      <FieldRow>
        <TextField
          control={form.control}
          name="title"
          label="Title"
          placeholder="Technical interview"
          maxLength={200}
        />
        <SelectField
          control={form.control}
          name="mode"
          label="Mode"
          required
          options={INTERVIEW_MODES.map((value) => ({ value, label: INTERVIEW_MODE_LABELS[value] }))}
        />
      </FieldRow>
      <div className="grid gap-5 @xl:grid-cols-3">
        <DateField control={form.control} name="date" label="Date" required minDate={firstDay} />
        <TimePickerField control={form.control} name="time" label="Time" required step={300} />
        <TextField
          control={form.control}
          name="durationMinutes"
          label="Duration (minutes)"
          required
          inputMode="numeric"
        />
      </div>
      <TextField
        control={form.control}
        name="venue"
        label="Venue or Link"
        placeholder="Meeting room, address or video link"
        maxLength={500}
      />
      <EmployeeMultiSearchSelectField
        control={form.control}
        name="interviewerIds"
        label="Interviewers"
        placeholder="Select Interviewers"
        required
        filters={{ permission: RC_CODES.people }}
        known={interview?.interviewers.map((row) => ({
          value: row.employeeId,
          label: row.employeeName,
        }))}
      />
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
