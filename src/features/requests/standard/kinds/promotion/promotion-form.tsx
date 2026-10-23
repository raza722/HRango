import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { FormField, TextareaField } from '@/components/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  AttachmentField,
  DateField,
  formatAmount,
  PayrollDialog,
  RsField,
  SearchSelectField,
  TwoWaySwitch,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { transferFieldsClass } from '../../../components/transfer/transfer-styles'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import type { PromotionInput, PromotionLookups, PromotionPayload } from './promotion.types'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z.object({
  employeeId: chosen('Choose the employee'),
  demotion: z.enum(['no', 'yes']),
  grade: chosen('Choose the grade'),
  level: chosen('Choose the level'),
  designation: chosen('Choose the designation'),
  jobTitle: chosen('Choose the job title'),
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
  attachment: z.string().nullable(),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

const FIELDS = [
  'employeeId',
  'grade',
  'level',
  'designation',
  'jobTitle',
  'salary',
  'benefits',
  'effectiveDate',
  'description',
] as const

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
 * 4195:118089, 4199:118694; the fields are the design notes', the layout
 * still to be checked against the frames): Employee, Type (Demotion No / Yes),
 * Grade, Level, Designation, Job Title, Previous Salary (RS) from Payroll,
 * Salary, Benefits (EOBI, Medical), Effective Date, Attachment, Description.
 */
export function PromotionForm({ mode, request, onClose }: StandardFormProps<PromotionPayload>) {
  const formId = useId()
  const lookups = useStandardLookups<PromotionLookups>('promotion')
  const create = useCreateStandard('promotion')
  const update = useUpdateStandard('promotion')
  const readOnly = mode === 'view'
  const payload = request?.payload
  const extra = lookups.data?.extra

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      demotion: payload?.demotion ? 'yes' : 'no',
      grade: payload?.grade ?? null,
      level: payload?.level ?? null,
      designation: payload?.designation ?? null,
      jobTitle: payload?.jobTitle ?? null,
      salary: payload ? String(payload.salary) : '',
      benefits: payload?.benefits ?? [],
      effectiveDate: payload?.effectiveDate ?? '',
      attachment: payload?.attachment ?? null,
      description: payload?.description ?? '',
    },
  })
  const { control } = form
  const [employeeId, attachment] = useWatch({ control, name: ['employeeId', 'attachment'] })
  // A saved request keeps the salary it was made against; a new one shows today's.
  const previousSalary =
    payload?.previousSalary ?? (employeeId ? extra?.current[employeeId]?.salary : undefined)

  const list = (values: readonly string[] | undefined) =>
    (values ?? []).map((value) => ({ value, label: value }))

  const submit = form.handleSubmit(async (values) => {
    const input: PromotionInput = {
      ...(mode === 'create' && values.employeeId ? { employeeId: values.employeeId } : {}),
      demotion: values.demotion === 'yes',
      grade: values.grade ?? '',
      level: values.level ?? '',
      designation: values.designation ?? '',
      jobTitle: values.jobTitle ?? '',
      salary: Number(values.salary.replace(/,/g, '')),
      benefits: values.benefits,
      effectiveDate: values.effectiveDate,
      attachment: values.attachment,
      description: values.description,
    }
    try {
      if (mode === 'edit' && request) await update.mutateAsync({ id: request.id, input })
      else await create.mutateAsync(input)
    } catch (failure) {
      if (failure instanceof ApiError) {
        const field = FIELDS.find((name) => failure.fieldErrors[name])
        if (field) form.setError(field, { message: failure.fieldErrors[field] })
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
        <SearchSelectField
          control={control}
          name="employeeId"
          label="Employee"
          required
          placeholder="Select Employee"
          disabled={mode !== 'create'}
          options={(lookups.data?.employees ?? [])
            .filter((person) => person.active || person.id === request?.employee.id)
            .map((person) => ({ value: person.id, label: person.name, hint: person.code }))}
          onValueChange={(next) => {
            // The new grade and job title start from what the person holds now.
            const now = next ? extra?.current[next] : undefined
            if (now && !form.getValues('grade')) form.setValue('grade', now.grade)
            if (now && !form.getValues('jobTitle')) form.setValue('jobTitle', now.jobTitle)
          }}
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
          name="grade"
          label="Grade"
          required
          placeholder="Select Grade"
          disabled={readOnly}
          options={list(extra?.grades)}
        />
        <SearchSelectField
          control={control}
          name="level"
          label="Level"
          required
          placeholder="Select Level"
          disabled={readOnly}
          options={list(extra?.levels)}
        />
        <SearchSelectField
          control={control}
          name="designation"
          label="Designation"
          required
          placeholder="Select Designation"
          disabled={readOnly}
          options={list(extra?.designations)}
        />
        <SearchSelectField
          control={control}
          name="jobTitle"
          label="Job Title"
          required
          placeholder="Select Job Title"
          disabled={readOnly}
          options={list(extra?.jobTitles)}
        />
        <FormField label="Previous Salary (RS)">
          {(a11y) => (
            <span
              id={a11y.id}
              role="status"
              aria-live="polite"
              className="flex h-10 items-center rounded-md bg-[#D9D9D9]/60 px-4 font-inter text-sm text-field-value dark:bg-muted"
            >
              {previousSalary === undefined ? '' : formatAmount(previousSalary)}
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
                  {(extra?.benefits ?? []).map((benefit) => {
                    const id = `${formId}-${benefit.value}`
                    return (
                      <span key={benefit.value} className="flex items-center gap-2.5">
                        <Checkbox
                          id={id}
                          tone="navy"
                          disabled={readOnly}
                          checked={field.value.includes(benefit.value)}
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked === true
                                ? [...field.value, benefit.value]
                                : field.value.filter((item) => item !== benefit.value),
                            )
                          }}
                          className="size-5 rounded-[0.125rem]"
                        />
                        <Label
                          htmlFor={id}
                          className="font-inter text-sm font-normal text-heading sm:text-base"
                        >
                          {benefit.label}
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
        <AttachmentField
          value={attachment}
          disabled={readOnly}
          onChange={(name) => {
            form.setValue('attachment', name)
          }}
        />
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
