import { type SyntheticEvent, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  AttachmentField,
  btn,
  DateField,
  footerButton,
  SearchSelectField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useCreateRequest, useTransferLookups, useUpdateRequest } from '../../hooks/use-requests'
import type { TransferRequest, TransferRequestInput } from '../../types/requests.types'
import { sanitizeApplication, transferLetter } from '../../utils/transfer-letter'
import { ApplicationEditor } from './application-editor'
import { TransferDialogShell } from './transfer-dialog-shell'
import { readOnlyFieldsClass } from './transfer-styles'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z.object({
  employeeId: chosen('Choose the employee'),
  locationId: chosen('Choose the location'),
  branchId: chosen('Choose the branch'),
  department: chosen('Choose the department'),
  lineManagerId: chosen('Choose the line manager'),
  finalAuthorityId: chosen('Choose the final authority'),
  effectiveDate: z.string().min(1, 'Choose the effective date'),
  attachmentName: z.string().nullable(),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
  application: z.string().max(20_000, 'The application is too long'),
})
type Values = z.infer<typeof schema>

const FIELDS = [
  'employeeId',
  'locationId',
  'branchId',
  'department',
  'lineManagerId',
  'finalAuthorityId',
  'effectiveDate',
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
  locationId: request?.payload.location.id ?? null,
  branchId: request?.payload.branch.id ?? null,
  department: request?.payload.department ?? null,
  lineManagerId: request?.payload.lineManager.id ?? null,
  finalAuthorityId: request?.payload.finalAuthority.id ?? null,
  effectiveDate: request?.payload.effectiveDate ?? '',
  attachmentName: request?.payload.attachmentName ?? null,
  description: request?.payload.description ?? '',
  application: request?.payload.application ?? '',
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
  const create = useCreateRequest('transfer')
  const update = useUpdateRequest('transfer')
  const [letterError, setLetterError] = useState<string | null>(null)
  const readOnly = mode === 'view'
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(request) })
  const [employeeId, locationId, application, attachment] = useWatch({
    control: form.control,
    name: ['employeeId', 'locationId', 'application', 'attachmentName'],
  })

  const people = lookups.data?.employees ?? []
  const option = (person: (typeof people)[number]) => ({
    value: person.id,
    label: person.name,
    hint: `${person.code} · ${person.department}`,
  })
  const employees = people
    .filter((person) => person.active || person.id === request?.employee.id)
    .map(option)
  const others = (current: string | undefined) =>
    people
      .filter((person) => person.id !== employeeId && (person.active || person.id === current))
      .map(option)
  const locations = (lookups.data?.locations ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))
  const branches = (lookups.data?.branches ?? [])
    .filter((item) => item.locationId === locationId)
    .map((item) => ({ value: item.id, label: item.name }))
  const departments = (lookups.data?.departments ?? []).map((name) => ({
    value: name,
    label: name,
  }))

  const regenerate = () => {
    const values = form.getValues()
    const person = people.find((item) => item.id === values.employeeId)
    const authority = people.find((item) => item.id === values.finalAuthorityId)
    const location = lookups.data?.locations.find((item) => item.id === values.locationId)
    const branch = lookups.data?.branches.find((item) => item.id === values.branchId)
    if (
      !person ||
      !authority ||
      !location ||
      !branch ||
      !values.department ||
      !values.effectiveDate
    ) {
      setLetterError(
        'Choose the employee, location, branch, department, final authority and effective date first.',
      )
      return
    }
    setLetterError(null)
    const nameOf = (list: { id: string; name: string }[] | undefined, id: string | null) =>
      list?.find((item) => item.id === id)?.name ?? null
    const from = request
      ? request.payload.current
      : {
          location: nameOf(lookups.data?.locations, person.locationId),
          branch: nameOf(lookups.data?.branches, person.branchId),
          department: person.department,
        }
    form.setValue(
      'application',
      transferLetter({
        employee: person.name,
        finalAuthority: authority.name,
        effectiveDate: values.effectiveDate,
        from,
        to: { location: location.name, branch: branch.name, department: values.department },
        lineManager: people.find((item) => item.id === values.lineManagerId)?.name ?? null,
        description: values.description,
      }),
      { shouldDirty: true },
    )
  }

  const submit = form.handleSubmit(async (values) => {
    const input: TransferRequestInput = {
      ...(values.employeeId ? { employeeId: values.employeeId } : {}),
      locationId: values.locationId ?? '',
      branchId: values.branchId ?? '',
      department: values.department ?? '',
      lineManagerId: values.lineManagerId ?? '',
      finalAuthorityId: values.finalAuthorityId ?? '',
      effectiveDate: values.effectiveDate,
      attachmentName: values.attachmentName,
      description: values.description,
      application: sanitizeApplication(values.application),
    }
    try {
      if (request) await update.mutateAsync({ id: request.id, input })
      else await create.mutateAsync(input)
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
        <SearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee Name"
          placeholder="Select Employee Name"
          options={employees}
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
          onValueChange={(next) => {
            const branch = lookups.data?.branches.find(
              (item) => item.id === form.getValues('branchId'),
            )
            if (branch && branch.locationId !== next) form.setValue('branchId', null)
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
          name="department"
          label="Department"
          placeholder="Select Department"
          options={departments}
          required
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="lineManagerId"
          label="Line Manager"
          placeholder="Select Manager"
          options={others(request?.payload.lineManager.id)}
          required
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="finalAuthorityId"
          label="Final Authority"
          placeholder="Select Final Authority"
          options={others(request?.payload.finalAuthority.id)}
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
        <AttachmentField
          value={attachment}
          disabled={readOnly}
          onChange={(name) => {
            form.setValue('attachmentName', name, { shouldDirty: true })
          }}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={500}
          textareaClassName="min-h-24"
        />
      </form>
    </TransferDialogShell>
  )
}
