import { type SyntheticEvent, useId, useState } from 'react'
import { type Control, useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { addDays, format, intervalToDuration, parseISO } from 'date-fns'
import { z } from 'zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { FieldLayoutContext, FormField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { type EmployeeLookupItem, personHint, UploadField } from '@/features/assets'
import {
  btn,
  DateField,
  DateInput,
  dialogFieldType,
  EmployeeSearchSelectField,
  footerButton,
  type SearchOption,
  SearchSelectField,
  SectionTitle,
} from '@/features/payroll'
import { type Employee, employeeKeys, employeesApi } from '@/features/talent-management'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { EOE_REASON_LABELS } from '../../constants'
import {
  AnswersNotSavedError,
  useChecklistFields,
  useEndOfEmployment,
  useSaveEndOfEmployment,
} from '../../hooks/use-offboarding'
import {
  type ActiveChecklistField,
  type ChecklistAnswerValue,
  type EmployeeCardInfo,
  type EndOfEmployment,
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
    serveNotice: z.boolean(),
    noticePeriodDays: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d{1,4}$/.test(value), 'Enter a whole number of days'),
    lastWorkingDate: z.string(),
    needsFinalSettlement: z.boolean(),
    needsAssetClearance: z.boolean(),
    assetClearByDate: z.string(),
    description: z.string().trim().max(2000, 'Keep it under 2000 characters'),
    replacementId: z.string().nullable(),
    delegateeId: z.string().nullable(),
    checklist: z.record(z.string(), z.union([z.string(), z.boolean()])),
  })
  .refine((value) => !value.serveNotice || value.lastWorkingDate !== '', {
    message: 'Choose the last working date',
    path: ['lastWorkingDate'],
  })
  .refine((value) => !value.delegateeId || value.delegateeId !== value.employeeId, {
    message: 'Choose someone else as the delegatee',
    path: ['delegateeId'],
  })
  .refine((value) => !value.replacementId || value.replacementId !== value.employeeId, {
    message: 'Choose someone else as the replacement',
    path: ['replacementId'],
  })
type Values = z.infer<typeof schema>

/** A stored answer (text) as the form holds it. */
const formValue = (answer: string | null | undefined, field: ActiveChecklistField) =>
  field.fieldType === 'boolean' ? answer === 'true' : (answer ?? '')

const toValues = (
  detail: EndOfEmployment | undefined,
  fields: readonly ActiveChecklistField[],
): Values => ({
  employeeId: detail?.employeeId ?? null,
  reason: detail?.reason ?? null,
  serveNotice: detail?.serveNotice ?? false,
  noticePeriodDays:
    detail?.noticePeriodDays === null || !detail ? '' : String(detail.noticePeriodDays),
  lastWorkingDate: detail?.serveNotice ? detail.lastWorkingDate : '',
  needsFinalSettlement: detail?.needsFinalSettlement ?? false,
  needsAssetClearance: detail?.needsAssetClearance ?? false,
  assetClearByDate: detail?.assetClearByDate ?? '',
  description: detail?.description ?? '',
  replacementId: detail?.replacementId ?? null,
  delegateeId: detail?.delegateeId ?? null,
  checklist: Object.fromEntries(
    fields.map((field) => [
      field.id,
      formValue(
        detail?.answers.find((answer) => answer.checklistFieldId === field.id)?.answer,
        field,
      ),
    ]),
  ),
})

/** The answers as the API takes them: numbers as numbers, blanks as null. */
function toAnswers(values: Values['checklist'], fields: readonly ActiveChecklistField[]) {
  return fields.map((field) => {
    const value = values[field.id]
    let answer: ChecklistAnswerValue = null
    if (field.fieldType === 'boolean') answer = value === true
    else {
      const text = typeof value === 'string' ? value.trim() : ''
      if (text !== '') answer = field.fieldType === 'number' ? Number(text) : text
    }
    return { checklistFieldId: field.id, answer }
  })
}

/**
 * The Checklist tab's rules, checked before saving (the server checks them too). Required
 * answers do not block saving: the record waits for them before it completes.
 */
function checklistErrors(values: Values['checklist'], fields: readonly ActiveChecklistField[]) {
  const errors: [string, string][] = []
  for (const field of fields) {
    const value = values[field.id]
    const text = typeof value === 'string' ? value.trim() : ''
    if (field.fieldType === 'boolean' || text === '') continue
    if (field.fieldType === 'number') {
      const number = Number(text)
      if (!Number.isFinite(number)) errors.push([field.id, 'Enter a number'])
      else if (field.minValue !== null && number < field.minValue)
        errors.push([field.id, `At least ${String(field.minValue)}`])
      else if (field.maxValue !== null && number > field.maxValue)
        errors.push([field.id, `At most ${String(field.maxValue)}`])
    }
    if (field.fieldType === 'string') {
      if (field.minLength !== null && text.length < field.minLength)
        errors.push([field.id, `At least ${String(field.minLength)} characters`])
      else if (field.maxLength !== null && text.length > field.maxLength)
        errors.push([field.id, `At most ${String(field.maxLength)} characters`])
    }
  }
  return errors
}

/** "1 year", "2 years": the count with its word, singular for one. */
const plural = (count: number | undefined, word: string) =>
  `${String(count ?? 0)} ${word}${count === 1 ? '' : 's'}`

/** A span as "2 years, 8 months, 21 days" (the same words and casing everywhere). */
function spanText(start: string | null | undefined, end: Date | string): string {
  if (!start) return '—'
  const span = intervalToDuration({
    start: parseISO(start),
    end: typeof end === 'string' ? parseISO(end) : end,
  })
  return `${plural(span.years, 'year')}, ${plural(span.months, 'month')}, ${plural(span.days, 'day')}`
}

/**
 * The card: the record's employee details, or (before saving) the picked person's, from their
 * employee record once it loads (the picker knows only the name, code and designation).
 */
function cardOf(
  detail: EndOfEmployment | undefined,
  picked: EmployeeLookupItem | undefined,
  record: Employee | undefined,
  lastWorkingDate: string,
): EmployeeCardInfo | undefined {
  if (detail) {
    return {
      name: detail.employeeName ?? '',
      designation: detail.designationName ?? '',
      code: detail.employeeCode ?? '',
      photoUrl: detail.photoUrl,
      age: spanText(detail.dateOfBirth, new Date()),
      email: detail.employeeEmail ?? '—',
      phone: detail.employeePhone ?? '—',
      experience: spanText(detail.joiningDate, detail.lastWorkingDate),
    }
  }
  if (!picked) return undefined
  return {
    name: picked.name,
    designation: picked.designationName ?? picked.jobTitleName ?? '',
    code: picked.code,
    photoUrl: picked.photoUrl,
    age: spanText(record?.dateOfBirth, new Date()),
    email: record?.email ?? '—',
    phone: record?.phone1 ?? '—',
    // Until the last working date is chosen, the time worked so far.
    experience: spanText(record?.joiningDate, lastWorkingDate || new Date()),
  }
}

/** View draws every box grey, not faded white. */
const viewFieldsClass = cn(
  '[&_[role=combobox]:disabled]:border-transparent [&_[role=combobox]:disabled]:bg-[#D9D9D9]/60 [&_[role=combobox]:disabled]:opacity-100',
  '[&_[aria-haspopup=dialog]:disabled]:border-transparent [&_[aria-haspopup=dialog]:disabled]:bg-[#D9D9D9]/60 [&_[aria-haspopup=dialog]:disabled]:opacity-100',
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100',
  '[&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100',
  'dark:[&_[aria-haspopup=dialog]:disabled]:bg-muted dark:[&_[role=combobox]:disabled]:bg-muted dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted',
)

type CheckName = 'serveNotice' | 'needsFinalSettlement' | 'needsAssetClearance'

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
            name="serveNotice"
            disabled={disabled}
          />
          <span className="flex items-center gap-4">
            <Label htmlFor={`${baseId}-settlement`} className={label}>
              Final Settlement
            </Label>
            <FormCheck
              id={`${baseId}-settlement`}
              control={control}
              name="needsFinalSettlement"
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
              name="needsAssetClearance"
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
  field: ActiveChecklistField
  disabled: boolean
}) {
  const name = `checklist.${field.id}` as const
  const controller = useController({ control, name })
  if (field.fieldType === 'date') {
    return (
      <FormField
        label={field.name}
        required={field.isRequired}
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
  if (field.fieldType === 'boolean') {
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
  const number = field.fieldType === 'number'
  const min = number ? field.minValue : field.minLength
  const max = number ? field.maxValue : field.maxLength
  const hint = number
    ? [min !== null ? `from ${String(min)}` : null, max !== null ? `up to ${String(max)}` : null]
    : [
        min !== null ? `at least ${String(min)} characters` : null,
        max !== null ? `up to ${String(max)} characters` : null,
      ]
  const description = hint.filter(Boolean).join(', ')
  return (
    <FormField
      label={field.name}
      required={field.isRequired}
      error={controller.fieldState.error?.message}
      description={
        description ? description.charAt(0).toUpperCase() + description.slice(1) : undefined
      }
    >
      {(a11y) => (
        <Input
          {...a11y}
          type={number ? 'number' : 'text'}
          inputMode={number ? 'decimal' : undefined}
          min={number ? (min ?? undefined) : undefined}
          max={number ? (max ?? undefined) : undefined}
          maxLength={number ? undefined : (max ?? undefined)}
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

/** Server field names the Information tab shows under their field. */
const INFORMATION_FIELDS = [
  'employeeId',
  'reason',
  'lastWorkingDate',
  'noticePeriodDays',
  'assetClearByDate',
  'replacementId',
  'delegateeId',
] as const

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
  onSaved?: (record: EndOfEmployment) => void
}) {
  const record = useEndOfEmployment(id)
  const fields = useChecklistFields()
  if ((id && !record.data) || !fields.data) {
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
      fields={fields.data}
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
  detail: EndOfEmployment | undefined
  mode: 'create' | 'edit' | 'view'
  fields: readonly ActiveChecklistField[]
  onClose: () => void
  onSaved: ((record: EndOfEmployment) => void) | undefined
}) {
  const formId = useId()
  const tabsId = useId()
  const [tab, setTab] = useState<Tab>('information')
  // The record as last saved: a create whose answers failed carries on as an edit.
  const [saved, setSaved] = useState<EndOfEmployment | undefined>(detail)
  const [attachment, setAttachment] = useState<FileRef | null>(detail?.file ?? null)
  const save = useSaveEndOfEmployment()
  const readOnly = mode === 'view'
  // People are searched on the server; the one last picked fills the card before saving.
  const [picked, setPicked] = useState<EmployeeLookupItem | undefined>()
  const people = { permission: 'offboarding.end_of_employment.create' }
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(detail, fields),
  })
  const [employeeId, serveNotice, needsAssetClearance, lastWorkingDate] = useWatch({
    control: form.control,
    name: ['employeeId', 'serveNotice', 'needsAssetClearance', 'lastWorkingDate'],
  })
  // The picked person's record, for the card's age, email, phone and experience before saving.
  const pickedId = !detail && picked?.id === employeeId ? employeeId : null
  const pickedRecord = useQuery({
    queryKey: employeeKeys.detail(pickedId ?? ''),
    queryFn: ({ signal }) => employeesApi.get(pickedId ?? '', signal),
    enabled: pickedId !== null,
  })
  /** Notice Period Days fills the Last Working Date: that many days from today. */
  const fillLastDay = (text: string) => {
    if (!/^\d{1,4}$/.test(text.trim())) return
    form.setValue(
      'lastWorkingDate',
      format(addDays(new Date(), Number(text.trim())), 'yyyy-MM-dd'),
      { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
    )
  }
  // Whoever the record already names keeps their name (they may have left since).
  const known: SearchOption[] = []
  const keep = (value: string | null | undefined, label: string | null | undefined) => {
    if (value && label && !known.some((option) => option.value === value)) {
      known.push({ value, label })
    }
  }
  keep(detail?.employeeId, detail?.employeeName)
  keep(detail?.delegateeId, detail?.delegateeName)
  keep(detail?.replacementId, detail?.replacementName)
  const notLeaving = (row: { id: string }) => row.id !== employeeId
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
      serveNotice: values.serveNotice,
      noticePeriodDays:
        values.serveNotice && values.noticePeriodDays !== ''
          ? Number(values.noticePeriodDays)
          : null,
      lastWorkingDate: values.serveNotice ? values.lastWorkingDate : null,
      needsFinalSettlement: values.needsFinalSettlement,
      needsAssetClearance: values.needsAssetClearance,
      assetClearByDate: values.needsAssetClearance ? values.assetClearByDate || null : null,
      replacementId: values.replacementId,
      delegateeId: values.delegateeId,
      description: values.description.trim() || null,
      fileId: attachment?.id ?? null,
      rowVersion: saved?.rowVersion,
    }
    const answered = Boolean(form.formState.dirtyFields.checklist)
    try {
      const record = await save.mutateAsync({
        id: saved?.id,
        input,
        answers: answered ? toAnswers(values.checklist, fields) : null,
      })
      onClose()
      onSaved?.(record)
    } catch (error) {
      if (error instanceof AnswersNotSavedError) {
        setSaved(error.record)
        const failure = error.failure
        const [key, message] =
          failure instanceof ApiError ? (Object.entries(failure.fieldErrors)[0] ?? []) : []
        if (key?.startsWith('answers.') && message) {
          form.setError(`checklist.${key.slice('answers.'.length)}`, { message })
          setTab('checklist')
        }
        form.setError('root', {
          message: `The record was saved, but not its checklist answers${
            failure instanceof ApiError ? `: ${failure.message}` : '.'
          }`,
        })
        return
      }
      if (!(error instanceof ApiError)) {
        form.setError('root', { message: 'Could not save the end of employment record.' })
        return
      }
      const field = INFORMATION_FIELDS.find((name) => error.fieldErrors[name])
      if (field) {
        form.setError(field, { message: error.fieldErrors[field] })
        setTab('information')
      } else {
        form.setError('root', { message: error.message })
      }
    }
  })

  const shownCard = cardOf(
    detail,
    picked?.id === employeeId ? picked : undefined,
    pickedId ? pickedRecord.data : undefined,
    serveNotice ? lastWorkingDate : '',
  )
  const rootError = form.formState.errors.root?.message
  const waiting = detail?.status === 'pending' ? detail.waitingFor : []

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
          <EmployeeInfoCard card={shownCard} />

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
            {waiting.length > 0 && (
              <p className="font-inter text-sm text-muted-foreground">
                Waiting for: {waiting.map((item) => item.label).join(', ')}
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
              <EmployeeSearchSelectField
                control={form.control}
                name="employeeId"
                label="Employee"
                placeholder="Select Employee"
                filters={people}
                enabled={!readOnly}
                known={known}
                hint={personHint}
                onValueChange={(_, row) => {
                  setPicked(row)
                }}
                required={mode === 'create'}
                disabled={readOnly || mode === 'edit' || saved !== undefined}
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
              {serveNotice && (
                <>
                  <TextField
                    control={form.control}
                    name="noticePeriodDays"
                    label="Notice Period Days"
                    inputMode="numeric"
                    disabled={readOnly}
                    onInput={(event) => {
                      fillLastDay(event.currentTarget.value)
                    }}
                  />
                  <DateField
                    control={form.control}
                    name="lastWorkingDate"
                    label="Last Working Date"
                    required={!readOnly}
                    disabled={readOnly}
                    display={DATE}
                  />
                </>
              )}
              {needsAssetClearance && (
                <DateField
                  control={form.control}
                  name="assetClearByDate"
                  label="Asset Clear"
                  disabled={readOnly}
                  display={DATE}
                />
              )}
              <UploadField
                value={attachment}
                onChange={setAttachment}
                module="offboarding"
                disabled={readOnly}
              />
              <TextareaField
                control={form.control}
                name="description"
                label="Description"
                disabled={readOnly}
                textareaClassName="min-h-40"
              />
              {!readOnly && <SectionTitle>Replacements</SectionTitle>}
              <EmployeeSearchSelectField
                control={form.control}
                name="replacementId"
                label="Replacement"
                placeholder="Select Replacement"
                filters={people}
                enabled={!readOnly}
                known={known}
                include={notLeaving}
                hint={personHint}
                disabled={readOnly}
              />
              <EmployeeSearchSelectField
                control={form.control}
                name="delegateeId"
                label="Delegatee"
                placeholder="Select Delegatee"
                filters={people}
                enabled={!readOnly}
                known={known}
                include={notLeaving}
                hint={personHint}
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
