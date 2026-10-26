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
import { attachmentRef, syncAttachments } from '../../../utils/request-files'
import type { StandardFormProps } from '../../standard.types'
import { standardButton, standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useUpdateStandard } from '../../use-standard'
import { money, parseAmount, requestBody, toAmount, todayIso } from '../expense/claims.utils'
import { REQUISITION_TYPE_LABELS } from './requisition.constants'
import {
  REQUISITION_TYPES,
  type RequisitionDetailsInput,
  type RequisitionPayload,
  type RequisitionType,
} from './requisition.types'

const lineSchema = z.object({
  itemName: z.string().trim().min(1, 'Enter the item').max(200, 'Keep it under 200 characters'),
  quantity: z
    .string()
    .refine((value) => (parseAmount(value) ?? 0) > 0, { message: 'Enter a quantity above 0' }),
  unit: z.string().trim().max(50, 'Keep it under 50 characters'),
  estimatedUnitCost: z
    .string()
    .refine((value) => value.trim() === '' || parseAmount(value) !== null, {
      message: 'Enter an amount, or leave it empty',
    }),
  description: z.string().trim().max(4000),
})

const schema = z.object({
  employeeId: z.string().nullable(),
  title: z.string().trim().min(1, 'Enter the title').max(200, 'Keep it under 200 characters'),
  requisitionType: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the type' }),
  neededByDate: z
    .string()
    .min(1, 'Choose the date')
    .refine((value) => !value || value >= todayIso(), { message: 'Choose today or a later day' }),
  deliveryLocation: z.string().trim().max(200),
  lines: z.array(lineSchema).min(1, 'Add an item').max(100, 'Ask for 100 items at most'),
  reason: z.string().trim().min(1, 'Give the justification').max(4000),
  attachment: z.custom<FileRef | null>(),
})
type Values = z.infer<typeof schema>
type LineValues = Values['lines'][number]

const emptyLine = (): LineValues => ({
  itemName: '',
  quantity: '1',
  unit: '',
  estimatedUnitCost: '',
  description: '',
})

const TITLES = {
  create: 'Create Requisition',
  edit: 'Requisition Edit',
  view: 'Requisition View',
} as const

const TYPE_OPTIONS = REQUISITION_TYPES.map((value) => ({
  value,
  label: REQUISITION_TYPE_LABELS[value],
}))

const HEADER_FIELDS = new Set(['title', 'requisitionType', 'neededByDate', 'deliveryLocation'])

function CostField({
  control,
  index,
  disabled,
}: {
  control: ReturnType<typeof useForm<Values>>['control']
  index: number
  disabled: boolean
}) {
  const { field, fieldState } = useController({
    control,
    name: `lines.${index}.estimatedUnitCost`,
  })
  return (
    <FormField label="Estimated Unit Cost" error={fieldState.error?.message}>
      {(a11y) => (
        <RsInput {...a11y} value={field.value} onChange={field.onChange} disabled={disabled} />
      )}
    </FormField>
  )
}

/**
 * "Create Requisition" (designed here; no form in any document): Title*,
 * Type*, Needed By*, Delivery Location, the items (Item*, Quantity*, Unit,
 * Estimated Unit Cost, Description), Justification* and an attachment.
 */
export function RequisitionForm({
  mode,
  scope,
  request,
  onClose,
}: StandardFormProps<RequisitionPayload>) {
  const formId = useId()
  const create = useCreateStandard('requisition')
  const update = useUpdateStandard('requisition')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const payload = request?.payload
  const firstFile = request?.attachments[0]

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      title: payload?.title ?? '',
      requisitionType: payload?.requisitionType ?? null,
      neededByDate: payload?.neededByDate ?? '',
      deliveryLocation: payload?.deliveryLocation ?? '',
      lines: payload
        ? payload.lines.map((line) => ({
            itemName: line.itemName,
            quantity: String(toAmount(line.quantity) ?? ''),
            unit: line.unit ?? '',
            estimatedUnitCost:
              line.estimatedUnitCost === null ? '' : String(toAmount(line.estimatedUnitCost)),
            description: line.description ?? '',
          }))
        : [emptyLine()],
      reason: request?.reason ?? '',
      attachment: firstFile ? attachmentRef(firstFile) : null,
    },
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const watched = useWatch({ control: form.control, name: 'lines' })
  const estimate = watched.reduce(
    (sum, line) =>
      sum + (parseAmount(line.quantity) ?? 0) * (parseAmount(line.estimatedUnitCost) ?? 0),
    0,
  )
  const attachment = useController({ control: form.control, name: 'attachment' })

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const body: RequestBody<RequisitionDetailsInput> = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: values.neededByDate,
      toDate: values.neededByDate,
      reason: values.reason.trim(),
      ...(mode === 'create' && values.attachment ? { attachments: [values.attachment.id] } : {}),
      details: {
        title: values.title.trim(),
        requisitionType: values.requisitionType as RequisitionType,
        neededByDate: values.neededByDate,
        deliveryLocation: values.deliveryLocation.trim() || null,
        lines: values.lines.map((line) => ({
          itemName: line.itemName.trim(),
          quantity: parseAmount(line.quantity) ?? 0,
          unit: line.unit.trim() || null,
          estimatedUnitCost: parseAmount(line.estimatedUnitCost),
          description: line.description.trim() || null,
        })),
      },
      ...(mode === 'edit' && request ? { rowVersion: request.rowVersion } : {}),
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({ id: request.id, body: requestBody(body) })
        await syncAttachments('requisition', request.id, request.attachments, [values.attachment])
      } else {
        await create.mutateAsync(requestBody(body))
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const key = field.replace(/^details\./, '')
          const line = /^lines\.(\d+)\.(\w+)$/.exec(key)
          if (line?.[2] && line[2] in emptyLine()) {
            form.setError(`lines.${Number(line[1])}.${line[2] as keyof LineValues}`, { message })
            placed = true
          } else if (HEADER_FIELDS.has(key) || key === 'reason' || key === 'employeeId') {
            form.setError(key as keyof Values, { message })
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
            permission={typePermission('requisition', 'create')}
            current={request?.employee}
            required
            disabled={!pickPerson}
          />
        )}
        <TextField
          control={form.control}
          name="title"
          label="Title"
          required
          maxLength={200}
          placeholder="Write here"
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="requisitionType"
          label="Type"
          required
          placeholder="Select"
          disabled={readOnly}
          options={TYPE_OPTIONS}
        />
        <DateField
          control={form.control}
          name="neededByDate"
          label="Needed By"
          required
          disabled={readOnly}
          minDate={new Date()}
        />
        <TextField
          control={form.control}
          name="deliveryLocation"
          label="Delivery Location"
          maxLength={200}
          placeholder="Write here"
          disabled={readOnly}
        />
        {lines.fields.map((line, index) => (
          <section
            key={line.id}
            aria-label={`Item ${String(index + 1)}`}
            className="grid gap-4 rounded-md border p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-inter text-base font-semibold text-heading">
                Item {String(index + 1)}
              </h3>
              {!readOnly && lines.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove item ${String(index + 1)}`}
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
              name={`lines.${index}.itemName`}
              label="Item"
              required
              maxLength={200}
              placeholder="Write here"
              disabled={readOnly}
            />
            <TextField
              control={form.control}
              name={`lines.${index}.quantity`}
              label="Quantity"
              required
              inputMode="decimal"
              disabled={readOnly}
            />
            <TextField
              control={form.control}
              name={`lines.${index}.unit`}
              label="Unit"
              maxLength={50}
              placeholder="pcs, boxes …"
              disabled={readOnly}
            />
            <CostField control={form.control} index={index} disabled={readOnly} />
            <TextField
              control={form.control}
              name={`lines.${index}.description`}
              label="Description"
              maxLength={4000}
              placeholder="Write here"
              disabled={readOnly}
            />
          </section>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-inter text-sm text-heading">
            Estimated Amount: <span className="font-semibold">{money(estimate)}</span>
          </p>
          {!readOnly && lines.fields.length < 100 && (
            <Button
              type="button"
              onClick={() => {
                lines.append(emptyLine())
              }}
              className={cn('h-9 gap-1 rounded-[5px] px-4 text-sm', standardButton.navy)}
            >
              <Plus aria-hidden="true" className="size-4" /> Add Item
            </Button>
          )}
        </div>
        <TextareaField
          control={form.control}
          name="reason"
          label="Justification"
          required
          rows={4}
          maxLength={4000}
          placeholder="Why is it needed?"
          disabled={readOnly}
        />
        <RequestFileField
          value={attachment.field.value ?? null}
          onChange={attachment.field.onChange}
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}
