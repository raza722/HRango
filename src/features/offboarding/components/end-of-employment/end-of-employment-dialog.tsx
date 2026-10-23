import { type SyntheticEvent, useId, useState } from 'react'
import { type Control, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { FieldLayoutContext, FormField, TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AttachmentField,
  btn,
  DateField,
  DateInput,
  dialogFieldType,
  footerButton,
  SearchSelectField,
  SectionTitle,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { EOE_REASON_LABELS } from '../../constants'
import {
  useEmployeeCard,
  useEndOfEmployment,
  useOffboardingLookups,
  useSaveEndOfEmployment,
} from '../../hooks/use-offboarding'
import {
  type ChecklistField,
  type ChecklistValue,
  type EndOfEmploymentDetail,
  type EndOfEmploymentInput,
  EOE_REASONS,
} from '../../types/offboarding.types'
import { EmployeeInfoCard } from './employee-info-card'

const DATE = 'MMMM d, yyyy'

const person = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    employeeId: person('Choose the employee'),
    reason: person('Choose the reason'),
    noticePeriod: z.boolean(),
    lastWorkingDate: z.string(),
    finalSettlement: z.boolean(),
    assetClearance: z.boolean(),
    attachmentName: z.string().nullable(),
    description: z.string().trim().max(1000, 'Keep it under 1000 characters'),
    delegateeId: z.string().nullable(),
    checklist: z.record(z.string(), z.union([z.string(), z.boolean()])),
  })
  .refine((value) => !value.noticePeriod || value.lastWorkingDate !== '', {
    message: 'Choose the last working date',
    path: ['lastWorkingDate'],
  })
  .refine((value) => !value.delegateeId || value.delegateeId !== value.employeeId, {
    message: 'Choose someone else as the delegatee',
    path: ['delegateeId'],
  })
type Values = z.infer<typeof schema>

const formValue = (value: ChecklistValue | undefined, field: ChecklistField) =>
  field.type === 'boolean'
    ? value === true
    : value === null || value === undefined
      ? ''
      : String(value)

const toValues = (
  detail: EndOfEmploymentDetail | undefined,
  fields: readonly ChecklistField[],
): Values => ({
  employeeId: detail?.employeeId ?? null,
  reason: detail?.reason ?? null,
  noticePeriod: detail?.noticePeriod ?? false,
  lastWorkingDate: detail?.noticePeriod ? (detail.lastWorkingDate ?? '') : '',
  finalSettlement: detail?.finalSettlement ?? false,
  assetClearance: detail?.assetClearance ?? false,
  attachmentName: detail?.attachmentName ?? null,
  description: detail?.description ?? '',
  delegateeId: detail?.delegateeId ?? null,
  checklist: Object.fromEntries(
    fields.map((field) => [field.id, formValue(detail?.checklist[field.id], field)]),
  ),
})

/** The answer as the API stores it: numbers as numbers, blanks as null. */
function toChecklist(
  values: Values['checklist'],
  fields: readonly ChecklistField[],
): Record<string, ChecklistValue> {
  return Object.fromEntries(
    fields.map((field): [string, ChecklistValue] => {
      const value = values[field.id]
      if (field.type === 'boolean') return [field.id, value === true]
      const text = typeof value === 'string' ? value.trim() : ''
      if (text === '') return [field.id, null]
      return [field.id, field.type === 'number' ? Number(text) : text]
    }),
  )
}

/** The Checklist tab's rules, checked before saving (the server checks them too). */
function checklistErrors(values: Values['checklist'], fields: readonly ChecklistField[]) {
  const errors: [string, string][] = []
  for (const field of fields) {
    const value = values[field.id]
    const text = typeof value === 'string' ? value.trim() : ''
    if (field.type === 'boolean') continue
    if (text === '') {
      if (field.required) errors.push([field.id, `Enter ${field.name}`])
      continue
    }
    if (field.type === 'number') {
      const number = Number(text)
      if (!Number.isFinite(number)) errors.push([field.id, 'Enter a number'])
      else if (field.min !== null && number < field.min)
        errors.push([field.id, `At least ${String(field.min)}`])
      else if (field.max !== null && number > field.max)
        errors.push([field.id, `At most ${String(field.max)}`])
    }
    if (field.type === 'string') {
      if (field.min !== null && text.length < field.min)
        errors.push([field.id, `At least ${String(field.min)} characters`])
      else if (field.max !== null && text.length > field.max)
        errors.push([field.id, `At most ${String(field.max)} characters`])
    }
  }
  return errors
}

/** View draws every box grey, not faded white. */
const viewFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)

type CheckName = 'noticePeriod' | 'finalSettlement' | 'assetClearance'

/** One violet check box bound to the form. */
function FormCheck({
  id,
  control,
  name,
  disabled,
}: {
  id: string
  control: Control<Values>
  name: CheckName
  disabled: boolean
}) {
  const { field } = useController({ control, name })
  return (
    <Checkbox
      id={id}
      tone="violet"
      checked={field.value}
      disabled={disabled}
      onCheckedChange={(checked) => {
        field.onChange(checked === true)
      }}
      className="size-4.5 rounded-[0.125rem]"
    />
  )
}

/**
 * "Notice Period ☐   Final Settlement ☐   Asset Clearance ☐" as drawn: the
 * first label in the label column, the other two inline after its box.
 */
function ChecksRow({ control, disabled }: { control: Control<Values>; disabled: boolean }) {
  const baseId = useId()
  const label = 'cursor-pointer font-inter text-sm text-heading @xl:text-base'
  return (
    <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
      <span className="flex items-center gap-4 @xl:contents">
        <Label htmlFor={`${baseId}-notice`} className={label}>
          Notice Period
        </Label>
        <span className="flex flex-wrap items-center gap-x-16 gap-y-3 @xl:min-h-10">
          <FormCheck
            id={`${baseId}-notice`}
            control={control}
            name="noticePeriod"
            disabled={disabled}
          />
          <span className="flex items-center gap-4">
            <Label htmlFor={`${baseId}-settlement`} className={label}>
              Final Settlement
            </Label>
            <FormCheck
              id={`${baseId}-settlement`}
              control={control}
              name="finalSettlement"
              disabled={disabled}
            />
          </span>
          <span className="flex items-center gap-4">
            <Label htmlFor={`${baseId}-clearance`} className={label}>
              Asset Clearance
            </Label>
            <FormCheck
              id={`${baseId}-clearance`}
              control={control}
              name="assetClearance"
              disabled={disabled}
            />
          </span>
        </span>
      </span>
    </div>
  )
}

/** One Checklist tab answer, by the field's type. */
function ChecklistInput({
  control,
  field,
  disabled,
}: {
  control: Control<Values>
  field: ChecklistField
  disabled: boolean
}) {
  const name = `checklist.${field.id}` as const
  const controller = useController({ control, name })
  if (field.type === 'date') {
    return (
      <FormField
        label={field.name}
        required={field.required}
        error={controller.fieldState.error?.message}
      >
        {(a11y) => (
          <DateInput
            {...a11y}
            value={typeof controller.field.value === 'string' ? controller.field.value : ''}
            onChange={controller.field.onChange}
            disabled={disabled}
            placeholder=""
            display="d, MMMM yyyy"
          />
        )}
      </FormField>
    )
  }
  if (field.type === 'boolean') {
    const id = `${field.id}-check`
    return (
      <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center @3xl:grid-cols-[11rem_minmax(0,1fr)]">
        <Label
          htmlFor={id}
          className="cursor-pointer font-inter text-sm text-heading @xl:text-base"
        >
          {field.name}
        </Label>
        <Checkbox
          id={id}
          tone="violet"
          checked={controller.field.value === true}
          disabled={disabled}
          onCheckedChange={(checked) => {
            controller.field.onChange(checked === true)
          }}
          className="size-4.5 rounded-[0.125rem]"
        />
      </div>
    )
  }
  const hint =
    field.type === 'number'
      ? [
          field.min !== null ? `from ${String(field.min)}` : null,
          field.max !== null ? `up to ${String(field.max)}` : null,
        ]
      : [field.max !== null ? `up to ${String(field.max)} characters` : null]
  const description = hint.filter(Boolean).join(' ')
  return (
    <FormField
      label={field.name}
      required={field.required}
      error={controller.fieldState.error?.message}
      description={
        description ? description.charAt(0).toUpperCase() + description.slice(1) : undefined
      }
    >
      {(a11y) => (
        <Input
          {...a11y}
          type={field.type === 'number' ? 'number' : 'text'}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          min={field.type === 'number' ? (field.min ?? undefined) : undefined}
          max={field.type === 'number' ? (field.max ?? undefined) : undefined}
          maxLength={field.type === 'string' ? (field.max ?? undefined) : undefined}
          disabled={disabled}
          value={typeof controller.field.value === 'string' ? controller.field.value : ''}
          onChange={(event) => {
            controller.field.onChange(event.target.value)
          }}
          onBlur={controller.field.onBlur}
        />
      )}
    </FormField>
  )
}

type Tab = 'information' | 'checklist'

/**
 * End of Employment Create / Edit / View: the person's card, then the
 * Information and Checklist tabs. No title is drawn; it is read out.
 */
export function EndOfEmploymentDialog({
  id,
  mode,
  onClose,
  onSaved,
}: {
  id: string | null
  mode: 'create' | 'edit' | 'view'
  onClose: () => void
  /** After a save: the record as the server now has it. */
  onSaved?: (record: EndOfEmploymentDetail) => void
}) {
  const record = useEndOfEmployment(id)
  const lookups = useOffboardingLookups()
  if ((id && !record.data) || !lookups.data) {
    return (
      <AppDialog title="End of Employment" hideTitle onRequestClose={onClose} className="max-w-4xl">
        <Skeleton className="h-96 w-full" />
      </AppDialog>
    )
  }
  return (
    <RecordForm
      detail={record.data}
      mode={mode}
      fields={lookups.data.checklistFields}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function RecordForm({
  detail,
  mode,
  fields,
  onClose,
  onSaved,
}: {
  detail: EndOfEmploymentDetail | undefined
  mode: 'create' | 'edit' | 'view'
  fields: readonly ChecklistField[]
  onClose: () => void
  onSaved: ((record: EndOfEmploymentDetail) => void) | undefined
}) {
  const formId = useId()
  const tabsId = useId()
  const [tab, setTab] = useState<Tab>('information')
  const lookups = useOffboardingLookups()
  const save = useSaveEndOfEmployment()
  const readOnly = mode === 'view'
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(detail, fields),
  })
  const [employeeId, noticePeriod, attachment] = useWatch({
    control: form.control,
    name: ['employeeId', 'noticePeriod', 'attachmentName'],
  })
  const card = useEmployeeCard(detail ? null : employeeId)
  const employees = lookups.data?.employees ?? []
  const people = employees.map((item) => ({
    value: item.id,
    label: item.name,
    hint: `${item.code} · ${item.designation}`,
  }))
  const active = people.filter(
    (option) => employees.find((item) => item.id === option.value)?.status === 'active',
  )
  const reasons = EOE_REASONS.map((reason) => ({ value: reason, label: EOE_REASON_LABELS[reason] }))
  const title =
    mode === 'create'
      ? 'End of Employment Create'
      : mode === 'edit'
        ? 'End of Employment Edit'
        : 'End of Employment View'

  const submit = form.handleSubmit(async (values) => {
    const problems = checklistErrors(values.checklist, fields)
    if (problems.length > 0) {
      for (const [fieldId, message] of problems) {
        form.setError(`checklist.${fieldId}`, { message })
      }
      setTab('checklist')
      return
    }
    const input: EndOfEmploymentInput = {
      employeeId: values.employeeId ?? '',
      reason: EOE_REASONS.find((item) => item === values.reason) ?? 'other',
      noticePeriod: values.noticePeriod,
      lastWorkingDate: values.noticePeriod ? values.lastWorkingDate : null,
      finalSettlement: values.finalSettlement,
      assetClearance: values.assetClearance,
      attachmentName: values.attachmentName,
      description: values.description.trim(),
      delegateeId: values.delegateeId,
      checklist: toChecklist(values.checklist, fields),
    }
    try {
      const saved = await save.mutateAsync({ id: detail?.id, input })
      onClose()
      onSaved?.(saved)
    } catch (error) {
      if (!(error instanceof ApiError)) {
        form.setError('root', { message: 'Could not save the end of employment record.' })
        return
      }
      const [key, message] = Object.entries(error.fieldErrors)[0] ?? []
      if (key && message && key.startsWith('checklist.')) {
        form.setError(key as `checklist.${string}`, { message })
        setTab('checklist')
      } else if (
        key &&
        message &&
        ['employeeId', 'reason', 'lastWorkingDate', 'delegateeId'].includes(key)
      ) {
        form.setError(key as 'employeeId', { message })
        setTab('information')
      } else {
        form.setError('root', { message: error.message })
      }
    }
  })

  const shownCard = detail?.card ?? card.data
  const rootError = form.formState.errors.root?.message

  return (
    <AppDialog
      title={title}
      hideTitle
      onRequestClose={onClose}
      className={cn('max-w-4xl', dialogFieldType)}
      footer={
        <>
          {rootError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {rootError}
            </p>
          )}
          {!readOnly && (
            <Button
              type="submit"
              form={formId}
              disabled={save.isPending}
              className={cn(footerButton, btn.green)}
            >
              Save
            </Button>
          )}
          <Button type="button" onClick={onClose} className={cn(footerButton, btn.red)}>
            Cancel
          </Button>
        </>
      }
    >
      <FieldLayoutContext value="horizontal">
        <div className="grid gap-7">
          <EmployeeInfoCard card={shownCard} pending={Boolean(employeeId) && card.isPending} />

          <div className="grid gap-4">
            <SectionTitle className="pt-0">
              {tab === 'information' ? 'End of Employment' : 'Off Boarding Checklist'}
            </SectionTitle>
            <div role="tablist" aria-label="End of employment sections" className="flex gap-6">
              {(['information', 'checklist'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  id={`${tabsId}-${item}`}
                  aria-selected={tab === item}
                  aria-controls={`${tabsId}-${item}-panel`}
                  onClick={() => {
                    setTab(item)
                  }}
                  className={cn(
                    'h-9 min-w-32 rounded-[4px] px-6 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    tab === item
                      ? 'bg-[#2F6FED] font-medium text-white'
                      : 'font-medium text-[#585858] hover:bg-muted dark:text-field-foreground',
                  )}
                >
                  {item === 'information' ? 'Information' : 'Checklist'}
                </button>
              ))}
            </div>
            {readOnly && detail && detail.waitingFor.length > 0 && (
              <p className="font-inter text-sm text-muted-foreground">
                Waiting for: {detail.waitingFor.join(', ')}
              </p>
            )}
          </div>

          <form
            id={formId}
            noValidate
            onSubmit={(event: SyntheticEvent) => void submit(event)}
            className={cn(readOnly && viewFieldsClass)}
          >
            <div
              role="tabpanel"
              id={`${tabsId}-information-panel`}
              aria-labelledby={`${tabsId}-information`}
              hidden={tab !== 'information'}
              className="grid gap-5"
            >
              <SearchSelectField
                control={form.control}
                name="employeeId"
                label="Employee"
                placeholder="Select Employee"
                options={mode === 'create' ? active : people}
                disabled={readOnly || mode === 'edit'}
              />
              <SearchSelectField
                control={form.control}
                name="reason"
                label="Reason"
                placeholder="Select Reason"
                options={reasons}
                required
                disabled={readOnly}
              />
              <ChecksRow control={form.control} disabled={readOnly} />
              {noticePeriod && (
                <DateField
                  control={form.control}
                  name="lastWorkingDate"
                  label="Last Working Date"
                  disabled={readOnly}
                  display={DATE}
                />
              )}
              <AttachmentField
                value={attachment}
                disabled={readOnly}
                onChange={(name) => {
                  form.setValue('attachmentName', name, { shouldDirty: true })
                }}
              />
              <TextareaField
                control={form.control}
                name="description"
                label="Description"
                disabled={readOnly}
                textareaClassName="min-h-40"
              />
              {!readOnly && <SectionTitle>Replacements</SectionTitle>}
              <SearchSelectField
                control={form.control}
                name="delegateeId"
                label="Delegatee"
                placeholder="Select Delegatee"
                options={active.filter((option) => option.value !== employeeId)}
                disabled={readOnly}
              />
            </div>
            <div
              role="tabpanel"
              id={`${tabsId}-checklist-panel`}
              aria-labelledby={`${tabsId}-checklist`}
              hidden={tab !== 'checklist'}
              className="grid gap-5"
            >
              {fields.length === 0 ? (
                <p className="font-inter text-sm text-muted-foreground">
                  No checklist is active. Add one in Settings → Off Boarding Settings.
                </p>
              ) : (
                fields.map((field) => (
                  <ChecklistInput
                    key={field.id}
                    control={form.control}
                    field={field}
                    disabled={readOnly}
                  />
                ))
              )}
            </div>
          </form>
        </div>
      </FieldLayoutContext>
    </AppDialog>
  )
}
