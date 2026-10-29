import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { CheckboxField, SelectField, TextareaField, TextField } from '@/components/form'
import {
  DateField,
  EmployeeSearchSelectField,
  RsField,
  SearchSelectField,
} from '@/features/payroll'

import { RC_CODES, WORK_MODE_LABELS } from '../../constants'
import { useOpenPositionOptions, useOrgOptions } from '../../hooks/use-lookups'
import { useOpening, useSaveOpening } from '../../hooks/use-recruitment'
import { openingFormSchema, type OpeningFormValues } from '../../schemas/recruitment-forms.schema'
import { type Opening, WORK_MODES } from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { openingValues, toOpeningIn } from '../../utils/inputs'
import { withKnown } from '../../utils/options'
import { DetailDialog, FieldRow, FormDialog } from '../shared/dialog-parts'
import { CityField } from '../shared/fields'

const FIELDS = Object.keys(openingValues(undefined))

/**
 * New / Edit Opening (`OpeningIn`): the role (title, open position, job title, designation,
 * department, branch, hiring manager, city, work mode), how many and how experienced, the salary
 * band, the dates and the text. A new opening starts as a draft.
 */
export function OpeningFormDialog({
  id,
  onClose,
  onSaved,
}: {
  /** null: a new opening. */
  id: string | null
  onClose: () => void
  /** After a save (instead of `onClose`), e.g. to open the new record. */
  onSaved?: (opening: Opening) => void
}) {
  const opening = useOpening(id)
  if (id && !opening.data) {
    return (
      <DetailDialog
        title="Edit Opening"
        onClose={onClose}
        loading={opening.isPending}
        error={opening.error}
        onRetry={() => void opening.refetch()}
        what="the opening"
      >
        {null}
      </DetailDialog>
    )
  }
  return <OpeningForm opening={opening.data} onClose={onClose} onSaved={onSaved} />
}

function OpeningForm({
  opening,
  onClose,
  onSaved,
}: {
  opening: Opening | undefined
  onClose: () => void
  onSaved?: ((opening: Opening) => void) | undefined
}) {
  const save = useSaveOpening()
  const org = useOrgOptions([
    'job-titles',
    'designations',
    'departments',
    'branches',
    'employment-types',
  ])
  const positions = useOpenPositionOptions()
  const form = useForm<OpeningFormValues>({
    resolver: zodResolver(openingFormSchema),
    defaultValues: openingValues(opening),
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: opening?.id,
        input: toOpeningIn(values, opening?.rowVersion),
      })
      if (onSaved) onSaved(saved)
      else onClose()
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS)
    }
  })

  /** Picking an open position fills an empty title and the vacancies from it. */
  const pickPosition = (positionId: string | null) => {
    const row = positions.rows.find((item) => item.id === positionId)
    if (!row) return
    if (!form.getValues('title').trim()) form.setValue('title', row.title)
    form.setValue('vacancies', String(Math.max(1, row.totalPositions)))
  }

  return (
    <FormDialog
      title={opening ? 'Edit Opening' : 'New Opening'}
      description={
        opening
          ? `${opening.code} · ${opening.title}`
          : 'A new opening is saved as a draft; publish it to take applications.'
      }
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      className="max-w-4xl"
    >
      <FieldRow>
        <TextField control={form.control} name="title" label="Job Title" required maxLength={200} />
        <TextField
          control={form.control}
          name="code"
          label="Code"
          placeholder="Next number when left blank"
          maxLength={30}
        />
      </FieldRow>
      <SearchSelectField
        control={form.control}
        name="openPositionId"
        label="Open Position (Manpower Planning)"
        options={withKnown(positions.options, opening?.openPositionId, opening?.openPositionTitle)}
        placeholder="Select Open Position"
        clearable
        onValueChange={pickPosition}
      />
      <FieldRow>
        <SearchSelectField
          control={form.control}
          name="jobTitleId"
          label="Job Title (organisation)"
          options={withKnown(org['job-titles'], opening?.jobTitleId, opening?.jobTitleName)}
          placeholder="Select Job Title"
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="designationId"
          label="Designation"
          options={withKnown(org.designations, opening?.designationId, opening?.designationName)}
          placeholder="Select Designation"
          clearable
        />
      </FieldRow>
      <FieldRow>
        <SearchSelectField
          control={form.control}
          name="departmentId"
          label="Department"
          options={withKnown(org.departments, opening?.departmentId, opening?.departmentName)}
          placeholder="Select Department"
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="branchId"
          label="Branch"
          options={withKnown(org.branches, opening?.branchId, opening?.branchName)}
          placeholder="Select Branch"
          clearable
        />
      </FieldRow>
      <FieldRow>
        <EmployeeSearchSelectField
          control={form.control}
          name="hiringManagerId"
          label="Hiring Manager"
          placeholder="Select Hiring Manager"
          filters={{ permission: RC_CODES.people }}
          known={
            opening?.hiringManagerId
              ? [{ value: opening.hiringManagerId, label: opening.hiringManagerName ?? '' }]
              : undefined
          }
          clearable
        />
        <SelectField
          control={form.control}
          name="workMode"
          label="Work Mode"
          placeholder="Select Work Mode"
          clearable
          options={WORK_MODES.map((value) => ({ value, label: WORK_MODE_LABELS[value] }))}
        />
      </FieldRow>
      {(org['employment-types'].length > 0 || opening?.employmentTypeId) && (
        <SearchSelectField
          control={form.control}
          name="employmentTypeId"
          label="Employment Type"
          options={withKnown(
            org['employment-types'],
            opening?.employmentTypeId,
            opening?.employmentTypeName,
          )}
          placeholder="Select Employment Type"
          clearable
        />
      )}
      <CityField
        control={form.control}
        name="cityId"
        knownId={opening?.cityId}
        knownName={opening?.cityName}
      />
      <div className="grid gap-5 @xl:grid-cols-3">
        <TextField
          control={form.control}
          name="vacancies"
          label="Vacancies"
          required
          inputMode="numeric"
        />
        <TextField
          control={form.control}
          name="experienceFromYears"
          label="Experience from (years)"
          inputMode="numeric"
        />
        <TextField
          control={form.control}
          name="experienceToYears"
          label="Experience to (years)"
          inputMode="numeric"
        />
      </div>
      <FieldRow>
        <RsField control={form.control} name="salaryFrom" label="Salary from" />
        <RsField control={form.control} name="salaryTo" label="Salary to" />
      </FieldRow>
      <CheckboxField
        control={form.control}
        name="isSalaryVisible"
        label="Show the salary band on the job post"
      />
      <div className="grid gap-5 @xl:grid-cols-3">
        <DateField control={form.control} name="postedOn" label="Posted On" />
        <DateField control={form.control} name="applyBy" label="Apply By" />
        <DateField control={form.control} name="closeOn" label="Close On" />
      </div>
      <TextareaField
        control={form.control}
        name="description"
        label="Description"
        rows={4}
        maxLength={8000}
      />
      <TextareaField
        control={form.control}
        name="requirements"
        label="Requirements"
        description="One per line."
        rows={4}
        maxLength={8000}
      />
    </FormDialog>
  )
}
