import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, TextareaField, TextField } from '@/components/form'
import { MultiSearchSelectField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { standardReadOnlyClass } from '../../standard-styles'
import { useSaveLoanCategory, useSaveLoanType } from './loan-advances.api'
import {
  CONTRACT_TYPE_LABELS,
  DEDUCTION_PAYITEMS,
  FORMULA_VARIABLES,
} from './loan-advances.constants'
import type { LoanCategory, LoanContractType, LoanType, LoanTypeInput } from './loan-advances.types'

export type SettingsDialogMode = 'create' | 'edit' | 'view'

const months = (message: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max, {
      message: `Enter a whole number from ${String(min)} to ${String(max)}`,
    })

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const typeSchema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(60, 'Keep it under 60 characters'),
  active: z.boolean(),
  guarantorRequired: z.boolean(),
  nonPayable: z.boolean(),
  experienceMonths: months('Enter the months of service', 0, 600),
  requestGapMonths: z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) <= 120), {
      message: 'Enter a whole number from 0 to 120',
    }),
  installments: months('Enter the number of installments', 1, 120),
  installmentGapMonths: months('Enter the gap between installments', 1, 12),
  formula: chosen('Choose the formula'),
  contractTypes: z.array(z.string()).min(1, 'Choose at least one contract type'),
  deductionPayitem: z.string().nullable(),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type TypeValues = z.infer<typeof typeSchema>

const TYPE_TITLES: Record<SettingsDialogMode, string> = {
  create: 'Loan & Advance Type Create',
  edit: 'Loan & Advance Type Edit',
  view: 'Loan & Advance Type View',
}

/**
 * "Loan & Advance Type Create" (frames 4195:101987 …): Name, Active,
 * Guarantor Required, Employee Experience (In Month), Gap Between Requests
 * (In Months), No of Installments, Gap Between Installments (In Months),
 * Formula, Employment Contract Type, Non Payable, Deduction Payitem and
 * Description.
 */
export function LoanTypeDialog({
  mode,
  type,
  onClose,
}: {
  mode: SettingsDialogMode
  type: LoanType | null
  onClose: () => void
}) {
  const formId = useId()
  const save = useSaveLoanType()
  const readOnly = mode === 'view'
  const form = useForm<TypeValues>({
    resolver: zodResolver(typeSchema),
    defaultValues: {
      name: type?.name ?? '',
      active: type?.active ?? true,
      guarantorRequired: type?.guarantorRequired ?? false,
      nonPayable: type?.nonPayable ?? false,
      experienceMonths: type ? String(type.experienceMonths) : '',
      requestGapMonths:
        type?.requestGapMonths === null || !type ? '' : String(type.requestGapMonths),
      installments: type ? String(type.installments) : '',
      installmentGapMonths: type ? String(type.installmentGapMonths) : '',
      formula: type?.formula ?? null,
      contractTypes: type?.contractTypes ?? [],
      deductionPayitem: type?.deductionPayitem ?? null,
      description: type?.description ?? '',
    },
  })

  const submit = form.handleSubmit(async (values) => {
    const input: LoanTypeInput = {
      name: values.name,
      active: values.active,
      guarantorRequired: values.guarantorRequired,
      nonPayable: values.nonPayable,
      experienceMonths: Number(values.experienceMonths),
      requestGapMonths: values.requestGapMonths === '' ? null : Number(values.requestGapMonths),
      installments: Number(values.installments),
      installmentGapMonths: Number(values.installmentGapMonths),
      formula: values.formula ?? '',
      contractTypes: values.contractTypes as LoanContractType[],
      deductionPayitem: values.deductionPayitem,
      description: values.description,
    }
    try {
      await save.mutateAsync({ id: type?.id, input })
      onClose()
    } catch (failure) {
      if (failure instanceof ApiError && failure.fieldErrors.name) {
        form.setError('name', { message: failure.fieldErrors.name })
      } else {
        form.setError('root', {
          message: failure instanceof ApiError ? failure.message : 'Could not save the type.',
        })
      }
    }
  })

  return (
    <PayrollDialog
      title={TYPE_TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', readOnly && standardReadOnlyClass)}
      >
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          disabled={readOnly}
          maxLength={60}
        />
        <CheckboxField
          control={form.control}
          name="active"
          label="Active"
          tone="navy"
          disabled={readOnly}
        />
        <CheckboxField
          control={form.control}
          name="guarantorRequired"
          label="Guarantor Required"
          tone="navy"
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="experienceMonths"
          label="Employee Experience (In Month)"
          required
          inputMode="numeric"
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="requestGapMonths"
          label="Gap Between Requests (In Months)"
          inputMode="numeric"
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="installments"
          label="No of Installments"
          required
          inputMode="numeric"
          disabled={readOnly}
        />
        <TextField
          control={form.control}
          name="installmentGapMonths"
          label="Gap Between Installments (In Months)"
          required
          inputMode="numeric"
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="formula"
          label="Formula"
          required
          placeholder="Select Formula"
          disabled={readOnly}
          options={FORMULA_VARIABLES.map((value) => ({ value, label: value }))}
        />
        <MultiSearchSelectField
          control={form.control}
          name="contractTypes"
          label="Employment Contract Type"
          required
          placeholder="Select Employment Contract Type"
          disabled={readOnly}
          options={(Object.keys(CONTRACT_TYPE_LABELS) as LoanContractType[]).map((value) => ({
            value,
            label: CONTRACT_TYPE_LABELS[value],
          }))}
        />
        <CheckboxField
          control={form.control}
          name="nonPayable"
          label="Non Payable"
          tone="navy"
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="deductionPayitem"
          label="Deduction Payitem"
          placeholder="Select Deduction Payitem"
          disabled={readOnly}
          options={DEDUCTION_PAYITEMS.map((value) => ({ value, label: value }))}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          rows={4}
          maxLength={500}
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(60, 'Keep it under 60 characters'),
  active: z.boolean(),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type CategoryValues = z.infer<typeof categorySchema>

const CATEGORY_TITLES: Record<SettingsDialogMode, string> = {
  create: 'Loan & Advance Category Create',
  edit: 'Loan & Advance Category Edit',
  view: 'Loan & Advance Category View',
}

/** "Loan & Advance Category Create" (frames 4195:107222, 4195:107774): Name, Active, Description. */
export function LoanCategoryDialog({
  mode,
  category,
  onClose,
}: {
  mode: SettingsDialogMode
  category: LoanCategory | null
  onClose: () => void
}) {
  const formId = useId()
  const save = useSaveLoanCategory()
  const readOnly = mode === 'view'
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      active: category?.active ?? true,
      description: category?.description ?? '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: category?.id, input: values })
      onClose()
    } catch (failure) {
      if (failure instanceof ApiError && failure.fieldErrors.name) {
        form.setError('name', { message: failure.fieldErrors.name })
      } else {
        form.setError('root', {
          message: failure instanceof ApiError ? failure.message : 'Could not save the category.',
        })
      }
    }
  })
  return (
    <PayrollDialog
      title={CATEGORY_TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', readOnly && standardReadOnlyClass)}
      >
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          disabled={readOnly}
          maxLength={60}
        />
        <CheckboxField
          control={form.control}
          name="active"
          label="Active"
          tone="navy"
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          rows={4}
          maxLength={500}
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}
