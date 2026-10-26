import { useEffect, useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { parse } from 'date-fns'
import { z } from 'zod'

import { CheckboxField, TextareaField } from '@/components/form'
import { DateField, PayrollDialog, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../../api/backend'
import type { PersonOption } from '../../../api/lookups.api'
import { useRequestPerson } from '../../../components/shared/request-employee'
import { RequestEmployeeField } from '../../../components/shared/request-employee-field'
import type { StandardFormProps } from '../../standard.types'
import { standardReadOnlyClass } from '../../standard-styles'
import { useCreateStandard, useStandardLookups, useUpdateStandard } from '../../use-standard'
import { useScheduleDays } from '../work-from-home/schedule-days'
import type { RestDayDetailsIn, RestDayLookups, RestDayPayload } from './rest-days.types'

const chosen = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => Boolean(value), { message })

const schema = z
  .object({
    employeeId: z.string().nullable(),
    departmentId: z.string().nullable(),
    rosterGroupId: chosen('Choose the roster'),
    from: z.string().min(1, 'Choose the first day'),
    to: z.string().min(1, 'Choose the last day'),
    isPayable: z.boolean(),
    reason: z.string().trim().max(4000, 'Keep it shorter'),
  })
  .refine((values) => !values.from || !values.to || values.to >= values.from, {
    message: 'Choose Date (from) or a later day',
    path: ['to'],
  })
type Values = z.infer<typeof schema>

/** API field → form field, for the server's field errors. */
const FIELDS: Record<string, keyof Values> = {
  employeeId: 'employeeId',
  departmentId: 'departmentId',
  rosterGroupId: 'rosterGroupId',
  fromDate: 'from',
  toDate: 'to',
  isPayable: 'isPayable',
  reason: 'reason',
}

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

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
 * Date (from), Date (to), Payable, Reason and the Selected Days count. Sends
 * `POST /requests/rest-day`; the API counts the person's shift days between
 * the dates (every day when they have no schedule).
 */
export function RestDaysForm({ mode, scope, request, onClose }: StandardFormProps<RestDayPayload>) {
  const formId = useId()
  const lookups = useStandardLookups<RestDayLookups>('rest-days')
  const create = useCreateStandard('rest-days')
  const update = useUpdateStandard('rest-days')
  const readOnly = mode === 'view'
  const pickPerson = scope === 'all' && mode === 'create'
  const permission = typePermission('rest-days', 'create')
  const departments = lookups.data?.departments ?? []

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request?.employee.id ?? null,
      departmentId: request?.payload.departmentId ?? null,
      rosterGroupId: request?.payload.rosterGroupId ?? null,
      from: request?.fromDate ?? '',
      to: request?.toDate ?? '',
      isPayable: request?.payload.isPayable ?? false,
      reason: request?.reason ?? '',
    },
  })
  const [employeeId, from, to] = useWatch({
    control: form.control,
    name: ['employeeId', 'from', 'to'],
  })
  const mine = !pickPerson && !request
  const personId = request?.employee.id ?? (pickPerson ? employeeId : lookups.data?.me?.id)
  const schedule = useScheduleDays('rest-days', personId, from, to, { mine })
  const strip = schedule.data?.days ?? []
  const shiftDays = strip.filter((item) => item.status === 'shift').length
  const selectedDays = readOnly && request ? (request.days ?? 0) : shiftDays || strip.length

  /** A person's department among the look-ups (by id, else by name). */
  const departmentOf = (person: PersonOption | undefined) =>
    departments.find((item) => item.id === person?.departmentId)?.id ??
    departments.find((item) => item.name === person?.department)?.id
  /** The department follows the person picked (their own). */
  const fillFromPerson = (person: PersonOption | undefined) => {
    const department = departmentOf(person)
    if (department) form.setValue('departmentId', department, { shouldValidate: true })
  }
  // On My Requests the person and department start from the signed-in person (their lookup
  // row once read, else their own schedule's department once the dates are chosen).
  const meId = lookups.data?.me?.id
  const me = useRequestPerson(permission, meId)
  const boardDepartment = schedule.data?.person?.departmentName
  useEffect(() => {
    if (pickPerson || mode !== 'create' || form.getValues('departmentId')) return
    if (meId) form.setValue('employeeId', meId)
    const department =
      departmentOf(me) ?? departments.find((item) => item.name === boardDepartment)?.id
    if (department) form.setValue('departmentId', department, { shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once the look-ups arrive
  }, [meId, me?.id, departments.length, boardDepartment])

  const submit = form.handleSubmit(async (values) => {
    if (pickPerson && !values.employeeId) {
      form.setError('employeeId', { message: 'Choose the employee' })
      return
    }
    // Without an employee id here (My Requests of a user the API links by session), the API
    // takes the department as sent: only ask when there is a person to take it from.
    const knowsPerson = pickPerson || Boolean(request) || Boolean(meId)
    if (departments.length > 0 && knowsPerson && !values.departmentId) {
      form.setError('departmentId', { message: 'Choose the department' })
      return
    }
    const body: RequestBody = {
      ...(pickPerson && values.employeeId ? { employeeId: values.employeeId } : {}),
      fromDate: values.from,
      toDate: values.to,
      reason: values.reason || null,
      details: {
        departmentId: values.departmentId,
        rosterGroupId: values.rosterGroupId ?? '',
        isPayable: values.isPayable,
      } satisfies RestDayDetailsIn,
    }
    try {
      if (mode === 'edit' && request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
      } else await create.mutateAsync(body)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const name = FIELDS[field]
          if (name) {
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
        <RequestEmployeeField
          control={form.control}
          name="employeeId"
          permission={permission}
          current={[request?.employee, lookups.data?.me]}
          label="Employee Name"
          required
          placeholder={pickPerson ? 'Select' : (schedule.data?.person?.name ?? 'You')}
          disabled={!pickPerson}
          onPick={(_id, person) => {
            fillFromPerson(person)
          }}
        />
        <SearchSelectField
          control={form.control}
          name="departmentId"
          label="Department"
          required
          placeholder="Select"
          disabled={readOnly}
          options={[
            ...(request && !departments.some((item) => item.id === request.payload.departmentId)
              ? [
                  {
                    value: request.payload.departmentId,
                    label: request.payload.departmentName ?? '—',
                  },
                ]
              : []),
            ...departments.map((item) => ({ value: item.id, label: item.name })),
          ]}
        />
        <SearchSelectField
          control={form.control}
          name="rosterGroupId"
          label="Roster"
          required
          placeholder="Select"
          disabled={readOnly}
          options={[
            ...(request &&
            !lookups.data?.extra.rosters.some((item) => item.id === request.payload.rosterGroupId)
              ? [
                  {
                    value: request.payload.rosterGroupId,
                    label: request.payload.rosterGroupName ?? '—',
                  },
                ]
              : []),
            ...(lookups.data?.extra.rosters ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
        />
        <DateField
          control={form.control}
          name="from"
          label="Date (from)"
          required
          disabled={readOnly}
          minDate={readOnly ? undefined : today()}
        />
        <DateField
          control={form.control}
          name="to"
          label="Date (to)"
          required
          disabled={readOnly}
          minDate={readOnly ? undefined : from ? day(from) : today()}
        />
        <CheckboxField
          control={form.control}
          name="isPayable"
          label="Payable"
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          rows={4}
          maxLength={4000}
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
