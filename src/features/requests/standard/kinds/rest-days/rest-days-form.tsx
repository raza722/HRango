import { useEffect, useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format, parse } from 'date-fns'
import { z } from 'zod'

import { TextareaField } from '@/components/form'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import type { RestDayInput, RestDayLookups, RestDayPayload } from './rest-days.types'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    employeeId: z.string().nullable(),
    department: chosen('Choose the department'),
    rosterGroupId: chosen('Choose the roster'),
    from: z.string().min(1, 'Choose the first day'),
    to: z.string().min(1, 'Choose the last day'),
    reason: z.string().trim().max(500, 'Keep it under 500 characters'),
  })
  .refine((values) => !values.from || !values.to || values.to >= values.from, {
    message: 'Choose Date (from) or a later day',
    path: ['to'],
  })
type Values = z.infer<typeof schema>

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** The roster's working days between the dates ("Selected Days"). */
function countDays(from: string, to: string, workingDays: readonly string[]): number {
  if (!from || !to || to < from) return 0
  let count = 0
  for (let date = day(from); format(date, 'yyyy-MM-dd') <= to; date = addDays(date, 1)) {
    if (workingDays.includes(WEEKDAYS[date.getDay()] ?? '')) count += 1
    if (count > 400) break
  }
  return count
}

const today = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const TITLES = {
  create: 'Create Rest Day Request',
  edit: 'Rest Day Request Edit',
  view: 'Rest Days Request View',
} as const

/**
 * "Create Rest Day Request": Employee Name (All only), Department, Roster,
 * Date (from), Date (to), Reason and the Selected Days count, as drawn.
 */
export function RestDaysForm({ mode, scope, request, onClose }: StandardFormProps<RestDayPayload>) {
  const formId = useId()
  const lookups = useStandardLookups<RestDayLookups>('rest-days')
  const create = useCreateStandard('rest-days')
  const update = useUpdateStandard('rest-days')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const people = lookups.data?.employees ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      department: request?.payload.department ?? null,
      rosterGroupId: request?.payload.rosterGroupId ?? null,
      from: request?.payload.from ?? '',
      to: request?.payload.to ?? '',
      reason: request?.payload.reason ?? '',
    },
  })
  const [from, to, rosterGroupId] = useWatch({
    control: form.control,
    name: ['from', 'to', 'rosterGroupId'],
  })
  const roster = lookups.data?.extra.rosters.find((item) => item.id === rosterGroupId)
  const selectedDays = countDays(from, to, roster?.workingDays ?? [])

  const fillFromPerson = (employeeId: string | null) => {
    const person = people.find((item) => item.id === employeeId)
    if (person) form.setValue('department', person.department, { shouldValidate: true })
    const rosterId = employeeId ? lookups.data?.extra.rosterOf[employeeId] : null
    if (rosterId) form.setValue('rosterGroupId', rosterId, { shouldValidate: true })
  }
  // On My Requests the person, department and roster start from the signed-in person.
  const meId = lookups.data?.me.id
  useEffect(() => {
    if (pickPerson || mode !== 'create' || !meId || form.getValues('department')) return
    form.setValue('employeeId', meId)
    fillFromPerson(meId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once the look-ups arrive
  }, [meId])

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    const input: RestDayInput = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      department: values.department ?? '',
      rosterGroupId: values.rosterGroupId ?? '',
      from: values.from,
      to: values.to,
      reason: values.reason,
    }
    try {
      if (mode === 'edit' && request) await update.mutateAsync({ id: request.id, input })
      else await create.mutateAsync(input)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          if (field in values) {
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
        className={cn('grid gap-5', readOnly && standardReadOnlyClass)}
      >
        {/* Drawn on My Requests too: there it is the signed-in person, locked. */}
        {
          <SearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee Name"
            required
            placeholder="Select"
            disabled={!pickPerson}
            options={people
              .filter((person) => person.active)
              .map((person) => ({ value: person.id, label: person.name, hint: person.code }))}
            onValueChange={fillFromPerson}
          />
        }
        <SearchSelectField
          control={form.control}
          name="department"
          label="Department"
          required
          placeholder="Select"
          // The department is the person's own: it follows the employee picked.
          disabled
          options={(lookups.data?.departments ?? []).map((name) => ({ value: name, label: name }))}
        />
        <SearchSelectField
          control={form.control}
          name="rosterGroupId"
          label="Roster"
          required
          placeholder="Select"
          disabled={readOnly}
          options={(lookups.data?.extra.rosters ?? []).map((item) => ({
            value: item.id,
            label: item.title,
            hint: item.shift,
          }))}
        />
        <DateField
          control={form.control}
          name="from"
          label="Date (from)"
          required
          disabled={readOnly}
          minDate={today()}
        />
        <DateField
          control={form.control}
          name="to"
          label="Date (to)"
          required
          disabled={readOnly}
          minDate={from ? day(from) : today()}
        />
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          rows={4}
          maxLength={500}
          disabled={readOnly}
        />
        <div className="grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center">
          <span className="font-inter text-base text-heading">Selected Days</span>
          <span
            aria-live="polite"
            className="font-inter text-sm font-semibold text-[#333C48] dark:text-heading"
          >
            {selectedDays}
          </span>
        </div>
      </form>
    </PayrollDialog>
  )
}
