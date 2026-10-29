import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { TextareaField, TextField } from '@/components/form'
import { DateField, PayrollDialog, RsField, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'

import { type RequestBody, typePermission } from '../../../api/backend'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import { RequestFileField } from '../../../components/shared/request-files'
import { syncAttachments } from '../../../utils/request-files'
import type { StandardFormProps } from '../../standard.types'
import { StandardDecisionDialog } from '../../standard-dialogs'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { loanAdvancesConfig } from './loan-advances.config'
import { useLoanTypeOptions } from './loan-advances.lookups'
import type {
  LoanAdvanceDetailsIn,
  LoanAdvanceLookups,
  LoanAdvancePayload,
  LoanGuarantor,
  LoanTypeOption,
} from './loan-advances.types'
import { GuarantorDialog, GuarantorsRow } from './loan-advances-guarantor'
import { useRequestAttachment } from './use-request-attachment'

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
  reason: z.string().trim().min(1, 'Give a reason').max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

/** The API's field names → the form's. */
const FIELD_OF: Record<string, keyof Values> = {
  employeeId: 'employeeId',
  loanTypeId: 'typeId',
  loanCategoryId: 'categoryId',
  amountRequested: 'requiredAmount',
  requiredDate: 'requiredDate',
  fromDate: 'requiredDate',
  extensionNo: 'extensionNo',
  reason: 'reason',
}

const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

/** "12 installments" / "1 installment". */
const counted = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`

/** "12 installments, 6 months of service": a loan type's terms. */
function terms(type: LoanTypeOption): string {
  const parts = [counted(type.installments, 'installment', 'installments')]
  if (type.minExperienceMonths > 0) {
    parts.push(`${counted(type.minExperienceMonths, 'month', 'months')} of service`)
  }
  if (type.guarantorRequired) parts.push('guarantor needed')
  return parts.join(', ')
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
        via="request"
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
  const payload = request?.payload

  const [guarantors, setGuarantors] = useState<LoanGuarantor[]>(payload?.guarantors ?? [])
  const { attachment, setAttachment, before } = useRequestAttachment('loan-advances', request)
  const [guarantorError, setGuarantorError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ index: number | null } | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      typeId: payload?.loanTypeId ?? null,
      categoryId: payload?.loanCategoryId ?? null,
      requiredAmount: payload ? String(payload.amountRequested) : '',
      requiredDate: payload?.requiredDate ?? '',
      extensionNo: payload?.extensionNo ?? '',
      reason: request?.reason ?? '',
    },
  })
  const [typeId, employeeId] = useWatch({ control: form.control, name: ['typeId', 'employeeId'] })
  // The types (terms, eligibility) of whom the request is for: the signed-in person's from the
  // look-ups, someone else's from `GET /requests/options/loan-types?employeeId=`.
  const forId = pickPerson ? employeeId : (request?.employee.id ?? null)
  const others = useLoanTypeOptions(forId)
  const types = forId ? (others.data ?? []) : (lookups.data?.extra.types ?? [])
  const type = types.find((item) => item.id === typeId)
  // Drawn as "Guarantor*"; a type without "Guarantor Required" makes them optional.
  const guarantorRequired = type ? type.guarantorRequired : true

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    if (type?.eligible === false) {
      form.setError('typeId', { message: `${type.name} is not open to this contract type` })
      return
    }
    if (type?.guarantorRequired && guarantors.length === 0) {
      setGuarantorError(`${type.name} needs a guarantor`)
      return
    }
    const details = {
      loanTypeId: values.typeId ?? '',
      loanCategoryId: values.categoryId,
      amountRequested: amountOf(values.requiredAmount),
      requiredDate: values.requiredDate,
      extensionNo: values.extensionNo || null,
      guarantors: guarantors.map((guarantor) => ({
        name: guarantor.name,
        cnic: guarantor.cnic,
        knownSince: guarantor.knownSince,
        relationship: guarantor.relationship,
        extensionNo: guarantor.extensionNo?.trim() ? guarantor.extensionNo : null,
        description: guarantor.description?.trim() ? guarantor.description : null,
        fileId: guarantor.fileId ?? null,
      })),
    } satisfies LoanAdvanceDetailsIn
    const body: RequestBody = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      // The request's dates are the day the money is needed.
      fromDate: values.requiredDate,
      toDate: values.requiredDate,
      reason: values.reason,
      details,
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        await syncAttachments('loan-advances', request.id, before, [attachment])
      } else {
        await create.mutateAsync({ ...body, attachments: attachment ? [attachment.id] : [] })
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const name = FIELD_OF[field]
          if (field.startsWith('guarantors')) {
            setGuarantorError(message)
            placed = true
          } else if (name) {
            form.setError(name, { message })
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
          <RequestEmployeeField
            control={form.control}
            name="employeeId"
            label="Employee"
            required
            placeholder="Select Employee"
            permission={typePermission('loan-advances', 'create')}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="typeId"
          label="Loan & Advances Type"
          required
          placeholder="Select Loan & Advances Type"
          options={[
            ...(payload && !types.some((item) => item.id === payload.loanTypeId)
              ? [{ value: payload.loanTypeId, label: payload.loanTypeName ?? '—' }]
              : []),
            ...types.map((item) => ({
              value: item.id,
              label: item.name,
              hint: item.eligible === false ? 'Not open to this contract type' : terms(item),
            })),
          ]}
          onValueChange={() => {
            setGuarantorError(null)
          }}
        />
        {type && (
          <p className="-mt-3 text-xs text-muted-foreground">
            {[terms(type), type.description].filter(Boolean).join(' · ')}
          </p>
        )}
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
        <RequestFileField value={attachment} onChange={setAttachment} disabled={pending} />
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
