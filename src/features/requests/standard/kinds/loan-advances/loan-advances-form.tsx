import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextareaField, TextField } from '@/components/form'
import {
  AttachmentField,
  DateField,
  PayrollDialog,
  RsField,
  SearchSelectField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import type { StandardFormProps } from '../../standard.types'
import { StandardDecisionDialog } from '../../standard-dialogs'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { loanAdvancesConfig } from './loan-advances.config'
import type {
  LoanAdvanceInput,
  LoanAdvanceLookups,
  LoanAdvancePayload,
  LoanGuarantor,
} from './loan-advances.types'
import { GuarantorDialog, GuarantorsRow } from './loan-advances-guarantor'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const amountOf = (value: string) => Number(value.replace(/,/g, ''))

const schema = z.object({
  employeeId: z.string().nullable(),
  typeId: chosen('Choose the loan & advances type'),
  categoryId: chosen('Choose the loan & advances category'),
  requiredAmount: z
    .string()
    .trim()
    .min(1, 'Enter the amount')
    .refine((value) => Number.isFinite(amountOf(value)) && amountOf(value) > 0, {
      message: 'Enter an amount above 0',
    }),
  requiredDate: z.string().min(1, 'Choose the required date'),
  extensionNo: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/, 'Up to 6 digits'),
  attachment: z.string().nullable(),
  reason: z.string().trim().min(1, 'Give a reason').max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const TITLES = {
  create: 'Loan & Advance Request Create',
  edit: 'Loan & Advance Request Edit',
} as const

/**
 * Create / Edit / View. View is drawn as the approvals' popup (employee card,
 * the request, guarantors and the approval fields; frames 4187:57332,
 * 4190:80756), so it opens that popup read-only.
 */
export function LoanAdvancesForm(props: StandardFormProps<LoanAdvancePayload>) {
  const { mode, request, onClose } = props
  if (mode === 'view' && request) {
    return (
      <StandardDecisionDialog
        config={loanAdvancesConfig}
        id={request.id}
        mode="view"
        onClose={onClose}
      />
    )
  }
  return <LoanAdvancesEditor {...props} mode={mode === 'edit' ? 'edit' : 'create'} />
}

/**
 * "Loan & Advance Request Create" (frames 4172:60448, 4172:64998): Employee
 * (All only), Loan & Advances Type, Category, Required Loan & Advances Amount,
 * Required Date, Attachment, Extension No., Reason and the guarantors.
 */
function LoanAdvancesEditor({
  mode,
  scope,
  request,
  onClose,
}: StandardFormProps<LoanAdvancePayload> & { mode: 'create' | 'edit' }) {
  const formId = useId()
  const lookups = useStandardLookups<LoanAdvanceLookups>('loan-advances')
  const create = useCreateStandard('loan-advances')
  const update = useUpdateStandard('loan-advances')
  const pickPerson = scope === 'all' && mode === 'create'
  const people = lookups.data?.employees ?? []
  const types = lookups.data?.extra.types ?? []
  const payload = request?.payload

  const [guarantors, setGuarantors] = useState<LoanGuarantor[]>(payload?.guarantors ?? [])
  const [guarantorError, setGuarantorError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ index: number | null } | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      typeId: payload?.typeId ?? null,
      categoryId: payload?.categoryId ?? null,
      requiredAmount: payload ? String(payload.requiredAmount) : '',
      requiredDate: payload?.requiredDate ?? '',
      extensionNo: payload?.extensionNo ?? '',
      attachment: payload?.attachment ?? null,
      reason: payload?.reason ?? '',
    },
  })
  const [typeId, attachment] = useWatch({ control: form.control, name: ['typeId', 'attachment'] })
  const type = types.find((item) => item.id === typeId)
  // Drawn as "Guarantor*"; a type without "Guarantor Required" makes them optional.
  const guarantorRequired = type ? type.guarantorRequired : true

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    if (type?.guarantorRequired && guarantors.length === 0) {
      setGuarantorError(`${type.name} needs a guarantor`)
      return
    }
    const input: LoanAdvanceInput = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      typeId: values.typeId ?? '',
      categoryId: values.categoryId ?? '',
      requiredAmount: amountOf(values.requiredAmount),
      requiredDate: values.requiredDate,
      extensionNo: values.extensionNo,
      attachment: values.attachment,
      reason: values.reason,
      guarantors,
    }
    try {
      if (mode === 'edit' && request) await update.mutateAsync({ id: request.id, input })
      else await create.mutateAsync(input)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          if (field === 'guarantors') {
            setGuarantorError(message)
            placed = true
          } else if (field in values) {
            form.setError(field as keyof Values, { message })
            placed = true
          }
        }
        if (!placed) form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  const pending = create.isPending || update.isPending
  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      pending={pending}
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
        {pickPerson && (
          <SearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee"
            required
            placeholder="Select Employee"
            options={people
              .filter((person) => person.active)
              .map((person) => ({ value: person.id, label: person.name, hint: person.code }))}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="typeId"
          label="Loan & Advances Type"
          required
          placeholder="Select Loan & Advances Type"
          options={types.map((item) => ({ value: item.id, label: item.name }))}
          onValueChange={() => {
            setGuarantorError(null)
          }}
        />
        <SearchSelectField
          control={form.control}
          name="categoryId"
          label="Loan & Advances Category"
          required
          placeholder="Select Loan & Advances Category"
          options={(lookups.data?.extra.categories ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        <RsField
          control={form.control}
          name="requiredAmount"
          label="Required Loan & Advances Amount"
          required
        />
        <DateField
          control={form.control}
          name="requiredDate"
          label="Required Date"
          required
          minDate={today()}
        />
        <AttachmentField
          value={attachment}
          onChange={(name) => {
            form.setValue('attachment', name)
          }}
        />
        <TextField
          control={form.control}
          name="extensionNo"
          label="Extension No."
          inputMode="numeric"
          maxLength={6}
        />
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          required
          rows={4}
          maxLength={500}
        />
        <GuarantorsRow
          guarantors={guarantors}
          required={guarantorRequired}
          error={guarantorError}
          disabled={pending}
          onAdd={() => {
            setEditing({ index: null })
          }}
          onEdit={(index) => {
            setEditing({ index })
          }}
          onRemove={(index) => {
            setGuarantors((current) => current.filter((_, at) => at !== index))
          }}
        />
      </form>
      {editing && (
        <GuarantorDialog
          guarantor={editing.index === null ? null : (guarantors[editing.index] ?? null)}
          onSave={(guarantor) => {
            setGuarantors((current) =>
              editing.index === null
                ? [...current, guarantor]
                : current.map((item, at) => (at === editing.index ? guarantor : item)),
            )
            setGuarantorError(null)
            setEditing(null)
          }}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </PayrollDialog>
  )
}
