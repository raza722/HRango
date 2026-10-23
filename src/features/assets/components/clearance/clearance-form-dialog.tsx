import { type SyntheticEvent, useEffect, useId, useRef } from 'react'
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
  AttachmentField,
  btn,
  DateField,
  PayrollDialog,
  SearchSelectField,
  SectionTitle,
  toolbarButton,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { CLEARANCE_CONDITION_LABELS, RETURN_STATUS_LABELS } from '../../constants'
import {
  useAssetLookups,
  useClearance,
  useClearancePrefill,
  useSaveClearance,
} from '../../hooks/use-assets'
import {
  CLEARANCE_CONDITIONS,
  type ClearanceDetail,
  type ClearanceInput,
  type ClearanceLineInput,
  RETURN_STATUSES,
} from '../../types/assets.types'

const DATE = 'EEE,d MMM yyyy'

/** Opens a new form for someone leaving: who, and the End of Employment record it belongs to. */
export interface ClearancePrefillProps {
  employeeId: string
  endOfEmploymentId: string | null
  clearanceDate?: string | undefined
}

const person = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const lineSchema = z.object({
  assetId: z.string().min(1, 'Choose the asset'),
  allocationId: z.string().nullable(),
  dateAllocated: z.string().min(1, 'Choose the date allocated'),
  condition: z.enum(CLEARANCE_CONDITIONS),
  reason: z.string().trim().max(500, 'Keep it under 500 characters'),
  returnStatus: z.enum(RETURN_STATUSES).nullable(),
  comments: z.string().trim().max(1000, 'Keep it under 1000 characters'),
})

const schema = z.object({
  employeeId: person('Choose the employee'),
  clearanceDate: z.string().min(1, 'Choose the clearance date'),
  lines: z.array(lineSchema).min(1, 'Add the assets being cleared'),
  checkedById: person('Choose who checked it'),
  approvedById: person('Choose who approved the clearance'),
  approvalDate: z.string().min(1, 'Choose the approval date'),
  attachmentName: z.string().nullable(),
})
type Values = z.infer<typeof schema>

const blankLine = (): ClearanceLineInput => ({
  assetId: '',
  allocationId: null,
  dateAllocated: '',
  condition: 'good',
  reason: '',
  returnStatus: null,
  comments: '',
})

const today = () => format(new Date(), 'yyyy-MM-dd')

const toValues = (
  detail: ClearanceDetail | undefined,
  prefill: ClearancePrefillProps | undefined,
): Values => ({
  employeeId: detail?.employeeId ?? prefill?.employeeId ?? null,
  clearanceDate: detail?.clearanceDate ?? prefill?.clearanceDate ?? today(),
  lines: detail
    ? detail.lines.map((line) => ({
        assetId: line.assetId,
        allocationId: line.allocationId,
        dateAllocated: line.dateAllocated,
        condition: line.condition,
        reason: line.reason,
        returnStatus: line.returnStatus,
        comments: line.comments,
      }))
    : [],
  checkedById: detail?.checkedById ?? null,
  approvedById: detail?.approvedById ?? null,
  approvalDate: detail?.approvalDate ?? today(),
  attachmentName: detail?.attachmentName ?? null,
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
  name: `lines.${number}.returnStatus`
  disabled: boolean
}) {
  const { field } = useController({ control, name })
  const labelId = useId()
  const value = field.value
  return (
    <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
      <span id={labelId} className="font-inter text-sm text-heading @xl:text-base">
        Return Status
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
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
    </div>
  )
}

const TITLES = {
  create: 'Clearance Form Create',
  edit: 'Clearance Form Edit',
  view: 'Clearance Form View',
} as const

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
  detail: ClearanceDetail | undefined
  mode: 'create' | 'edit' | 'view'
  prefill: ClearancePrefillProps | undefined
  onClose: () => void
}) {
  const formId = useId()
  const lookups = useAssetLookups()
  const save = useSaveClearance()
  const readOnly = mode === 'view'
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(detail, prefill),
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const [employeeId, attachment, watchedLines] = useWatch({
    control: form.control,
    name: ['employeeId', 'attachmentName', 'lines'],
  })
  const held = useClearancePrefill(readOnly ? null : employeeId)
  const employees = lookups.data?.employees ?? []
  const chosen = employees.find((item) => item.id === employeeId)
  const assetsById = new Map((lookups.data?.assets ?? []).map((asset) => [asset.id, asset]))
  const heldLines = held.data?.lines ?? []

  // A new form fills Asset Details with what the chosen person holds.
  const filledFor = useRef<string | null>(detail ? detail.employeeId : null)
  useEffect(() => {
    if (mode !== 'create' || !employeeId || !held.data) return
    if (held.data.employee.id !== employeeId || filledFor.current === employeeId) return
    filledFor.current = employeeId
    lines.replace(held.data.lines.length > 0 ? held.data.lines : [blankLine()])
  }, [employeeId, held.data, lines, mode])

  const people = employees.map((item) => ({
    value: item.id,
    label: item.name,
    hint: `${item.code} · ${item.designation}`,
  }))
  const activePeople = people.filter(
    (option) => employees.find((item) => item.id === option.value)?.status === 'active',
  )

  // The person's allocated assets (and, when editing, the ones already on the form).
  const assetChoices = [
    ...new Set([
      ...heldLines.map((line) => line.assetId),
      ...(detail?.lines.map((line) => line.assetId) ?? []),
    ]),
  ].map((assetId) => {
    const asset = assetsById.get(assetId)
    return {
      value: assetId,
      label: asset?.name ?? assetId,
      hint: asset ? `${asset.code} · ${asset.identificationNumber}` : undefined,
    }
  })
  const unused = assetChoices.filter(
    (choice) => !watchedLines.some((line) => line.assetId === choice.value),
  )

  const pickAsset = (index: number, assetId: string | null) => {
    const from = heldLines.find((line) => line.assetId === assetId)
    const old = detail?.lines.find((line) => line.assetId === assetId)
    form.setValue(`lines.${index}.allocationId`, from?.allocationId ?? old?.allocationId ?? null)
    form.setValue(`lines.${index}.dateAllocated`, from?.dateAllocated ?? old?.dateAllocated ?? '', {
      shouldValidate: form.formState.isSubmitted,
    })
  }

  const submit = form.handleSubmit(async (values) => {
    const input: ClearanceInput = {
      employeeId: values.employeeId ?? '',
      clearanceDate: values.clearanceDate,
      lines: values.lines,
      checkedById: values.checkedById ?? '',
      approvedById: values.approvedById ?? '',
      approvalDate: values.approvalDate,
      attachmentName: values.attachmentName,
      endOfEmploymentId: detail?.endOfEmploymentId ?? prefill?.endOfEmploymentId ?? null,
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
      const known =
        key &&
        /^(employeeId|clearanceDate|checkedById|approvedById|approvalDate|lines\.\d+\.\w+)$/.test(
          key,
        )
      if (key && message && known) {
        form.setError(key as FieldPath<Values>, { message })
      } else {
        form.setError('root', { message: error.message })
      }
    }
  })

  const lineErrors = form.formState.errors.lines

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
        <SearchSelectField
          control={form.control}
          name="employeeId"
          label="Employee Name"
          placeholder="Select Employee"
          options={mode === 'create' ? activePeople : people}
          required={!readOnly}
          disabled={readOnly || mode === 'edit' || Boolean(prefill)}
        />
        <ReadOnlyBox label="Employee ID" value={chosen?.code ?? ''} required={!readOnly} />
        <ReadOnlyBox label="Department" value={chosen?.department ?? ''} required={!readOnly} />
        <DateField
          control={form.control}
          name="clearanceDate"
          label="Clearance Date"
          required={!readOnly}
          disabled={readOnly}
          display={DATE}
        />

        <SectionTitle>Asset Details</SectionTitle>
        {lines.fields.length === 0 && (
          <p className="font-inter text-sm text-muted-foreground">
            {employeeId
              ? held.isPending
                ? 'Looking up the assets this person holds…'
                : 'This person holds no company assets.'
              : 'Choose the employee to list the assets they hold.'}
          </p>
        )}
        {lines.fields.map((line, index) => {
          const assetId = watchedLines[index]?.assetId ?? ''
          const asset = assetsById.get(assetId)
          const options = assetChoices.filter(
            (choice) =>
              choice.value === assetId ||
              !watchedLines.some((other) => other.assetId === choice.value),
          )
          return (
            <section
              key={line.id}
              aria-label={`Asset ${String(index + 1)}${asset ? `, ${asset.name}` : ''}`}
              className={cn('grid gap-5', index > 0 && 'border-t pt-5')}
            >
              {lines.fields.length > 1 && !readOnly && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      lines.remove(index)
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
                name={`lines.${index}.assetId` as const}
                label="Asset Name"
                placeholder="Select Asset"
                options={options}
                required={!readOnly}
                disabled={readOnly}
                onValueChange={(next) => {
                  pickAsset(index, next)
                }}
              />
              <ReadOnlyBox
                label="Asset ID"
                value={asset?.identificationNumber ?? ''}
                required={!readOnly}
              />
              <DateField
                control={form.control}
                name={`lines.${index}.dateAllocated` as const}
                label="Date Allocated"
                required={!readOnly}
                disabled
                display={DATE}
              />
              <SelectField
                control={form.control}
                name={`lines.${index}.condition` as const}
                label="Condition at Clearance"
                disabled={readOnly}
                options={CLEARANCE_CONDITIONS.map((condition) => ({
                  value: condition,
                  label: CLEARANCE_CONDITION_LABELS[condition],
                }))}
              />
              <TextareaField
                control={form.control}
                name={`lines.${index}.reason` as const}
                label="Reason for Clearance"
                disabled={readOnly}
                textareaClassName="min-h-16"
              />
              <ReturnStatusField
                control={form.control}
                name={`lines.${index}.returnStatus` as const}
                disabled={readOnly}
              />
              <TextareaField
                control={form.control}
                name={`lines.${index}.comments` as const}
                label="Comments"
                disabled={readOnly}
                textareaClassName="min-h-36"
              />
            </section>
          )
        })}
        {!readOnly && lines.fields.length > 0 && (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={unused.length === 0}
              onClick={() => {
                lines.append(blankLine())
              }}
              className={cn(toolbarButton, btn.navy, 'gap-1')}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Add Asset
            </Button>
          </div>
        )}

        <SectionTitle>Verification &amp; Approval</SectionTitle>
        <SearchSelectField
          control={form.control}
          name="checkedById"
          label="Checked By"
          placeholder="Employee"
          options={activePeople}
          required={!readOnly}
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="approvedById"
          label="Clearance Approved By"
          placeholder="Employee"
          options={activePeople}
          required={!readOnly}
          disabled={readOnly}
        />
        <DateField
          control={form.control}
          name="approvalDate"
          label="Approval Date"
          required={!readOnly}
          disabled={readOnly}
          display={DATE}
        />
        <AttachmentField
          value={attachment}
          disabled={readOnly}
          onChange={(name) => {
            form.setValue('attachmentName', name, { shouldDirty: true })
          }}
        />
      </form>
    </PayrollDialog>
  )
}
