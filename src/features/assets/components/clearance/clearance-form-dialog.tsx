import { type SyntheticEvent, useEffect, useId, useRef, useState } from 'react'
import {
  type Control,
  type FieldPath,
  useController,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'

import { FormField, SelectField, TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  btn,
  DateField,
  EmployeeSearchSelectField,
  PayrollDialog,
  type SearchOption,
  SearchSelectField,
  SectionTitle,
  toolbarButton,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { personHint } from '../../api/lookups.api'
import { RETURN_CONDITION_LABELS, RETURN_STATUS_LABELS } from '../../constants'
import { useClearance, useClearancePrefill, useSaveClearance } from '../../hooks/use-assets'
import {
  type Clearance,
  type ClearanceInput,
  type ClearancePrefillItem,
  type EmployeeLookupItem,
  RETURN_CONDITIONS,
  RETURN_STATUSES,
} from '../../types/assets.types'
import { UploadField } from '../shared/upload-field'

const DATE = 'EEE, d MMM yyyy'

/** Opens a new form for someone leaving: who, and the End of Employment record it belongs to. */
export interface ClearancePrefillProps {
  employeeId: string
  endOfEmploymentId: string | null
  clearanceDate?: string | undefined
}

const lineSchema = z.object({
  assetAllocationId: z.string().min(1, 'Choose the asset'),
  conditionAtClearance: z.enum(RETURN_CONDITIONS),
  reason: z.string().trim().max(500, 'Keep it under 500 characters'),
  returnStatus: z
    .enum(RETURN_STATUSES)
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the return status' }),
  comments: z.string().trim().max(1000, 'Keep it under 1000 characters'),
})

const schema = z.object({
  employeeId: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message: 'Choose the employee' }),
  clearanceDate: z.string().min(1, 'Choose the clearance date'),
  items: z.array(lineSchema).min(1, 'Add the assets being cleared'),
  checkedById: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvalDate: z.string(),
})
type Values = z.infer<typeof schema>
type Line = Values['items'][number]

const lineFor = (assetAllocationId: string): Line => ({
  assetAllocationId,
  conditionAtClearance: 'good',
  reason: '',
  returnStatus: null,
  comments: '',
})

const today = () => format(new Date(), 'yyyy-MM-dd')

const toValues = (
  detail: Clearance | undefined,
  prefill: ClearancePrefillProps | undefined,
): Values => ({
  employeeId: detail?.employeeId ?? prefill?.employeeId ?? null,
  clearanceDate: detail?.clearanceDate ?? prefill?.clearanceDate ?? today(),
  items: detail
    ? detail.items.map((item) => ({
        assetAllocationId: item.assetAllocationId,
        conditionAtClearance: item.conditionAtClearance ?? 'good',
        reason: item.reason ?? '',
        returnStatus: item.returnStatus,
        comments: item.comments ?? '',
      }))
    : [],
  checkedById: detail?.checkedById ?? null,
  approvedById: detail?.approvedById ?? null,
  approvalDate: detail?.approvalDate ?? '',
})

/** View draws every box grey, not faded white. */
const viewFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100',
  '[&_input:read-only]:border-transparent [&_input:read-only]:bg-[#D9D9D9]/60',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)

/** A filled-in box the person cannot type in (Employee ID, Department, Asset ID). */
function ReadOnlyBox({
  label,
  value,
  required,
}: {
  label: string
  value: string
  required?: boolean
}) {
  return (
    <FormField label={label} required={required}>
      {(a11y) => <Input {...a11y} readOnly value={value} />}
    </FormField>
  )
}

/**
 * "Return Status": Complete Return, Partial Return, Not Returned. Drawn as
 * three check boxes, but only one can be true, so they act as one choice.
 */
function ReturnStatusField({
  control,
  name,
  disabled,
}: {
  control: Control<Values>
  name: `items.${number}.returnStatus`
  disabled: boolean
}) {
  const { field, fieldState } = useController({ control, name })
  const labelId = useId()
  const errorId = useId()
  const value = field.value
  return (
    <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
      <span id={labelId} className="font-inter text-sm text-heading @xl:text-base">
        Return Status
        {!disabled && (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        )}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={fieldState.error ? errorId : undefined}
        className="flex flex-wrap items-center gap-x-10 gap-y-3"
      >
        {RETURN_STATUSES.map((status) => {
          const checked = value === status
          return (
            <button
              key={status}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled}
              onClick={() => {
                field.onChange(checked ? null : status)
              }}
              className="flex items-center gap-3 rounded-sm font-inter text-sm text-heading outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed"
            >
              <span className="max-w-24 text-left leading-snug">
                {RETURN_STATUS_LABELS[status]}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 items-center justify-center rounded-[0.1875rem] border border-[#5f6b7a]',
                  checked && 'border-[#6631C7] bg-[#6631C7] text-white',
                  disabled && 'border-transparent bg-[#D9D9D9]',
                  disabled && checked && 'bg-[#9a9a9a]',
                )}
              >
                {checked && (
                  <svg viewBox="0 0 12 12" className="size-3" fill="none">
                    <path
                      d="M2.5 6.2 4.9 8.5 9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>
      {fieldState.error && (
        <p id={errorId} className="text-xs text-destructive @xl:col-start-2">
          {fieldState.error.message}
        </p>
      )}
    </div>
  )
}

const TITLES = {
  create: 'Clearance Form Create',
  edit: 'Clearance Form Edit',
  view: 'Clearance Form View',
} as const

/** The fields a server error can name, so it shows under the field. */
const KNOWN_FIELD =
  /^(employeeId|clearanceDate|checkedById|approvedById|approvalDate|items\.\d+\.\w+)$/

/**
 * "Clearance Form Create" / Edit / View: the person, then one "Asset Details"
 * block per asset they hold, then "Verification & Approval".
 */
export function ClearanceFormDialog({
  id,
  mode,
  prefill,
  onClose,
}: {
  id: string | null
  mode: 'create' | 'edit' | 'view'
  prefill?: ClearancePrefillProps | undefined
  onClose: () => void
}) {
  const clearance = useClearance(id)
  if (id && !clearance.data) {
    return (
      <PayrollDialog title={TITLES[mode]} onClose={onClose} readOnly>
        <Skeleton className="h-96 w-full" />
      </PayrollDialog>
    )
  }
  return <ClearanceForm detail={clearance.data} mode={mode} prefill={prefill} onClose={onClose} />
}

function ClearanceForm({
  detail,
  mode,
  prefill,
  onClose,
}: {
  detail: Clearance | undefined
  mode: 'create' | 'edit' | 'view'
  prefill: ClearancePrefillProps | undefined
  onClose: () => void
}) {
  const formId = useId()
  const save = useSaveClearance()
  const readOnly = mode === 'view'
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(detail, prefill),
  })
  const [attachment, setAttachment] = useState<FileRef | null>(detail?.file ?? null)
  const items = useFieldArray({ control: form.control, name: 'items' })
  const [employeeId, watchedItems] = useWatch({
    control: form.control,
    name: ['employeeId', 'items'],
  })
  // The person last picked from the lookup (their code and department, before the prefill).
  const [picked, setPicked] = useState<EmployeeLookupItem | undefined>()
  const held = useClearancePrefill(readOnly ? null : employeeId)
  const heldItems = held.data?.employeeId === employeeId ? held.data.items : []

  // A new form fills Asset Details with what the chosen person holds.
  const filledFor = useRef<string | null>(detail ? detail.employeeId : null)
  useEffect(() => {
    if (mode !== 'create' || !employeeId || held.data?.employeeId !== employeeId) return
    if (filledFor.current === employeeId) return
    filledFor.current = employeeId
    items.replace(held.data.items.map((item) => lineFor(item.assetAllocationId)))
  }, [employeeId, held.data, items, mode])

  // What each Asset Details block can name: the person's open allocations and the ones on the form.
  const known = new Map<string, ClearancePrefillItem>()
  for (const item of detail?.items ?? []) known.set(item.assetAllocationId, item)
  for (const item of heldItems) known.set(item.assetAllocationId, item)
  const assetChoices = [...known.values()].map((item) => ({
    value: item.assetAllocationId,
    label: item.assetName,
    hint: [item.assetCode, item.identificationNo].filter(Boolean).join(' · '),
  }))
  const unused = assetChoices.filter(
    (choice) => !watchedItems.some((line) => line.assetAllocationId === choice.value),
  )

  // People: searched on the server; whoever the record already names keeps their name
  // (they may have left since, or sit on a page the lookup has not read).
  const named: SearchOption[] = []
  const name = (id: string | null, label: string | null | undefined) => {
    if (id && label && !named.some((option) => option.value === id)) {
      named.push({ value: id, label })
    }
  }
  name(detail?.employeeId ?? null, detail?.employeeName)
  name(held.data?.employeeId ?? null, held.data?.employeeName)
  name(detail?.checkedById ?? null, detail?.checkedByName)
  name(detail?.approvedById ?? null, detail?.approvedByName)
  const people = { permission: 'assets.clearance.create' }
  const lookedUp = picked?.id === employeeId ? picked : undefined
  const employeeCode = detail?.employeeCode ?? held.data?.employeeCode ?? lookedUp?.code ?? ''
  const department =
    detail?.departmentName ?? held.data?.departmentName ?? lookedUp?.departmentName ?? ''

  const submit = form.handleSubmit(async (values) => {
    const input: ClearanceInput = {
      employeeId: values.employeeId ?? '',
      endOfEmploymentId:
        detail?.endOfEmploymentId ??
        prefill?.endOfEmploymentId ??
        held.data?.endOfEmploymentId ??
        null,
      clearanceDate: values.clearanceDate,
      checkedById: values.checkedById,
      approvedById: values.approvedById,
      approvalDate: values.approvalDate || null,
      fileId: attachment?.id ?? null,
      items: values.items.map((line) => ({
        assetAllocationId: line.assetAllocationId,
        conditionAtClearance: line.conditionAtClearance,
        reason: line.reason || null,
        returnStatus: line.returnStatus ?? 'complete',
        comments: line.comments || null,
      })),
      rowVersion: detail?.rowVersion,
    }
    try {
      await save.mutateAsync({ id: detail?.id, input })
      onClose()
    } catch (error) {
      if (!(error instanceof ApiError)) {
        form.setError('root', { message: 'Could not save the clearance form.' })
        return
      }
      const [key, message] = Object.entries(error.fieldErrors)[0] ?? []
      if (key && message && KNOWN_FIELD.test(key)) {
        form.setError(key as FieldPath<Values>, { message })
      } else {
        form.setError('root', { message: error.message })
      }
    }
  })

  const lineErrors = form.formState.errors.items

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={
        form.formState.errors.root?.message ?? lineErrors?.root?.message ?? lineErrors?.message
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className={cn('grid gap-5', readOnly && viewFieldsClass)}
      >
        <EmployeeSearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee Name"
          placeholder="Select Employee"
          filters={people}
          enabled={!readOnly}
          known={named}
          hint={personHint}
          onValueChange={(_, row) => {
            setPicked(row)
          }}
          required={!readOnly}
          disabled={readOnly || mode === 'edit' || Boolean(prefill)}
        />
        <ReadOnlyBox label="Employee ID" value={employeeCode} />
        <ReadOnlyBox label="Department" value={department} />
        <DateField
          control={form.control}
          name="clearanceDate"
          label="Clearance Date"
          required={!readOnly}
          disabled={readOnly}
          display={DATE}
        />

        <SectionTitle>Asset Details</SectionTitle>
        {items.fields.length === 0 && (
          <p className="font-inter text-sm text-muted-foreground">
            {employeeId
              ? held.isPending
                ? 'Looking up the assets this person holds…'
                : 'This person holds no company assets.'
              : 'Choose the employee to list the assets they hold.'}
          </p>
        )}
        {items.fields.map((line, index) => {
          const allocationId = watchedItems[index]?.assetAllocationId ?? ''
          const asset = known.get(allocationId)
          const options = assetChoices.filter(
            (choice) =>
              choice.value === allocationId ||
              !watchedItems.some((other) => other.assetAllocationId === choice.value),
          )
          return (
            <section
              key={line.id}
              aria-label={`Asset ${String(index + 1)}${asset ? `, ${asset.assetName}` : ''}`}
              className={cn('grid gap-5', index > 0 && 'border-t pt-5')}
            >
              {items.fields.length > 1 && !readOnly && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      items.remove(index)
                    }}
                    className="h-8 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                    Remove asset {index + 1}
                  </Button>
                </div>
              )}
              <SearchSelectField
                control={form.control}
                name={`items.${index}.assetAllocationId` as const}
                label="Asset Name"
                placeholder="Select Asset"
                options={options}
                required={!readOnly}
                disabled={readOnly}
              />
              <ReadOnlyBox
                label="Asset ID"
                value={asset?.identificationNo ?? asset?.assetCode ?? ''}
              />
              <ReadOnlyBox
                label="Date Allocated"
                value={asset ? format(new Date(`${asset.allocatedOn}T00:00:00`), DATE) : ''}
              />
              <SelectField
                control={form.control}
                name={`items.${index}.conditionAtClearance` as const}
                label="Condition at Clearance"
                disabled={readOnly}
                required={!readOnly}
                options={RETURN_CONDITIONS.map((condition) => ({
                  value: condition,
                  label: RETURN_CONDITION_LABELS[condition],
                }))}
              />
              <TextareaField
                control={form.control}
                name={`items.${index}.reason` as const}
                label="Reason for Clearance"
                disabled={readOnly}
                textareaClassName="min-h-16"
              />
              <ReturnStatusField
                control={form.control}
                name={`items.${index}.returnStatus` as const}
                disabled={readOnly}
              />
              <TextareaField
                control={form.control}
                name={`items.${index}.comments` as const}
                label="Comments"
                disabled={readOnly}
                textareaClassName="min-h-36"
              />
            </section>
          )
        })}
        {!readOnly && items.fields.length > 0 && (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={unused.length === 0}
              onClick={() => {
                const next = unused[0]
                if (next) items.append(lineFor(next.value))
              }}
              className={cn(toolbarButton, btn.navy, 'gap-1')}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Add Asset
            </Button>
          </div>
        )}

        <SectionTitle>Verification &amp; Approval</SectionTitle>
        <EmployeeSearchSelectField
          control={form.control}
          name="checkedById"
          label="Checked By"
          placeholder="Select who checked the assets"
          filters={people}
          enabled={!readOnly}
          known={named}
          hint={personHint}
          disabled={readOnly}
        />
        <EmployeeSearchSelectField
          control={form.control}
          name="approvedById"
          label="Clearance Approved By"
          placeholder="Select who approves the clearance"
          filters={people}
          enabled={!readOnly}
          known={named}
          hint={personHint}
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="approvalDate"
          label="Approval Date"
          disabled={readOnly}
          display={DATE}
        />
        <UploadField
          value={attachment}
          onChange={setAttachment}
          module="assets"
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}
