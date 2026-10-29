import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextareaField, TextField } from '@/components/form'
import { UploadField } from '@/features/assets'
import { DateField, EmployeeSearchSelectField, RsField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'

import { GENDER_LABELS, RC_CODES, SOURCE_LABELS } from '../../constants'
import { useApplicant, useSaveApplicant } from '../../hooks/use-recruitment'
import {
  applicantFormSchema,
  type ApplicantFormValues,
  NAME_MAX,
} from '../../schemas/recruitment-forms.schema'
import { type Applicant, GENDERS, SOURCES } from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { applicantValues, toApplicantIn } from '../../utils/inputs'
import { DetailDialog, FieldRow, FormDialog } from '../shared/dialog-parts'
import { CityField } from '../shared/fields'

const FIELDS = Object.keys(applicantValues(undefined))

/**
 * Add / Edit Candidate (`ApplicantIn`): who they are, where they live, their career and pay, how
 * they found us (with the referrer for a referral), the CV (uploaded straight away to
 * `POST /files`, module recruitment, then saved as `cvFileId`) and notes.
 */
export function ApplicantFormDialog({
  id,
  onClose,
  onSaved,
}: {
  id: string | null
  onClose: () => void
  /** After a save (instead of `onClose`). */
  onSaved?: (applicant: Applicant) => void
}) {
  const applicant = useApplicant(id)
  if (id && !applicant.data) {
    return (
      <DetailDialog
        title="Edit Candidate"
        onClose={onClose}
        loading={applicant.isPending}
        error={applicant.error}
        onRetry={() => void applicant.refetch()}
        what="the candidate"
      >
        {null}
      </DetailDialog>
    )
  }
  return <ApplicantForm applicant={applicant.data} onClose={onClose} onSaved={onSaved} />
}

function ApplicantForm({
  applicant,
  onClose,
  onSaved,
}: {
  applicant: Applicant | undefined
  onClose: () => void
  onSaved?: ((applicant: Applicant) => void) | undefined
}) {
  const save = useSaveApplicant()
  const [cv, setCv] = useState<FileRef | null>(applicant?.cv ?? null)
  const form = useForm<ApplicantFormValues>({
    resolver: zodResolver(applicantFormSchema),
    defaultValues: applicantValues(applicant),
  })
  const source = useWatch({ control: form.control, name: 'source' })
  const [cvError, setCvError] = useState<string | undefined>()

  const submit = form.handleSubmit(async (values) => {
    setCvError(undefined)
    try {
      const saved = await save.mutateAsync({
        id: applicant?.id,
        input: toApplicantIn(values, cv, applicant?.rowVersion),
      })
      if (onSaved) onSaved(saved)
      else onClose()
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS)
      if (error instanceof ApiError && error.fieldErrors.cvFileId) {
        setCvError(error.fieldErrors.cvFileId)
      }
    }
  })

  return (
    <FormDialog
      title={applicant ? 'Edit Candidate' : 'Add Candidate'}
      description={applicant ? applicant.fullName : 'A person who may apply to your openings.'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      className="max-w-4xl"
    >
      <FieldRow>
        <TextField
          control={form.control}
          name="firstName"
          label="First Name"
          required
          maxLength={NAME_MAX}
        />
        <TextField
          control={form.control}
          name="lastName"
          label="Last Name"
          required
          maxLength={NAME_MAX}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          required
          maxLength={254}
        />
        <TextField control={form.control} name="phone" label="Phone" type="tel" maxLength={30} />
      </FieldRow>
      <FieldRow>
        <SelectField
          control={form.control}
          name="gender"
          label="Gender"
          placeholder="Select Gender"
          clearable
          options={GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }))}
        />
        <DateField control={form.control} name="dateOfBirth" label="Date of Birth" />
      </FieldRow>
      <CityField
        control={form.control}
        name="cityId"
        knownId={applicant?.cityId}
        knownName={applicant?.cityName}
      />
      <TextField control={form.control} name="address" label="Address" maxLength={500} />
      <FieldRow>
        <TextField
          control={form.control}
          name="currentJobTitle"
          label="Current Job Title"
          maxLength={200}
        />
        <TextField
          control={form.control}
          name="currentEmployer"
          label="Current Employer"
          maxLength={200}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          control={form.control}
          name="experienceYears"
          label="Experience (years)"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="noticePeriodDays"
          label="Notice Period (days)"
          inputMode="numeric"
        />
      </FieldRow>
      <FieldRow>
        <RsField control={form.control} name="currentSalary" label="Current Salary" />
        <RsField control={form.control} name="expectedSalary" label="Expected Salary" />
      </FieldRow>
      <FieldRow>
        <TextField
          control={form.control}
          name="highestEducation"
          label="Highest Education"
          maxLength={200}
        />
        <TextField
          control={form.control}
          name="linkedinUrl"
          label="LinkedIn"
          type="url"
          placeholder="https://www.linkedin.com/in/…"
          maxLength={500}
        />
      </FieldRow>
      <FieldRow>
        <SelectField
          control={form.control}
          name="source"
          label="Source"
          placeholder="Select Source"
          clearable
          options={SOURCES.map((value) => ({ value, label: SOURCE_LABELS[value] }))}
        />
        {source === 'referral' && (
          <EmployeeSearchSelectField
            control={form.control}
            name="referredByEmployeeId"
            label="Referred By"
            placeholder="Select Employee"
            required
            filters={{ permission: RC_CODES.people }}
            known={
              applicant?.referredByEmployeeId
                ? [
                    {
                      value: applicant.referredByEmployeeId,
                      label: applicant.referredByName ?? '',
                    },
                  ]
                : undefined
            }
          />
        )}
      </FieldRow>
      <UploadField
        label="CV / Resume"
        value={cv}
        onChange={setCv}
        module="recruitment"
        error={cvError}
      />
      <TextareaField control={form.control} name="notes" label="Notes" rows={3} maxLength={8000} />
    </FormDialog>
  )
}
