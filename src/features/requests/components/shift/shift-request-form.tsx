import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import { DatePickerField, FieldLayoutContext, SelectField, TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useCreateRequest,
  useDayShift,
  useRequestLookups,
  useUpdateRequest,
} from '../../hooks/use-requests'
import { shiftRequestSchema, type ShiftRequestValues } from '../../schemas/request-forms.schema'
import type { ShiftRequest } from '../../types/requests.types'
import { clock } from '../../utils/request-format'
import { shiftFieldsClass } from '../shared/request-styles'

const FIELDS = ['employeeId', 'date', 'rosterGroupId', 'swapWithId', 'description'] as const
const NONE = ''

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/**
 * Shift Request as drawn: Employee Name, Date and Time Roster (labels on the
 * left), then Swap From (the shift that day) and Swap To (a colleague), and
 * Description. Ask for another time roster, or to swap with a colleague.
 */
export function ShiftRequestForm({
  request,
  onDone,
  onCancel,
}: {
  /** Edit this pending request; a new one when absent. */
  request?: ShiftRequest | undefined
  onDone?: () => void
  onCancel?: () => void
}) {
  const formId = useId()
  const create = useCreateRequest('shift')
  const update = useUpdateRequest('shift')
  const lookups = useRequestLookups()
  const empty: ShiftRequestValues = {
    // Empty means the signed-in person.
    employeeId: '',
    date: '',
    rosterGroupId: NONE,
    swapWithId: NONE,
    description: '',
  }
  const form = useForm<ShiftRequestValues>({
    resolver: zodResolver(shiftRequestSchema),
    defaultValues: request
      ? {
          employeeId: request.employee.id,
          date: request.payload.date,
          rosterGroupId: request.payload.rosterGroupId ?? NONE,
          swapWithId: request.payload.swapWith?.id ?? NONE,
          description: request.payload.description,
        }
      : empty,
  })
  const { control } = form
  const [employeeId, date, swapWithId] = useWatch({
    control,
    name: ['employeeId', 'date', 'swapWithId'],
  })
  const shift = useDayShift(employeeId || undefined, date)
  const colleagues = shift.data?.colleagues ?? []
  const swapping = swapWithId !== NONE

  const current = shift.data
    ? shift.data.clockIn
      ? `${shift.data.slotName ?? ''} (${clock(shift.data.clockIn)} – ${clock(shift.data.clockOut)})`
      : (shift.data.slotName ?? 'Not scheduled')
    : 'Choose a date'

  const submit = form.handleSubmit(async (values) => {
    const input = {
      ...(values.employeeId ? { employeeId: values.employeeId } : {}),
      date: values.date,
      rosterGroupId: values.swapWithId ? null : values.rosterGroupId || null,
      swapWithId: values.swapWithId || null,
      description: values.description.trim(),
    }
    try {
      if (request) await update.mutateAsync({ id: request.id, input })
      else await create.mutateAsync(input)
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = Object.entries(error.fieldErrors)
        for (const [field, message] of fields) {
          const name = FIELDS.find((key) => key === field)
          if (name) form.setError(name, { message })
        }
        if (fields.length === 0) form.setError('root', { message: error.message })
      }
      return
    }
    form.reset(empty)
    onDone?.()
  })

  const pending = create.isPending || update.isPending
  const rootError = form.formState.errors.root?.message

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => void submit(event)}
      aria-label={request ? `Edit ${request.code}` : 'Shift Request'}
      className={cn('@container grid gap-6', shiftFieldsClass)}
    >
      <FieldLayoutContext value="horizontal">
        <div className="grid gap-5">
          <SelectField
            control={control}
            name="employeeId"
            label="Employee Name"
            placeholder="Myself"
            options={(lookups.data?.employees ?? []).map((employee) => ({
              value: employee.id,
              label: `${employee.code} | ${employee.name}`,
            }))}
            disabled={request !== undefined}
            clearable="Myself"
            onValueChange={() => {
              form.setValue('swapWithId', NONE)
            }}
          />
          <DatePickerField
            control={control}
            name="date"
            label="Date"
            minDate={startOfToday()}
            onValueChange={() => {
              form.setValue('swapWithId', NONE)
            }}
            required
          />
          <SelectField
            control={control}
            name="rosterGroupId"
            label="Time Roster"
            placeholder="Select Time Roster"
            options={(lookups.data?.rosters ?? []).map((roster) => ({
              value: roster.id,
              label: roster.title,
            }))}
            disabled={swapping}
            description={swapping ? 'Swapping takes the colleague’s shift instead.' : undefined}
          />
        </div>
      </FieldLayoutContext>

      <FieldLayoutContext value="vertical">
        <div className="grid gap-5 @2xl:grid-cols-2 @2xl:gap-x-10 @2xl:px-12">
          <div className="grid gap-2.5">
            <span className="font-inter text-base leading-none text-heading">Swap From</span>
            <span
              role="textbox"
              aria-readonly="true"
              aria-label="Swap From"
              className="flex min-h-9 items-center rounded-md border border-input px-3 py-1.5 font-inter text-sm text-field-value"
            >
              {current}
            </span>
          </div>
          <SelectField
            control={control}
            name="swapWithId"
            label="Swap To"
            placeholder={
              date ? (colleagues.length ? 'No swap' : 'Nobody to swap with') : 'Choose a date'
            }
            options={colleagues.map((colleague) => ({
              value: colleague.person.id,
              label: `${colleague.person.name} · ${colleague.shift}`,
            }))}
            clearable="No swap"
            disabled={!date || colleagues.length === 0}
          />
        </div>
        <TextareaField
          control={control}
          name="description"
          label="Description"
          textareaClassName="min-h-40"
          showCount
        />
      </FieldLayoutContext>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {rootError && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {rootError}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className={cn(
            dialogButtonClass,
            'bg-sidebar text-white hover:bg-sidebar/90 dark:bg-primary',
          )}
        >
          Save
        </Button>
        <Button
          variant="destructive"
          size="lg"
          onClick={() => {
            form.reset(empty)
            onCancel?.()
          }}
          className={dialogButtonClass}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

/** Edit a pending shift request in a popup. */
export function ShiftRequestDialog({
  request,
  onClose,
}: {
  request: ShiftRequest
  onClose: () => void
}) {
  return (
    <AppDialog
      title={`Shift Request Edit, ${request.code}`}
      onRequestClose={onClose}
      className="max-w-3xl"
    >
      <ShiftRequestForm request={request} onDone={onClose} onCancel={onClose} />
    </AppDialog>
  )
}
