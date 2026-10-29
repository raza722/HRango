import { useId } from 'react'
import { useController, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'

import { FormField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { DateField, PayrollDialog, RsInput, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import { RequestFileField } from '../../../components/shared/request-files'
import { detailFileRef } from '../../../utils/request-files'
import type { StandardFormProps } from '../../standard.types'
import { standardButton, standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import {
  MAX_CLAIM_AMOUNT,
  money,
  parseAmount,
  requestBody,
  toAmount,
  todayIso,
} from './claims.utils'
import type {
  ExpenseDetailsInput,
  ExpenseLineInput,
  ExpenseLookups,
  ExpensePayload,
} from './expense.types'

const fileRef = z.custom<FileRef | null>()

const lineSchema = z.object({
  title: z.string().trim().min(1, 'Enter the claim title').max(200, 'Keep it under 200 characters'),
  claimDate: z.string().refine((value) => !value || value <= todayIso(), {
    message: 'Choose today or an earlier day',
  }),
  expenseCategoryId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the category' }),
  amount: z
    .string()
    .refine((value) => (parseAmount(value) ?? 0) > 0, { message: 'Enter an amount above 0' })
    .refine((value) => (parseAmount(value) ?? 0) <= MAX_CLAIM_AMOUNT, {
      message: `Claim at most PKR ${MAX_CLAIM_AMOUNT.toLocaleString('en-US')}`,
    }),
  description: z.string().trim().min(1, 'Describe the expense').max(4000),
  receipt: fileRef,
})

const schema = z.object({
  employeeId: z.string().nullable(),
  lines: z.array(lineSchema).min(1, 'Add a claim').max(50, 'Send 50 claims at most'),
})
type Values = z.infer<typeof schema>
type LineValues = Values['lines'][number]

const emptyLine = (): LineValues => ({
  title: '',
  claimDate: todayIso(),
  expenseCategoryId: null,
  amount: '',
  description: '',
  receipt: null,
})

const TITLES = {
  create: 'Claim Expense',
  edit: 'Expense Claim Edit',
  view: 'Expense Claim View',
} as const

/** "Amount *" with the RS prefix, bound to a line. */
function AmountField({
  control,
  index,
  disabled,
}: {
  control: ReturnType<typeof useForm<Values>>['control']
  index: number
  disabled: boolean
}) {
  const { field, fieldState } = useController({ control, name: `lines.${index}.amount` })
  return (
    <FormField label="Amount" required error={fieldState.error?.message}>
      {(a11y) => (
        <RsInput {...a11y} value={field.value} onChange={field.onChange} disabled={disabled} />
      )}
    </FormField>
  )
}

/** The receipt of a line: uploaded when picked. */
function ReceiptField({
  control,
  index,
  disabled,
}: {
  control: ReturnType<typeof useForm<Values>>['control']
  index: number
  disabled: boolean
}) {
  const { field, fieldState } = useController({ control, name: `lines.${index}.receipt` })
  return (
    <RequestFileField
      label="Receipt"
      value={field.value ?? null}
      onChange={field.onChange}
      disabled={disabled}
      error={fieldState.error?.message}
    />
  )
}

/**
 * "Claim Expense" (Figma App Version): per claim Expense Claim Title*, Expense
 * Claim Date, Expense Claim Category*, Amount*, Description* and the receipt.
 * "Generate Claim" adds another claim; "Submit All" sends them as one request
 * (`POST /requests/expense`, `details.lines`).
 */
export function ExpenseForm({ mode, scope, request, onClose }: StandardFormProps<ExpensePayload>) {
  const formId = useId()
  const lookups = useStandardLookups<ExpenseLookups>('expense')
  const create = useCreateStandard('expense')
  const update = useUpdateStandard('expense')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const categories = lookups.data?.extra.categories ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      lines: request
        ? request.payload.lines.map((line) => ({
            title: line.title,
            claimDate: line.claimDate,
            expenseCategoryId: line.expenseCategoryId,
            amount: String(toAmount(line.amount) ?? ''),
            description: line.description,
            receipt: detailFileRef(line),
          }))
        : [emptyLine()],
    },
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const watched = useWatch({ control: form.control, name: 'lines' })
  const total = watched.reduce((sum, line) => sum + (parseAmount(line.amount) ?? 0), 0)

  // Categories of the claims being edited stay choosable even if switched off since.
  const options = [
    ...categories.map((item) => ({ value: item.id, label: item.name })),
    ...(request?.payload.lines ?? [])
      .filter((line) => !categories.some((item) => item.id === line.expenseCategoryId))
      .map((line) => ({
        value: line.expenseCategoryId,
        label: line.expenseCategoryName ?? 'Category',
      })),
  ]

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    // The category's rules, before the server checks them again.
    let refused = false
    for (const [index, line] of values.lines.entries()) {
      const category = categories.find((item) => item.id === line.expenseCategoryId)
      const max = toAmount(category?.maxAmount)
      const amount = parseAmount(line.amount) ?? 0
      if (category?.receiptRequired && !line.receipt) {
        form.setError(`lines.${index}.receipt`, { message: 'Attach the receipt' })
        refused = true
      }
      if (max !== null && amount > max) {
        form.setError(`lines.${index}.amount`, { message: `At most ${money(max)} per claim` })
        refused = true
      }
    }
    if (refused) return
    const claims: ExpenseLineInput[] = values.lines.map((line) => ({
      title: line.title.trim(),
      claimDate: line.claimDate || null,
      expenseCategoryId: line.expenseCategoryId ?? '',
      amount: parseAmount(line.amount) ?? 0,
      description: line.description.trim(),
      fileId: line.receipt?.id ?? null,
    }))
    const dates = claims.map((line) => line.claimDate ?? todayIso()).sort()
    const body: RequestBody<ExpenseDetailsInput> = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: dates[0] ?? null,
      toDate: dates.at(-1) ?? null,
      details: { lines: claims },
      ...(mode === 'edit' && request ? { rowVersion: request.rowVersion } : {}),
    }
    try {
      if (mode === 'edit' && request)
        await update.mutateAsync({ id: request.id, body: requestBody(body) })
      else await create.mutateAsync(requestBody(body))
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const match = /^(?:details\.)?lines\.(\d+)\.(\w+)$/.exec(field)
          const key = match ? (match[2] === 'fileId' ? 'receipt' : match[2]) : null
          if (match && key && key in emptyLine()) {
            form.setError(`lines.${Number(match[1])}.${key as keyof LineValues}`, { message })
            placed = true
          } else if (field === 'employeeId') {
            form.setError('employeeId', { message })
            placed = true
          }
        }
        if (!placed) form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      saveLabel={mode === 'create' ? 'Submit All' : 'Save'}
      pending={create.isPending || update.isPending}
      error={form.formState.errors.root?.message ?? form.formState.errors.lines?.message}
      className="max-w-4xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', readOnly && standardReadOnlyClass)}
      >
        {scope === 'all' && (
          <RequestEmployeeField
            control={form.control}
            name="employeeId"
            permission={typePermission('expense', 'create')}
            current={request?.employee}
            required
            disabled={!pickPerson}
          />
        )}
        {lines.fields.map((line, index) => (
          <section
            key={line.id}
            aria-label={`Claim ${String(index + 1)}`}
            className="grid gap-4 rounded-md border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-inter text-base font-semibold text-heading">
                Claim {String(index + 1)}
              </h3>
              {!readOnly && lines.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove claim ${String(index + 1)}`}
                  onClick={() => {
                    lines.remove(index)
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              )}
            </div>
            <TextField
              control={form.control}
              name={`lines.${index}.title`}
              label="Expense Claim Title"
              required
              maxLength={200}
              placeholder="Write here"
              disabled={readOnly}
            />
            <DateField
              control={form.control}
              name={`lines.${index}.claimDate`}
              label="Expense Claim Date"
              disabled={readOnly}
              maxDate={new Date()}
            />
            <SearchSelectField
              control={form.control}
              name={`lines.${index}.expenseCategoryId`}
              label="Expense Claim Category"
              required
              placeholder="Select"
              disabled={readOnly}
              options={options}
            />
            <AmountField control={form.control} index={index} disabled={readOnly} />
            <TextareaField
              control={form.control}
              name={`lines.${index}.description`}
              label="Description"
              required
              rows={3}
              maxLength={4000}
              placeholder="Write here"
              disabled={readOnly}
            />
            <ReceiptField control={form.control} index={index} disabled={readOnly} />
          </section>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-inter text-sm text-heading">
            Total: <span className="font-semibold">{money(total)}</span>
          </p>
          {!readOnly && lines.fields.length < 50 && (
            <Button
              type="button"
              onClick={() => {
                lines.append(emptyLine())
              }}
              className={cn('h-9 gap-1 rounded-[5px] px-4 text-sm', standardButton.navy)}
            >
              <Plus aria-hidden="true" className="size-4" /> Generate Claim
            </Button>
          )}
        </div>
      </form>
    </PayrollDialog>
  )
}
