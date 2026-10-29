import { type SyntheticEvent, useEffect, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { btn, DateField, footerButton, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../api/backend'
import { engineApi } from '../../api/engine.api'
import type { PersonOption } from '../../api/lookups.api'
import {
  useCreateRequest,
  useLocationBranches,
  useRequestDetail,
  useTransferLookups,
  useUpdateRequest,
} from '../../hooks/use-requests'
import type { TransferRequest } from '../../types/requests.types'
import { sanitizeApplication, transferLetter } from '../../utils/transfer-letter'
import { useRequestPerson } from '../shared/request-employee'
import { RequestEmployeeField } from '../shared/request-employee-field'
import { RequestFileField, RequestFileLinks } from '../shared/request-files'
import { ApplicationEditor } from './application-editor'
import { TransferDialogShell } from './transfer-dialog-shell'
import { readOnlyFieldsClass } from './transfer-styles'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    employeeId: chosen('Choose the employee'),
    locationId: chosen('Choose the location'),
    branchId: chosen('Choose the branch'),
    departmentId: chosen('Choose the department'),
    lineManagerId: chosen('Choose the line manager'),
    finalAuthorityId: chosen('Choose the final authority'),
    effectiveDate: z.string().min(1, 'Choose the effective date'),
    description: z.string().trim().max(4000, 'Keep it under 4000 characters'),
    application: z.string().max(20_000, 'The application is too long'),
    /** Where the person works now (read, not chosen), once it is known. */
    current: z.object({ branchId: z.string().nullable(), departmentId: z.string().nullable() }),
  })
  .superRefine((values, ctx) => {
    // A move to the same branch and department is no transfer (the API refuses it too).
    if (
      values.branchId &&
      values.departmentId &&
      values.branchId === values.current.branchId &&
      values.departmentId === values.current.departmentId
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['branchId'],
        message: 'The employee already works in this branch and department. Choose another.',
      })
    }
  })
type Values = z.infer<typeof schema>

const FIELDS = [
  'employeeId',
  'locationId',
  'branchId',
  'departmentId',
  'lineManagerId',
  'finalAuthorityId',
  'effectiveDate',
  'description',
] as const

type Mode = 'create' | 'edit' | 'view'

const TITLES: Record<Mode, string> = {
  create: 'Transfer Request Create',
  edit: 'Transfer Request Edit',
  // The design's greyed-out frame is titled "Transfer Request Edit"; it is the View.
  view: 'Transfer Request View',
}

const toValues = (request: TransferRequest | undefined): Values => ({
  employeeId: request?.employee.id ?? null,
  locationId: request?.payload.locationId ?? null,
  branchId: request?.payload.branchId ?? null,
  departmentId: request?.payload.departmentId ?? null,
  lineManagerId: request?.payload.lineManagerId ?? null,
  finalAuthorityId: request?.payload.finalAuthorityId ?? null,
  effectiveDate: request?.payload.effectiveDate ?? '',
  description: request?.description ?? '',
  application: request?.application ?? '',
  current: { branchId: null, departmentId: null },
})

const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * "Transfer Request Create" / Edit / View: Employee Name, the new Location,
 * Branch (of that location) and Department, Line Manager, Final Authority,
 * Effective Date, Attachment and Description, with the Application beside.
 * Sent as `details { locationId, branchId, departmentId, lineManagerId,
 * finalAuthorityId, effectiveDate }` with the letter as `application`.
 */
export function TransferRequestDialog({
  mode,
  request,
  onClose,
}: {
  mode: Mode
  request?: TransferRequest | undefined
  onClose: () => void
}) {
  const formId = useId()
  const lookups = useTransferLookups()
  const detail = useRequestDetail('transfer', request?.id ?? '', 'request')
  const create = useCreateRequest('transfer')
  const update = useUpdateRequest('transfer')
  const [letterError, setLetterError] = useState<string | null>(null)
  const [file, setFile] = useState<FileRef | null>(null)
  const readOnly = mode === 'view'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(request) })
  const [employeeId, locationId, application] = useWatch({
    control: form.control,
    name: ['employeeId', 'locationId', 'application'],
  })
  const locationBranches = useLocationBranches(locationId)

  const movable = typePermission('transfer', 'create')
  const directory = 'employees.directory.view'
  // Whom the pickers chose (from the pages they read), for the letter.
  const person = useRequestPerson(movable, employeeId)
  const [lineManagerId, finalAuthorityId] = useWatch({
    control: form.control,
    name: ['lineManagerId', 'finalAuthorityId'],
  })
  const lineManager = useRequestPerson(directory, lineManagerId)
  const authority = useRequestPerson(directory, finalAuthorityId)
  const hint = (item: PersonOption) => `${item.code} · ${item.department}`
  const locations = (lookups.data?.locations ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  // The location's branches (`?parentId=`); a row naming another location is left out.
  const branches = (locationBranches.data ?? [])
    .filter((item) => !item.parentId || item.parentId === locationId)
    .map((item) => ({ value: item.id, label: item.name }))
  const departments = (lookups.data?.departments ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  const existing = detail.data?.request.attachments ?? []
  // Where the person works now: the picked person's lookup row, or (a saved request) the
  // branch and department its employee card names.
  const currentBranchId =
    person?.branchId ??
    lookups.data?.branches.find((item) => item.name === request?.employee.branch)?.id ??
    null
  const currentDepartmentId =
    person?.departmentId ??
    lookups.data?.departments.find((item) => item.name === request?.employee.department)?.id ??
    null
  useEffect(() => {
    form.setValue('current', { branchId: currentBranchId, departmentId: currentDepartmentId })
  }, [form, currentBranchId, currentDepartmentId])

  const regenerate = () => {
    const values = form.getValues()
    const location = lookups.data?.locations.find((item) => item.id === values.locationId)
    const branch = locationBranches.data?.find((item) => item.id === values.branchId)
    const department = lookups.data?.departments.find((item) => item.id === values.departmentId)
    const employeeName = person?.name ?? (request ? request.employee.name : null)
    const authorityName = authority?.name ?? request?.payload.finalAuthorityName ?? null
    if (
      !employeeName ||
      !authorityName ||
      !location ||
      !branch ||
      !department ||
      !values.effectiveDate
    ) {
      setLetterError(
        'Choose the employee, location, branch, department, final authority and effective date first.',
      )
      return
    }
    setLetterError(null)
    // Where the person works now: the lookup gives the branch and department.
    const from = request
      ? {
          location: request.employee.location,
          branch: request.employee.branch,
          department: request.employee.department,
        }
      : { location: null, branch: person?.branch ?? null, department: person?.department ?? '' }
    form.setValue(
      'application',
      transferLetter({
        employee: employeeName,
        finalAuthority: authorityName,
        effectiveDate: values.effectiveDate,
        from,
        to: { location: location.name, branch: branch.name, department: department.name },
        lineManager: lineManager?.name ?? request?.payload.lineManagerName ?? null,
        description: values.description,
      }),
      { shouldDirty: true },
    )
  }

  const submit = form.handleSubmit(async (values) => {
    const body: RequestBody = {
      ...(values.employeeId && !request ? { employeeId: values.employeeId } : {}),
      fromDate: values.effectiveDate,
      toDate: values.effectiveDate,
      description: values.description.trim() || null,
      application: sanitizeApplication(values.application) || null,
      details: {
        locationId: values.locationId,
        branchId: values.branchId,
        departmentId: values.departmentId,
        lineManagerId: values.lineManagerId,
        finalAuthorityId: values.finalAuthorityId,
        effectiveDate: values.effectiveDate,
      },
    }
    try {
      if (request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        if (file) await engineApi.addAttachment('transfer', request.id, file.id)
      } else {
        await create.mutateAsync({ ...body, attachments: file ? [file.id] : [] })
      }
      onClose()
    } catch (error) {
      const field =
        error instanceof ApiError ? FIELDS.find((name) => error.fieldErrors[name]) : undefined
      if (error instanceof ApiError && field) {
        form.setError(field, { message: error.fieldErrors[field] })
      } else {
        form.setError('root', {
          message:
            error instanceof ApiError ? error.message : 'Could not save the transfer request.',
        })
      }
    }
  })

  const rootError = form.formState.errors.root?.message
  const pending = create.isPending || update.isPending

  return (
    <TransferDialogShell
      title={TITLES[mode]}
      onClose={onClose}
      aside={
        <ApplicationEditor
          value={application}
          readOnly={readOnly}
          message={letterError}
          onChange={(html) => {
            form.setValue('application', html, { shouldDirty: true })
          }}
          onRegenerate={regenerate}
        />
      }
      footer={
        <>
          {rootError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {rootError}
            </p>
          )}
          {!readOnly && (
            <Button
              type="submit"
              form={formId}
              disabled={pending}
              className={cn(footerButton, btn.green)}
            >
              Save
            </Button>
          )}
          <Button type="button" onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={TITLES[mode]}
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn('grid gap-6', readOnly && readOnlyFieldsClass)}
      >
        <RequestEmployeeField
          control={form.control}
          name="employeeId"
          permission={movable}
          current={request?.employee}
          hint={hint}
          label="Employee Name"
          placeholder="Select Employee Name"
          required
          disabled={mode !== 'create'}
        />
        <SearchSelectField
          control={form.control}
          name="locationId"
          label="Location"
          placeholder="Select Location"
          options={locations}
          required
          disabled={readOnly}
          onValueChange={() => {
            // A branch belongs to one location.
            form.setValue('branchId', null)
          }}
        />
        <SearchSelectField
          control={form.control}
          name="branchId"
          label="Branch"
          placeholder="Select Branch"
          options={branches}
          required
          disabled={readOnly || !locationId}
        />
        <SearchSelectField
          control={form.control}
          name="departmentId"
          label="Department"
          placeholder="Select Department"
          options={departments}
          required
          disabled={readOnly}
        />
        <RequestEmployeeField
          control={form.control}
          name="lineManagerId"
          permission={directory}
          current={{
            id: request?.payload.lineManagerId,
            name: request?.payload.lineManagerName,
          }}
          exclude={[employeeId]}
          hint={hint}
          label="Line Manager"
          placeholder="Select Manager"
          required
          disabled={readOnly}
        />
        <RequestEmployeeField
          control={form.control}
          name="finalAuthorityId"
          permission={directory}
          current={{
            id: request?.payload.finalAuthorityId,
            name: request?.payload.finalAuthorityName,
          }}
          exclude={[employeeId]}
          hint={hint}
          label="Final Authority"
          placeholder="Select Final Authority"
          required
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="effectiveDate"
          label="Effective Date"
          required
          disabled={readOnly}
          minDate={readOnly ? undefined : today()}
          display="MMMM d, yyyy"
        />
        {existing.length > 0 && (
          <div className="text-sm">
            <RequestFileLinks files={existing} />
          </div>
        )}
        {!readOnly && <RequestFileField value={file} onChange={setFile} />}
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={4000}
          textareaClassName="min-h-24"
        />
      </form>
    </TransferDialogShell>
  )
}
