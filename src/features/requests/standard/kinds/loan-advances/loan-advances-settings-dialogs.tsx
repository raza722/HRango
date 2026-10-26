import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, TextareaField, TextField } from '@/components/form'
import { MultiSearchSelectField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { standardReadOnlyClass } from '../../standard-styles'
import { useLoanSettingsLookups, useSaveLoanCategory, useSaveLoanType } from './loan-advances.api'
import type { LoanCategory, LoanType, LoanTypeInput } from './loan-advances.types'

export type SettingsDialogMode = 'create' | 'edit' | 'view'

const months = (message: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max, {
      message: `Enter a whole number from ${String(min)} to ${String(max)}`,
    })

const typeSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter the name').max(200, 'Keep it under 200 characters'),
    isActive: z.boolean(),
    guarantorRequired: z.boolean(),
    nonPayable: z.boolean(),
    experienceMonths: months('Enter the months of service', 0, 600),
    requestGapMonths: z
      .string()
      .trim()
      .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) <= 120), {
        message: 'Enter a whole number from 0 to 120',
      }),
    installments: months('Enter the number of installments', 1, 600),
    installmentGapMonths: z
      .string()
      .trim()
      .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) <= 120), {
        message: 'Enter a whole number from 0 to 120',
      }),
    formulaId: z.string().nullable(),
    employmentTypeIds: z.array(z.string()).min(1, 'Choose at least one contract type'),
    deductionPayItemId: z.string().nullable(),
    description: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
  // The API asks for the deduction pay item unless the type is Non Payable.
  .refine((values) => values.nonPayable || Boolean(values.deductionPayItemId), {
    message: 'Choose the deduction pay item',
    path: ['deductionPayItemId'],
  })
type TypeValues = z.infer<typeof typeSchema>

/** The API's field names → the dialog's (`LoanTypeIn`). */
const TYPE_FIELDS: Partial<Record<string, keyof TypeValues>> = {
  name: 'name',
  minExperienceMonths: 'experienceMonths',
  gapBetweenRequestsMonths: 'requestGapMonths',
  installments: 'installments',
  gapBetweenInstallmentsMonths: 'installmentGapMonths',
  formulaId: 'formulaId',
  employmentTypeIds: 'employmentTypeIds',
  deductionPayItemId: 'deductionPayItemId',
  description: 'description',
}

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
 * Description. Formula, contract types and pay items are the API's
 * (`/payroll/formulas`, `/organisation/lookups/employment-types`,
 * `/payroll/pay-items?itemType=deduction`); the formula is stored, not yet
 * evaluated, so it is optional.
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
  const lookups = useLoanSettingsLookups()
  const readOnly = mode === 'view'
  const optional = (value: number | null | undefined) =>
    value === null || value === undefined ? '' : String(value)
  const form = useForm<TypeValues>({
    resolver: zodResolver(typeSchema),
    defaultValues: {
      name: type?.name ?? '',
      isActive: type?.isActive ?? true,
      guarantorRequired: type?.guarantorRequired ?? false,
      nonPayable: type?.nonPayable ?? false,
      experienceMonths: type ? String(type.minExperienceMonths) : '',
      requestGapMonths: optional(type?.gapBetweenRequestsMonths),
      installments: type ? String(type.installments) : '',
      installmentGapMonths: optional(type?.gapBetweenInstallmentsMonths),
      formulaId: type?.formulaId ?? null,
      employmentTypeIds: type?.employmentTypes.map((item) => item.id) ?? [],
      deductionPayItemId: type?.deductionPayItemId ?? null,
      description: type?.description ?? '',
    },
  })
  const options = (items: readonly { id: string; name: string }[] | undefined) =>
    (items ?? []).map((item) => ({ value: item.id, label: item.name }))
  // A saved type's choices stay listed even when the pickers cannot be read.
  const withSaved = (
    items: readonly { id: string; name: string }[] | undefined,
    saved: readonly { id: string | null; name: string | null }[],
  ) => {
    const list = options(items)
    for (const item of saved) {
      if (item.id && !list.some((option) => option.value === item.id)) {
        list.push({ value: item.id, label: item.name ?? item.id })
      }
    }
    return list
  }

  const submit = form.handleSubmit(async (values) => {
    const input: LoanTypeInput = {
      name: values.name,
      isActive: values.isActive,
      guarantorRequired: values.guarantorRequired,
      nonPayable: values.nonPayable,
      minExperienceMonths: Number(values.experienceMonths),
      gapBetweenRequestsMonths:
        values.requestGapMonths === '' ? null : Number(values.requestGapMonths),
      installments: Number(values.installments),
      gapBetweenInstallmentsMonths:
        values.installmentGapMonths === '' ? null : Number(values.installmentGapMonths),
      formulaId: values.formulaId,
      deductionPayItemId: values.nonPayable ? null : values.deductionPayItemId,
      employmentTypeIds: values.employmentTypeIds,
      description: values.description || null,
      ...(type ? { rowVersion: type.rowVersion } : {}),
    }
    try {
      await save.mutateAsync({ id: type?.id, input })
      onClose()
    } catch (failure) {
      const field =
        failure instanceof ApiError
          ? Object.keys(failure.fieldErrors).find((name) => TYPE_FIELDS[name])
          : undefined
      const target = field ? TYPE_FIELDS[field] : undefined
      if (failure instanceof ApiError && field && target) {
        form.setError(target, { message: failure.fieldErrors[field] })
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
          maxLength={200}
        />
        <CheckboxField
          control={form.control}
          name="isActive"
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
          inputMode="numeric"
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="formulaId"
          label="Formula"
          placeholder="Select Formula"
          disabled={readOnly}
          options={withSaved(lookups.data?.formulas, [
            { id: type?.formulaId ?? null, name: type?.formulaName ?? null },
          ])}
        />
        <MultiSearchSelectField
          control={form.control}
          name="employmentTypeIds"
          label="Employment Contract Type"
          required
          placeholder="Select Employment Contract Type"
          disabled={readOnly}
          options={withSaved(lookups.data?.employmentTypes, type?.employmentTypes ?? [])}
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
          name="deductionPayItemId"
          label="Deduction Payitem"
          placeholder="Select Deduction Payitem"
          disabled={readOnly}
          options={withSaved(lookups.data?.deductionPayItems, [
            { id: type?.deductionPayItemId ?? null, name: type?.deductionPayItemName ?? null },
          ])}
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
  name: z.string().trim().min(1, 'Enter the name').max(200, 'Keep it under 200 characters'),
  isActive: z.boolean(),
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
      isActive: category?.isActive ?? true,
      description: category?.description ?? '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: category?.id,
        input: {
          name: values.name,
          isActive: values.isActive,
          description: values.description || null,
          ...(category ? { rowVersion: category.rowVersion } : {}),
        },
      })
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
          maxLength={200}
        />
        <CheckboxField
          control={form.control}
          name="isActive"
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
