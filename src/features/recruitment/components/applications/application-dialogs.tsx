import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextareaField, TextField } from '@/components/form'
import {
  DateField,
  EmployeeSearchSelectField,
  RsField,
  SearchSelectField,
} from '@/features/payroll'

import { toOptionalId } from '../../api/recruitment.mappers'
import { HIRE_STATUS_LABELS, RC_CODES, SOURCE_LABELS, STAGE_META } from '../../constants'
import {
  useApplicantSearch,
  useOpeningOptions,
  useOrgOptions,
  useReasonOptions,
} from '../../hooks/use-lookups'
import {
  useApplicant,
  useApplication,
  useCreateApplication,
  useHireApplication,
  useMoveApplication,
  useRejectApplication,
} from '../../hooks/use-recruitment'
import {
  applicationFormSchema,
  type ApplicationFormValues,
  type HireFormValues,
  makeHireFormSchema,
  moveFormSchema,
  type MoveFormValues,
  NAME_MAX,
  rejectFormSchema,
  type RejectFormValues,
} from '../../schemas/recruitment-forms.schema'
import {
  type Application,
  type ApplicationDetail,
  HIRE_STATUSES,
  MOVE_STAGES,
  type MoveStage,
  SOURCES,
} from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { blank, formatAmount, formatDay } from '../../utils/format'
import { toApplicationIn, toHireIn } from '../../utils/inputs'
import { withKnown } from '../../utils/options'
import { DetailDialog, FieldRow, FormDialog } from '../shared/dialog-parts'
import { Segmented } from '../shared/segmented'

// --- new application ----------------------------------------------------------------------------

const APPLICATION_FIELDS = [
  'jobOpeningId',
  'applicantId',
  'firstName',
  'lastName',
  'email',
  'phone',
  'appliedOn',
  'source',
  'coverLetter',
  'remarks',
]

/**
 * New Application (`ApplicationIn`): an open opening and an existing candidate (searched on the
 * server) or a new one added in the same call (name, email, phone).
 */
export function NewApplicationDialog({
  applicantId,
  jobOpeningId,
  onClose,
  onSaved,
}: {
  /** Prefilled from a candidate's page. */
  applicantId?: string | undefined
  jobOpeningId?: string | undefined
  onClose: () => void
  onSaved: (application: ApplicationDetail) => void
}) {
  const create = useCreateApplication()
  const openings = useOpeningOptions('open')
  const known = useApplicant(applicantId ?? null)
  const [text, setText] = useState('')
  const candidates = useApplicantSearch(text)
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      jobOpeningId: jobOpeningId ?? null,
      who: 'existing',
      applicantId: applicantId ?? null,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      appliedOn: '',
      source: '',
      coverLetter: '',
      remarks: '',
    },
  })
  const who = useWatch({ control: form.control, name: 'who' })

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await create.mutateAsync(toApplicationIn(values))
      onSaved(saved)
    } catch (error) {
      showServerErrors(error, form.setError, APPLICATION_FIELDS, {
        'applicant.firstName': 'firstName',
        'applicant.lastName': 'lastName',
        'applicant.email': 'email',
        'applicant.phone': 'phone',
      })
    }
  })

  return (
    <FormDialog
      title="New Application"
      description="Add a candidate to an open opening's pipeline. It starts at Applied."
      onClose={onClose}
      onSubmit={submit}
      saving={create.isPending}
      saveLabel="Add Application"
      rootError={form.formState.errors.root?.message}
    >
      <SearchSelectField
        control={form.control}
        name="jobOpeningId"
        label="Job Opening"
        required
        options={openings.options}
        placeholder={openings.isPending ? 'Loading openings…' : 'Select Opening'}
      />
      <Segmented
        label="Candidate"
        value={who}
        options={[
          { value: 'existing', label: 'Existing candidate' },
          { value: 'new', label: 'New candidate' },
        ]}
        onChange={(next) => {
          form.setValue('who', next)
          form.clearErrors()
        }}
      />
      {who === 'existing' ? (
        <SearchSelectField
          control={form.control}
          name="applicantId"
          label="Existing Candidate"
          required
          options={withKnown(candidates.options, known.data?.id, known.data?.fullName)}
          placeholder="Search by name or email"
          onSearch={setText}
          loading={candidates.loading}
        />
      ) : (
        <>
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
            <TextField
              control={form.control}
              name="phone"
              label="Phone"
              type="tel"
              maxLength={30}
            />
          </FieldRow>
        </>
      )}
      <FieldRow>
        <DateField control={form.control} name="appliedOn" label="Applied On" />
        <SelectField
          control={form.control}
          name="source"
          label="Source"
          placeholder="As the candidate's"
          clearable
          options={SOURCES.map((value) => ({ value, label: SOURCE_LABELS[value] }))}
        />
      </FieldRow>
      <TextareaField
        control={form.control}
        name="coverLetter"
        label="Cover Letter"
        rows={3}
        maxLength={8000}
      />
      <TextareaField
        control={form.control}
        name="remarks"
        label="Remarks"
        rows={2}
        maxLength={4000}
      />
    </FormDialog>
  )
}

// --- move ---------------------------------------------------------------------------------------

/** Move Stage: the stage (not the current one) and remarks for the timeline. */
export function MoveDialog({
  application,
  stage,
  onClose,
}: {
  application: Application
  /** Preselected (a board drop). */
  stage?: MoveStage | undefined
  onClose: () => void
}) {
  const move = useMoveApplication()
  const form = useForm<MoveFormValues>({
    resolver: zodResolver(moveFormSchema),
    defaultValues: {
      stage: stage ?? MOVE_STAGES.find((value) => value !== application.stage) ?? 'applied',
      remarks: '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await move.mutateAsync({
        record: application,
        body: { stage: values.stage, remarks: blank(values.remarks) },
      })
      onClose()
    } catch (error) {
      showServerErrors(error, form.setError, ['stage', 'remarks'])
    }
  })
  return (
    <FormDialog
      title="Move Stage"
      description={`${application.applicantName} · now ${STAGE_META[application.stage].label}`}
      onClose={onClose}
      onSubmit={submit}
      saving={move.isPending}
      saveLabel="Move"
      rootError={form.formState.errors.root?.message}
      className="max-w-xl"
    >
      <SelectField
        control={form.control}
        name="stage"
        label="Move to"
        required
        options={MOVE_STAGES.filter((value) => value !== application.stage).map((value) => ({
          value,
          label: STAGE_META[value].label,
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

// --- reject -------------------------------------------------------------------------------------

/** Reject: a reason from Settings → Rejection Reasons (active ones) and remarks. */
export function RejectDialog({
  application,
  onClose,
}: {
  application: Application
  onClose: () => void
}) {
  const reject = useRejectApplication()
  const reasons = useReasonOptions()
  const form = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: { rejectionReasonId: null, remarks: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await reject.mutateAsync({
        record: application,
        body: {
          rejectionReasonId: toOptionalId(values.rejectionReasonId),
          remarks: blank(values.remarks),
        },
      })
      onClose()
    } catch (error) {
      showServerErrors(error, form.setError, ['rejectionReasonId', 'remarks'])
    }
  })
  return (
    <FormDialog
      title="Reject Application"
      description={`${application.applicantName} · ${application.jobOpeningTitle}`}
      onClose={onClose}
      onSubmit={submit}
      saving={reject.isPending}
      saveLabel="Reject"
      rootError={form.formState.errors.root?.message}
      className="max-w-xl"
    >
      <p className="text-sm text-heading">
        The application leaves the pipeline at {STAGE_META[application.stage].label}; nothing moves
        it afterwards.
      </p>
      <SearchSelectField
        control={form.control}
        name="rejectionReasonId"
        label="Reason"
        required
        options={reasons.options}
        placeholder={reasons.isPending ? 'Loading reasons…' : 'Select Reason'}
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

// --- hire ---------------------------------------------------------------------------------------

const HIRE_FIELDS = [
  'code',
  'joiningDate',
  'branchId',
  'departmentId',
  'designationId',
  'jobTitleId',
  'employmentTypeId',
  'lineManagerId',
  'salary',
  'status',
  'probationEndDate',
  'cnic',
  'remarks',
]

/**
 * Hire (`HireIn`): creates the employee from the application. The accepted offer fills the
 * placement, joining date and salary; blank fields take the offer's or the opening's values on
 * the server (the line manager defaults to the opening's hiring manager).
 */
export function HireDialog({
  application,
  onClose,
  onHired,
}: {
  application: ApplicationDetail
  onClose: () => void
  onHired: (application: ApplicationDetail) => void
}) {
  const hire = useHireApplication()
  const org = useOrgOptions([
    'job-titles',
    'designations',
    'departments',
    'branches',
    'employment-types',
  ])
  const offer = application.offers.find((row) => row.status === 'accepted')
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  // The server takes the offer's or the opening's branch; without either, one must be chosen.
  const branchRequired = !offer?.branchId && !application.branchId
  const [schema] = useState(() => makeHireFormSchema({ branchRequired }))
  const form = useForm<HireFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      joiningDate: offer?.joiningDate ?? today,
      branchId: offer?.branchId ?? application.branchId,
      departmentId: offer?.departmentId ?? application.departmentId,
      designationId: offer?.designationId ?? null,
      jobTitleId: offer?.jobTitleId ?? null,
      employmentTypeId: offer?.employmentTypeId ?? null,
      lineManagerId: null,
      salary: offer ? String(offer.offeredSalary) : '',
      status: 'probation',
      probationEndDate: '',
      cnic: '',
      remarks: '',
    },
  })
  const status = useWatch({ control: form.control, name: 'status' })
  const submit = form.handleSubmit(async (values) => {
    try {
      const hired = await hire.mutateAsync({ record: application, body: toHireIn(values) })
      onHired(hired)
    } catch (error) {
      showServerErrors(error, form.setError, HIRE_FIELDS)
    }
  })
  return (
    <FormDialog
      title="Hire"
      description={`${application.applicantName} joins as an employee (Talent Management).`}
      onClose={onClose}
      onSubmit={submit}
      saving={hire.isPending}
      saveLabel="Hire"
      rootError={form.formState.errors.root?.message}
    >
      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-heading">
        {offer
          ? `Accepted offer: Rs ${formatAmount(offer.offeredSalary)}, joining ${formatDay(offer.joiningDate)}.`
          : 'No accepted offer: blank fields take the opening’s values.'}
      </p>
      <FieldRow>
        <TextField
          control={form.control}
          name="code"
          label="Employee Code"
          placeholder="Next number when left blank"
          maxLength={30}
        />
        <DateField control={form.control} name="joiningDate" label="Joining Date" required />
      </FieldRow>
      <FieldRow>
        <SearchSelectField
          control={form.control}
          name="branchId"
          label="Branch"
          required={branchRequired}
          options={withKnown(org.branches, application.branchId, application.branchName)}
          placeholder={branchRequired ? 'Select Branch' : 'As the offer / opening'}
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="departmentId"
          label="Department"
          options={withKnown(org.departments, application.departmentId, application.departmentName)}
          placeholder="As the offer / opening"
          clearable
        />
      </FieldRow>
      <FieldRow>
        <SearchSelectField
          control={form.control}
          name="jobTitleId"
          label="Job Title"
          options={withKnown(org['job-titles'], offer?.jobTitleId, offer?.jobTitleName)}
          placeholder="As the offer / opening"
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="designationId"
          label="Designation"
          options={withKnown(org.designations, offer?.designationId, offer?.designationName)}
          placeholder="As the offer / opening"
          clearable
        />
      </FieldRow>
      <FieldRow>
        <EmployeeSearchSelectField
          control={form.control}
          name="lineManagerId"
          label="Line Manager"
          placeholder="The hiring manager"
          filters={{ permission: RC_CODES.people }}
          clearable
        />
        <RsField control={form.control} name="salary" label="Salary" />
      </FieldRow>
      <FieldRow>
        <SelectField
          control={form.control}
          name="status"
          label="Starts"
          required
          options={HIRE_STATUSES.map((value) => ({ value, label: HIRE_STATUS_LABELS[value] }))}
        />
        {status === 'probation' && (
          <DateField control={form.control} name="probationEndDate" label="Probation Ends" />
        )}
      </FieldRow>
      <TextField
        control={form.control}
        name="cnic"
        label="CNIC"
        placeholder="35202-1234567-1"
        maxLength={15}
      />
      <TextareaField
        control={form.control}
        name="remarks"
        label="Remarks"
        rows={2}
        maxLength={4000}
      />
    </FormDialog>
  )
}

/** Hire from a card or row: reads the application's offers first, then opens Hire. */
export function HireFromRow({
  application,
  onClose,
  onHired,
}: {
  application: Application
  onClose: () => void
  onHired: (application: ApplicationDetail) => void
}) {
  const detail = useApplication(application.id)
  if (!detail.data) {
    return (
      <DetailDialog
        title="Hire"
        onClose={onClose}
        loading={detail.isPending}
        error={detail.error}
        onRetry={() => void detail.refetch()}
        what="the application"
      >
        {null}
      </DetailDialog>
    )
  }
  return <HireDialog application={detail.data} onClose={onClose} onHired={onHired} />
}
