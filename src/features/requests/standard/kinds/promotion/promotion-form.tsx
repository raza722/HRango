import { useEffect, useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { z } from 'zod'

import { FormField, TextareaField } from '@/components/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  DateField,
  formatAmount,
  formatRs,
  payrollApi,
  PayrollDialog,
  payrollKeys,
  RsField,
  SearchSelectField,
  TwoWaySwitch,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import { RequestFileField } from '../../../components/shared/request-files'
import { transferFieldsClass } from '../../../components/transfer/transfer-styles'
import type { NamedRef } from '../../../types/requests.types'
import { syncAttachments } from '../../../utils/request-files'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { useRequestAttachment } from '../loan-advances/use-request-attachment'
import type { PromotionDetailsIn, PromotionLookups, PromotionPayload } from './promotion.types'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    employeeId: chosen('Choose the employee'),
    demotion: z.enum(['no', 'yes']),
    gradeId: chosen('Choose the grade'),
    jobLevelId: z.string().nullable(),
    designationId: chosen('Choose the designation'),
    jobTitleId: chosen('Choose the job title'),
    salary: z
      .string()
      .trim()
      .refine(
        (value) => {
          const plain = value.replace(/,/g, '')
          return /^\d+(\.\d{1,2})?$/.test(plain) && Number(plain) > 0 && Number(plain) <= 10_000_000
        },
        { message: 'Give the salary' },
      ),
    benefits: z.array(z.string()),
    effectiveDate: z.string().min(1, 'Choose the effective date'),
    description: z.string().trim().max(500, 'Keep it under 500 characters'),
    /** The person's salary now (read from payroll, not typed), once it is known. */
    previousSalary: z.number().nullable(),
  })
  .superRefine((values, ctx) => {
    const salary = Number(values.salary.replace(/,/g, ''))
    if (values.previousSalary === null || !Number.isFinite(salary) || salary <= 0) return
    // As the API refuses: a promotion never lowers the salary, a demotion never raises it.
    if (values.demotion === 'no' && salary < values.previousSalary) {
      ctx.addIssue({
        code: 'custom',
        path: ['salary'],
        message: `A promotion cannot lower the salary (now ${formatRs(values.previousSalary)})`,
      })
    }
    if (values.demotion === 'yes' && salary > values.previousSalary) {
      ctx.addIssue({
        code: 'custom',
        path: ['salary'],
        message: `A demotion cannot raise the salary (now ${formatRs(values.previousSalary)})`,
      })
    }
  })
type Values = z.infer<typeof schema>

/** The API's field names → the form's. */
const FIELD_OF: Record<string, keyof Values> = {
  employeeId: 'employeeId',
  gradeId: 'gradeId',
  jobLevelId: 'jobLevelId',
  designationId: 'designationId',
  jobTitleId: 'jobTitleId',
  newSalary: 'salary',
  benefitPayItemIds: 'benefits',
  effectiveDate: 'effectiveDate',
  fromDate: 'effectiveDate',
  description: 'description',
}

const TITLES = {
  create: 'Promotion Request Create',
  edit: 'Promotion Request Edit',
  view: 'Promotion Request View',
} as const

const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const NO_YES = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
] as const

/**
 * Promotion Create / Edit / View (frames 4195:109652 … 4195:116283,
 * 4195:118089, 4199:118694): Employee, Type (Demotion No / Yes), Grade, Level
 * (optional: the API's `jobLevelId`), Designation, Job Title, Previous Salary
 * (RS) (payroll's: read once the person is picked, kept by the API when saved), Salary, Benefits (the
 * benefit pay items), Effective Date, Attachment, Description. Promotion is
 * admin only: always for another employee.
 */
export function PromotionForm({ mode, request, onClose }: StandardFormProps<PromotionPayload>) {
  const formId = useId()
  const lookups = useStandardLookups<PromotionLookups>('promotion')
  const create = useCreateStandard('promotion')
  const update = useUpdateStandard('promotion')
  const readOnly = mode === 'view'
  const payload = request?.payload
  const extra = lookups.data?.extra
  const { attachment, setAttachment, before } = useRequestAttachment('promotion', request)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      demotion: payload?.isDemotion ? 'yes' : 'no',
      gradeId: payload?.gradeId ?? null,
      jobLevelId: payload?.jobLevelId ?? null,
      designationId: payload?.designationId ?? null,
      jobTitleId: payload?.jobTitleId ?? null,
      salary: payload ? String(payload.newSalary) : '',
      benefits: payload?.benefits.map((item) => item.payItemId) ?? [],
      effectiveDate: payload?.effectiveDate ?? '',
      description: request?.description ?? '',
      previousSalary: payload?.previousSalary ?? null,
    },
  })
  const { control } = form
  // A saved request shows the salary the API read when it was saved; on Create, the person's
  // salary today from payroll once they are picked (left blank when payroll cannot be read).
  const employeeId = useWatch({ control, name: 'employeeId' })
  const day = format(new Date(), 'yyyy-MM-dd')
  const current = useQuery({
    queryKey: [...payrollKeys.detail('current-salary', employeeId ?? ''), day],
    queryFn: ({ signal }) => payrollApi.currentSalary(employeeId ?? '', day, signal),
    enabled: mode === 'create' && Boolean(employeeId),
    retry: false,
  })
  const previousSalary =
    mode === 'create'
      ? employeeId
        ? (current.data?.salary ?? null)
        : null
      : (payload?.previousSalary ?? null)
  // The schema checks the new salary against it (a promotion cannot lower it).
  useEffect(() => {
    form.setValue('previousSalary', previousSalary)
  }, [form, previousSalary])

  // A saved request's choices stay listed even when a picker cannot be read.
  const list = (items: readonly NamedRef[] | undefined, saved?: NamedRef | null) => {
    const options = (items ?? []).map((item) => ({ value: item.id, label: item.name }))
    if (saved && !options.some((option) => option.value === saved.id)) {
      options.push({ value: saved.id, label: saved.name })
    }
    return options
  }
  const saved = (id: string | null | undefined, name: string | null | undefined) =>
    id ? { id, name: name ?? id } : null
  const benefitOptions: NamedRef[] = [
    ...(extra?.benefits ?? []),
    ...(payload?.benefits ?? [])
      .filter((item) => !(extra?.benefits ?? []).some((benefit) => benefit.id === item.payItemId))
      .map((item) => ({ id: item.payItemId, name: item.payItemName ?? item.payItemId })),
  ]

  const submit = form.handleSubmit(async (values) => {
    const details = {
      isDemotion: values.demotion === 'yes',
      gradeId: values.gradeId ?? '',
      jobLevelId: values.jobLevelId,
      designationId: values.designationId ?? '',
      jobTitleId: values.jobTitleId ?? '',
      newSalary: Number(values.salary.replace(/,/g, '')),
      effectiveDate: values.effectiveDate,
      benefitPayItemIds: values.benefits,
    } satisfies PromotionDetailsIn
    const body: RequestBody = {
      ...(mode === 'create' && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: values.effectiveDate,
      toDate: values.effectiveDate,
      description: values.description || null,
      details,
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        await syncAttachments('promotion', request.id, before, [attachment])
      } else {
        await create.mutateAsync({ ...body, attachments: attachment ? [attachment.id] : [] })
      }
    } catch (failure) {
      if (failure instanceof ApiError) {
        const field = Object.keys(failure.fieldErrors).find((name) => FIELD_OF[name])
        const target = field ? FIELD_OF[field] : undefined
        if (field && target) form.setError(target, { message: failure.fieldErrors[field] })
        else form.setError('root', { message: failure.message })
      } else {
        form.setError('root', { message: 'Could not save the promotion request.' })
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
      error={form.formState.errors.root?.message}
      className="max-w-3xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', transferFieldsClass, readOnly && standardReadOnlyClass)}
      >
        <RequestEmployeeField
          control={control}
          name="employeeId"
          permission={typePermission('promotion', 'create')}
          current={request?.employee}
          // Promotion is admin only: never for oneself.
          exclude={[lookups.data?.me?.id]}
          required
          placeholder="Select Employee"
          disabled={mode !== 'create'}
        />
        <Controller
          control={control}
          name="demotion"
          render={({ field }) => (
            <FormField label="Type">
              {(a11y) => (
                <span className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="font-inter text-sm text-heading sm:text-base">Demotion</span>
                  <TwoWaySwitch
                    id={a11y.id}
                    label="Demotion"
                    options={NO_YES}
                    value={field.value}
                    disabled={readOnly}
                    onChange={field.onChange}
                  />
                </span>
              )}
            </FormField>
          )}
        />
        <SearchSelectField
          control={control}
          name="gradeId"
          label="Grade"
          required
          placeholder="Select Grade"
          disabled={readOnly}
          options={list(extra?.grades, saved(payload?.gradeId, payload?.gradeName))}
        />
        <SearchSelectField
          control={control}
          name="jobLevelId"
          label="Level"
          placeholder="Select Level"
          disabled={readOnly}
          options={list(extra?.levels, saved(payload?.jobLevelId, payload?.jobLevelName))}
        />
        <SearchSelectField
          control={control}
          name="designationId"
          label="Designation"
          required
          placeholder="Select Designation"
          disabled={readOnly}
          options={list(
            extra?.designations,
            saved(payload?.designationId, payload?.designationName),
          )}
        />
        <SearchSelectField
          control={control}
          name="jobTitleId"
          label="Job Title"
          required
          placeholder="Select Job Title"
          disabled={readOnly}
          options={list(extra?.jobTitles, saved(payload?.jobTitleId, payload?.jobTitleName))}
        />
        <FormField label="Previous Salary (RS)">
          {(a11y) => (
            <span
              id={a11y.id}
              role="status"
              aria-live="polite"
              className="flex h-10 items-center rounded-md bg-[#D9D9D9]/60 px-4 font-inter text-sm text-field-value dark:bg-muted"
            >
              {previousSalary !== null
                ? formatAmount(previousSalary)
                : mode === 'create' && employeeId && current.isFetching
                  ? 'Reading the salary…'
                  : '—'}
            </span>
          )}
        </FormField>
        <RsField control={control} name="salary" label="Salary" required disabled={readOnly} />
        <Controller
          control={control}
          name="benefits"
          render={({ field }) => (
            <FormField label="Benefits">
              {(a11y) => (
                <span id={a11y.id} className="flex min-h-10 flex-wrap items-center gap-x-8 gap-y-2">
                  {benefitOptions.length === 0 && (
                    <span className="font-inter text-sm text-grey">No benefit pay items</span>
                  )}
                  {benefitOptions.map((benefit) => {
                    const id = `${formId}-${benefit.id}`
                    return (
                      <span key={benefit.id} className="flex items-center gap-2.5">
                        <Checkbox
                          id={id}
                          tone="navy"
                          disabled={readOnly}
                          checked={field.value.includes(benefit.id)}
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked === true
                                ? [...field.value, benefit.id]
                                : field.value.filter((item) => item !== benefit.id),
                            )
                          }}
                          className="size-5 rounded-[0.125rem]"
                        />
                        <Label
                          htmlFor={id}
                          className="font-inter text-sm font-normal text-heading sm:text-base"
                        >
                          {benefit.name}
                        </Label>
                      </span>
                    )
                  })}
                </span>
              )}
            </FormField>
          )}
        />
        <DateField
          control={control}
          name="effectiveDate"
          label="Effective Date"
          required
          display="MMMM d, yyyy"
          disabled={readOnly}
          minDate={readOnly ? undefined : today()}
        />
        <RequestFileField value={attachment} onChange={setAttachment} disabled={readOnly} />
        <TextareaField
          control={control}
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
