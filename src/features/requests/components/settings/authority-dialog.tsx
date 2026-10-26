import { type SyntheticEvent, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, TextareaField } from '@/components/form'
import { PayrollDialog, SearchSelectField } from '@/features/payroll'

import {
  useBranchOptions,
  useDepartmentOptions,
  useSaveAuthority,
} from '../../hooks/use-request-settings'
import type {
  FlowAuthority,
  RequestAuthority,
  SettingsRequestType,
} from '../../types/request-settings.types'
import { RequestEmployeeField } from '../shared/request-employee-field'
import { AUTHORITY_OPTIONS, fieldErrorOf, REQUEST_TYPE_OPTIONS } from './settings-helpers'

const schema = z.object({
  authority: z.string().min(1, 'Choose the authority'),
  employeeId: z.string().min(1, 'Choose the employee'),
  requestType: z.string().nullable(),
  branchId: z.string().nullable(),
  departmentId: z.string().nullable(),
  isActive: z.boolean(),
  description: z.string().trim().max(4000, 'Keep it under 4000 characters'),
})
type Values = z.infer<typeof schema>

const FIELDS = [
  'authority',
  'employeeId',
  'requestType',
  'branchId',
  'departmentId',
  'description',
] as const

/**
 * "Authority" Create / Edit: who holds an authority, for one request type,
 * branch and department or (left empty) for all of them.
 */
export function AuthorityDialog({
  authority,
  onClose,
}: {
  authority: RequestAuthority | null
  onClose: () => void
}) {
  const formId = useId()
  const branches = useBranchOptions()
  const departments = useDepartmentOptions()
  const save = useSaveAuthority()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      authority: authority?.authority ?? '',
      employeeId: authority?.employeeId ?? '',
      requestType: authority?.requestType ?? null,
      branchId: authority?.branchId ?? null,
      departmentId: authority?.departmentId ?? null,
      isActive: authority?.isActive ?? true,
      description: authority?.description ?? '',
    },
  })
  const units = (items: { id: string; name: string }[] | undefined) =>
    (items ?? []).map((item) => ({ value: item.id, label: item.name }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: authority?.id ?? null,
        input: {
          authority: values.authority as FlowAuthority,
          employeeId: values.employeeId,
          requestType: values.requestType as SettingsRequestType | null,
          branchId: values.branchId,
          departmentId: values.departmentId,
          description: values.description === '' ? null : values.description,
          isActive: values.isActive,
          rowVersion: authority?.rowVersion,
        },
      })
      onClose()
    } catch (error) {
      const found = fieldErrorOf(error, FIELDS)
      if (found.field) form.setError(found.field, { message: found.message })
      else form.setError('root', { message: found.message })
    }
  })

  return (
    <PayrollDialog
      title={authority ? 'Authority Edit' : 'Authority Create'}
      onClose={onClose}
      formId={formId}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className="grid gap-5"
      >
        <SearchSelectField
          control={form.control}
          name="authority"
          label="Authority"
          options={AUTHORITY_OPTIONS}
          placeholder="Select Authority"
          required
        />
        <RequestEmployeeField
          control={form.control}
          name="employeeId"
          permission="requests.settings.authorities.view"
          current={
            authority && {
              id: authority.employeeId,
              name: authority.employeeName ?? authority.employeeCode,
              code: authority.employeeCode,
            }
          }
          placeholder="Select Employee"
          required
        />
        <SearchSelectField
          control={form.control}
          name="requestType"
          label="Request Type"
          options={REQUEST_TYPE_OPTIONS}
          placeholder="All request types"
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="branchId"
          label="Branch"
          options={units(branches.data)}
          placeholder="All branches"
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="departmentId"
          label="Department"
          options={units(departments.data)}
          placeholder="All departments"
          clearable
        />
        <CheckboxField control={form.control} name="isActive" label="Active" tone="navy" />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          maxLength={4000}
          rows={4}
        />
      </form>
    </PayrollDialog>
  )
}
