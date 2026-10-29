import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { startOfToday } from 'date-fns'

import { SelectField, TextareaField, TextField } from '@/components/form'
import { UploadField } from '@/features/assets'
import { DateField, RsField, type SearchOption, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'

import { SALARY_FREQUENCY_LABELS } from '../../constants'
import { useApplicationSearch, useOrgOptions } from '../../hooks/use-lookups'
import { useOffer, useOpening, useSaveOffer } from '../../hooks/use-recruitment'
import { offerFormSchema, type OfferFormValues } from '../../schemas/recruitment-forms.schema'
import { type Application, type Offer, SALARY_FREQUENCIES } from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { offerValues, toOfferIn } from '../../utils/inputs'
import { withKnown } from '../../utils/options'
import { DetailDialog, FieldRow, FormDialog } from '../shared/dialog-parts'

const FIELDS = Object.keys(offerValues(undefined, null))

/** The application an offer is made from (fixed), with what it prefills. */
export type OfferApplication = Pick<
  Application,
  'id' | 'applicantName' | 'jobOpeningId' | 'jobOpeningTitle' | 'departmentId' | 'branchId'
>

/**
 * New / Edit Offer (`OfferIn`): the application, the placement (job title, designation,
 * department, branch, employment type), salary and how often it is paid, joining date, probation,
 * when the offer expires, the offer letter (uploaded to `POST /files`) and remarks. A new offer is
 * a draft until it is sent.
 */
export function OfferFormDialog({
  id,
  application,
  onClose,
  onSaved,
}: {
  /** The offer to edit; null makes a new one. */
  id: string | null
  application?: OfferApplication | undefined
  onClose: () => void
  onSaved?: (offer: Offer) => void
}) {
  const offer = useOffer(id)
  // A new offer from an application takes its opening's placement.
  const opening = useOpening(!id && application ? application.jobOpeningId : null)
  const waiting =
    (id !== null && !offer.data) || (!id && application !== undefined && opening.isPending)
  if (waiting) {
    return (
      <DetailDialog
        title={id ? 'Edit Offer' : 'New Offer'}
        onClose={onClose}
        loading={id ? offer.isPending : opening.isPending}
        error={offer.error}
        onRetry={() => void offer.refetch()}
        what="the offer"
      >
        {null}
      </DetailDialog>
    )
  }
  const defaults: Partial<OfferFormValues> = application
    ? {
        departmentId: application.departmentId,
        branchId: application.branchId,
        jobTitleId: opening.data?.jobTitleId ?? null,
        designationId: opening.data?.designationId ?? null,
        employmentTypeId: opening.data?.employmentTypeId ?? null,
      }
    : {}
  return (
    <OfferForm
      offer={offer.data}
      application={application}
      defaults={defaults}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function OfferForm({
  offer,
  application,
  defaults,
  onClose,
  onSaved,
}: {
  offer: Offer | undefined
  application: OfferApplication | undefined
  defaults: Partial<OfferFormValues>
  onClose: () => void
  onSaved?: ((offer: Offer) => void) | undefined
}) {
  const save = useSaveOffer()
  const org = useOrgOptions([
    'job-titles',
    'designations',
    'departments',
    'branches',
    'employment-types',
  ])
  const [text, setText] = useState('')
  const fixed = offer !== undefined || application !== undefined
  const search = useApplicationSearch(text, !fixed)
  const [letter, setLetter] = useState<FileRef | null>(offer?.offerLetter ?? null)
  const [letterError, setLetterError] = useState<string | undefined>()
  // The date pickers start today: an offer does not join or expire in the past.
  const [firstDay] = useState(() => startOfToday())
  const form = useForm<OfferFormValues>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: offerValues(offer, application?.id ?? null, defaults),
  })
  const applicationOptions: SearchOption[] = offer
    ? [{ value: offer.applicationId, label: offer.applicantName, hint: offer.jobOpeningTitle }]
    : application
      ? [
          {
            value: application.id,
            label: application.applicantName,
            hint: application.jobOpeningTitle,
          },
        ]
      : search.options

  /** Picking an application fills the placement from its opening's department and branch. */
  const pick = (applicationId: string | null) => {
    const row = search.rows.find((item) => item.id === applicationId)
    if (!row) return
    if (!form.getValues('departmentId')) form.setValue('departmentId', row.departmentId)
    if (!form.getValues('branchId')) form.setValue('branchId', row.branchId)
  }

  const submit = form.handleSubmit(async (values) => {
    setLetterError(undefined)
    try {
      const saved = await save.mutateAsync({
        id: offer?.id,
        input: toOfferIn(values, letter, offer?.rowVersion),
      })
      if (onSaved) onSaved(saved)
      else onClose()
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS)
      if (error instanceof ApiError && error.fieldErrors.offerLetterFileId) {
        setLetterError(error.fieldErrors.offerLetterFileId)
      }
    }
  })

  return (
    <FormDialog
      title={offer ? 'Edit Offer' : 'New Offer'}
      description={
        offer
          ? `${offer.applicantName} · ${offer.jobOpeningTitle}`
          : 'Saved as a draft; Send it when it is ready.'
      }
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
    >
      <SearchSelectField
        control={form.control}
        name="applicationId"
        label="Application"
        required
        disabled={fixed}
        options={applicationOptions}
        placeholder="Select Application"
        onSearch={fixed ? undefined : setText}
        loading={search.loading}
        onValueChange={pick}
      />
      <FieldRow>
        <SearchSelectField
          control={form.control}
          name="jobTitleId"
          label="Job Title"
          options={withKnown(org['job-titles'], offer?.jobTitleId, offer?.jobTitleName)}
          placeholder="As the opening"
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="designationId"
          label="Designation"
          options={withKnown(
            org.designations,
            offer?.designationId ?? defaults.designationId,
            offer?.designationName,
          )}
          placeholder="As the opening"
          clearable
        />
      </FieldRow>
      <FieldRow>
        <SearchSelectField
          control={form.control}
          name="departmentId"
          label="Department"
          options={withKnown(org.departments, offer?.departmentId, offer?.departmentName)}
          placeholder="As the opening"
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="branchId"
          label="Branch"
          options={withKnown(org.branches, offer?.branchId, offer?.branchName)}
          placeholder="As the opening"
          clearable
        />
      </FieldRow>
      {(org['employment-types'].length > 0 || offer?.employmentTypeId) && (
        <SearchSelectField
          control={form.control}
          name="employmentTypeId"
          label="Employment Type"
          options={withKnown(
            org['employment-types'],
            offer?.employmentTypeId,
            offer?.employmentTypeName,
          )}
          placeholder="Select Employment Type"
          clearable
        />
      )}
      <FieldRow>
        <RsField control={form.control} name="offeredSalary" label="Offered Salary" required />
        <SelectField
          control={form.control}
          name="salaryFrequency"
          label="Paid"
          required
          options={SALARY_FREQUENCIES.map((value) => ({
            value,
            label: SALARY_FREQUENCY_LABELS[value],
          }))}
        />
      </FieldRow>
      <div className="grid gap-5 @xl:grid-cols-3">
        <DateField
          control={form.control}
          name="joiningDate"
          label="Joining Date"
          required
          minDate={firstDay}
        />
        <DateField
          control={form.control}
          name="expiresOn"
          label="Offer Expires On"
          minDate={firstDay}
        />
        <TextField
          control={form.control}
          name="probationMonths"
          label="Probation (months)"
          inputMode="numeric"
        />
      </div>
      <UploadField
        label="Offer Letter"
        value={letter}
        onChange={setLetter}
        module="recruitment"
        error={letterError}
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
