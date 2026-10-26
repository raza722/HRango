import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import { DatePickerField, FieldLayoutContext, SelectField, TextareaField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import type { FileRef } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type RequestBody, typePermission } from '../../api/backend'
import { engineApi } from '../../api/engine.api'
import { currentPerson } from '../../api/lookups.api'
import {
  useCreateRequest,
  useDayShift,
  useSwapColleagueSearch,
  useTimeSlots,
  useUpdateRequest,
} from '../../hooks/use-requests'
import { shiftRequestSchema, type ShiftRequestValues } from '../../schemas/request-forms.schema'
import type { ShiftRequest } from '../../types/requests.types'
import { clock } from '../../utils/request-format'
import { RequestEmployeeField } from '../shared/request-employee-field'
import { RequestFileField } from '../shared/request-files'
import { shiftFieldsClass } from '../shared/request-styles'

const NONE = ''

/** The API's field names → the form's. */
const FIELD_OF: Record<string, keyof ShiftRequestValues> = {
  employeeId: 'employeeId',
  shiftDate: 'date',
  fromDate: 'date',
  timeSlotId: 'timeSlotId',
  withEmployeeId: 'swapWithId',
  description: 'description',
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/**
 * Shift Request as drawn: Employee Name, Date and Time Slot (labels on the
 * left), then Swap From (the shift that day) and Swap To (a colleague), and
 * Description. Ask for another time slot for the day, or to swap with a
 * colleague, who gives consent before the flow starts (`details { shiftDate,
 * timeSlotId | withEmployeeId }`).
 */
export function ShiftRequestForm({
  request,
  onDone,
  onCancel,
  forOthers = true,
}: {
  /** Edit this pending request; a new one when absent. */
  request?: ShiftRequest | undefined
  onDone?: () => void
  onCancel?: () => void
  /** Show the Employee Name picker (the caller may file for others). */
  forOthers?: boolean
}) {
  const formId = useId()
  const create = useCreateRequest('shift')
  const update = useUpdateRequest('shift')
  const slots = useTimeSlots()
  const [file, setFile] = useState<FileRef | null>(null)
  const empty: ShiftRequestValues = {
    // Empty means the signed-in person.
    employeeId: '',
    date: '',
    timeSlotId: NONE,
    swapWithId: NONE,
    description: '',
  }
  const form = useForm<ShiftRequestValues>({
    resolver: zodResolver(shiftRequestSchema),
    defaultValues: request
      ? {
          employeeId: request.employee.id,
          date: request.payload.shiftDate ?? request.fromDate ?? '',
          timeSlotId: request.payload.timeSlotId ?? NONE,
          swapWithId: request.payload.withEmployeeId ?? NONE,
          description: request.description ?? '',
        }
      : empty,
  })
  const { control } = form
  const [employeeId, date, swapWithId] = useWatch({
    control,
    name: ['employeeId', 'date', 'swapWithId'],
  })
  const who = employeeId || currentPerson()?.id
  const shift = useDayShift(who, date)
  const [colleagueSearch, setColleagueSearch] = useState('')
  const colleagues = useSwapColleagueSearch(who, date, colleagueSearch)
  // The chosen colleague keeps their name while a later search hides them.
  const [chosenColleague, setChosenColleague] = useState<{ value: string; label: string } | null>(
    request?.payload.withEmployeeId
      ? {
          value: request.payload.withEmployeeId,
          label: request.payload.withEmployeeName ?? request.payload.withEmployeeId,
        }
      : null,
  )
  const colleagueOptions = colleagues.rows.map((colleague) => ({
    value: colleague.person.id,
    label: colleague.shift
      ? `${colleague.person.name} · ${colleague.shift}`
      : colleague.person.name,
    hint: colleague.person.code,
  }))
  const swapping = swapWithId !== NONE

  const current = shift.data
    ? shift.data.clockIn
      ? `${shift.data.slotName ?? ''} (${clock(shift.data.clockIn)} – ${clock(shift.data.clockOut)})`
      : shift.data.restDay
        ? 'Rest Day'
        : 'Not scheduled'
    : 'Choose a date'

  const submit = form.handleSubmit(async (values) => {
    const body: RequestBody = {
      ...(values.employeeId && !request ? { employeeId: values.employeeId } : {}),
      fromDate: values.date,
      toDate: values.date,
      description: values.description.trim() || null,
      details: {
        shiftDate: values.date,
        timeSlotId: values.swapWithId ? null : values.timeSlotId || null,
        withEmployeeId: values.swapWithId || null,
      },
    }
    try {
      if (request) {
        await update.mutateAsync({
          id: request.id,
          body: { ...body, rowVersion: request.rowVersion },
        })
        if (file) await engineApi.addAttachment('shift', request.id, file.id)
      } else {
        await create.mutateAsync({ ...body, attachments: file ? [file.id] : [] })
      }
    } catch (error) {
      if (error instanceof ApiError) {
        let shown = false
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          const name = FIELD_OF[field]
          if (name) {
            form.setError(name, { message })
            shown = true
          }
        }
        if (!shown) form.setError('root', { message: error.message })
      }
      return
    }
    form.reset(empty)
    setFile(null)
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
          {forOthers && (
            <RequestEmployeeField
              control={control}
              name="employeeId"
              label="Employee Name"
              placeholder="Myself"
              permission={typePermission('shift', 'create')}
              current={request?.employee}
              disabled={request !== undefined}
              enabled={request === undefined}
              clearable
              onPick={(id) => {
                if (!id) form.setValue('employeeId', '')
                form.setValue('swapWithId', NONE)
                setChosenColleague(null)
              }}
            />
          )}
          <DatePickerField
            control={control}
            name="date"
            label="Date"
            minDate={startOfToday()}
            onValueChange={() => {
              form.setValue('swapWithId', NONE)
              setChosenColleague(null)
            }}
            required
          />
          <SelectField
            control={control}
            name="timeSlotId"
            label="Time Slot"
            placeholder="Select Time Slot"
            options={(slots.data ?? []).map((slot) => ({
              value: slot.id,
              label: slot.startTime
                ? `${slot.name} (${clock(slot.startTime.slice(0, 5))} – ${clock(slot.endTime?.slice(0, 5) ?? null)})`
                : slot.name,
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
          <SearchSelectField
            control={control}
            name="swapWithId"
            label="Swap To"
            placeholder={date ? 'No swap' : 'Choose a date'}
            options={[
              ...(chosenColleague &&
              !colleagueOptions.some((option) => option.value === chosenColleague.value)
                ? [chosenColleague]
                : []),
              ...colleagueOptions,
            ]}
            clearable
            disabled={!date}
            onSearch={setColleagueSearch}
            loading={colleagues.isFetching}
            hasMore={colleagues.hasMore}
            onLoadMore={colleagues.loadMore}
            onValueChange={(next) => {
              if (next) {
                form.setValue('timeSlotId', NONE)
                setChosenColleague(colleagueOptions.find((option) => option.value === next) ?? null)
              } else {
                form.setValue('swapWithId', NONE)
                setChosenColleague(null)
              }
            }}
          />
        </div>
        <RequestFileField value={file} onChange={setFile} />
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
            setFile(null)
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
