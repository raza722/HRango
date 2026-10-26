import { type SyntheticEvent, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, TextareaField } from '@/components/form'
import { Skeleton } from '@/components/ui/skeleton'
import { PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useCreateDelegation, useDelegation } from '../../hooks/use-request-settings'
import type { RequestDelegation, SettingsRequestType } from '../../types/request-settings.types'
import { RequestEmployeeField } from '../shared/request-employee-field'
import { REQUEST_TYPE_OPTIONS, viewFieldsClass } from './settings-helpers'

const schema = z
  .object({
    delegatorId: z.string().min(1, 'Choose the delegator'),
    requestType: z.string().min(1, 'Choose the request type'),
    delegateeId: z.string().min(1, 'Choose the delegatee'),
    active: z.boolean(),
    description: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
  .refine((values) => !values.delegateeId || values.delegateeId !== values.delegatorId, {
    path: ['delegateeId'],
    message: 'Choose someone other than the delegator',
  })
type Values = z.infer<typeof schema>

const FIELDS = ['delegatorId', 'requestType', 'delegateeId', 'description'] as const

/**
 * "Request Delegations Create" / View: while the delegator is away, the
 * delegatee approves their requests of one type. View adds the Active tick
 * and has Cancel only.
 */
export function DelegationDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const delegation = useDelegation(id)
  if (id && !delegation.data) {
    return (
      <PayrollDialog title="Request Delegations View" onClose={onClose} readOnly>
        <Skeleton className="h-56 w-full" />
      </PayrollDialog>
    )
  }
  return <DelegationForm delegation={delegation.data} onClose={onClose} />
}

function DelegationForm({
  delegation,
  onClose,
}: {
  delegation: RequestDelegation | undefined
  onClose: () => void
}) {
  const formId = useId()
  const permission = 'requests.settings.delegations.create'
  const create = useCreateDelegation()
  const readOnly = delegation !== undefined
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      delegatorId: delegation?.delegatorId ?? '',
      requestType: delegation?.requestType ?? '',
      delegateeId: delegation?.delegateeId ?? '',
      active: delegation?.isActive ?? true,
      description: delegation?.description ?? '',
    },
  })

  // The two of a delegation stay named when they have left.
  const saved = delegation
    ? [
        { id: delegation.delegatorId, name: delegation.delegatorName ?? '—' },
        { id: delegation.delegateeId, name: delegation.delegateeName ?? '—' },
      ]
    : []

  const submit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        delegatorId: values.delegatorId,
        delegateeId: values.delegateeId,
        requestType: values.requestType as SettingsRequestType,
        description: values.description === '' ? null : values.description,
        isActive: true,
      })
      onClose()
    } catch (error) {
      const field = FIELDS.find((name) => error instanceof ApiError && error.fieldErrors[name])
      if (error instanceof ApiError && field) {
        form.setError(field, { message: error.fieldErrors[field] })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the delegation.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title={readOnly ? 'Request Delegations View' : 'Request Delegations Create'}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={create.isPending}
      error={form.formState.errors.root?.message}
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn('grid gap-5', readOnly && viewFieldsClass)}
      >
        <RequestEmployeeField
          control={form.control}
          name="delegatorId"
          permission={permission}
          current={saved}
          label="Delegator"
          placeholder="Select Delegator"
          required={!readOnly}
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="requestType"
          label="Types"
          options={REQUEST_TYPE_OPTIONS}
          placeholder="Select Request Types"
          required={!readOnly}
          disabled={readOnly}
        />
        <RequestEmployeeField
          control={form.control}
          name="delegateeId"
          permission={permission}
          current={saved}
          label="Delegatee"
          placeholder="Select Employees"
          required={!readOnly}
          disabled={readOnly}
        />
        {readOnly && (
          <CheckboxField control={form.control} name="active" label="Active" tone="navy" disabled />
        )}
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
          maxLength={500}
          rows={5}
        />
      </form>
    </PayrollDialog>
  )
}
