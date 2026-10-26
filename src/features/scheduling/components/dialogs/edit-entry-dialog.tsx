import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import {
  CheckboxField,
  DatePickerField,
  FieldLayoutContext,
  TimePickerField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useSchedule, useTimeSlotOptions, useUpdateSchedule } from '../../hooks/use-scheduling'
import type { ScheduleDetail, ScheduleInput } from '../../types/scheduling.types'
import { toDate } from '../../utils/schedule-dates'
import { clockOf, hhmm } from '../../utils/shift-hours'
import { GeoFenceSelect } from '../fields/geo-fence-select'
import { TimeSlotSelectField } from '../fields/time-slot-select-field'
import { schedulingType } from '../type-styles'
import { SchedulingDialog } from './scheduling-dialog'

interface EditValues {
  workDate: string
  timeSlotId: string
  /** Other times than the slot's on this day. */
  customTimes: boolean
  startTime: string
  endTime: string
  geoFenceId: string
  isWfh: boolean
}

/** A read-only date box, as the first row of Edit / View Scheduling. */
export function DateRow({ date }: { date: string }) {
  return (
    <div className="grid gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]">
      <span className={cn('@xl:py-2', schedulingType.label)}>Date</span>
      <span
        className={cn(
          'flex min-h-10 items-center rounded-md bg-muted px-3 sm:px-4',
          schedulingType.value,
        )}
      >
        {format(toDate(date), 'd MMMM, yyyy')}
      </span>
    </div>
  )
}

const SERVER_FIELDS = ['workDate', 'timeSlotId', 'startTime', 'endTime', 'geoFenceId'] as const

function EditForm({ shift, onClose }: { shift: ScheduleDetail; onClose: () => void }) {
  const update = useUpdateSchedule()
  const slots = useTimeSlotOptions()
  const slot = (slots.data ?? []).find((item) => item.id === shift.timeSlotId)
  const start = clockOf(shift.startAt) ?? ''
  const end = clockOf(shift.endAt) ?? ''
  const [initial] = useState((): EditValues => ({
    workDate: shift.workDate,
    timeSlotId: shift.timeSlotId,
    // Unknown slot times (options not loaded): keep the shift's own times to be safe.
    customTimes: slot === undefined || hhmm(slot.startTime) !== start || hhmm(slot.endTime) !== end,
    startTime: start,
    endTime: end,
    geoFenceId: shift.geoFenceId ?? '',
    isWfh: shift.isWfh,
  }))
  const form = useForm<EditValues>({ defaultValues: initial })
  const customTimes = useWatch({ control: form.control, name: 'customTimes' })

  const submit = form.handleSubmit(async (values) => {
    if (values.customTimes && (!values.startTime || !values.endTime)) {
      form.setError('endTime', { message: 'Enter both times, or untick "Other times"' })
      return
    }
    const slotChanged = values.timeSlotId !== shift.timeSlotId
    const input: ScheduleInput = {
      workDate: values.workDate,
      timeSlotId: values.timeSlotId,
      startTime: values.customTimes ? values.startTime : null,
      endTime: values.customTimes ? values.endTime : null,
      geoFenceId: values.geoFenceId || null,
      isWfh: values.isWfh,
      // A new slot brings its own breaks; otherwise the shift keeps the ones it has.
      ...(slotChanged
        ? {}
        : {
            breaks: shift.breaks.map((item) => ({
              breakTypeId: item.breakTypeId,
              startTime: clockOf(item.startAt) ?? '00:00',
              endTime: clockOf(item.endAt) ?? '00:00',
              isInclusive: item.isInclusive,
            })),
          }),
      rowVersion: shift.rowVersion,
    }
    try {
      await update.mutateAsync({ id: shift.id, input })
    } catch (error) {
      if (error instanceof ApiError) {
        const field = SERVER_FIELDS.find((name) => error.fieldErrors[name])
        form.setError(field ?? 'root', {
          message: (field && error.fieldErrors[field]) ?? error.message,
        })
      }
      return
    }
    onClose()
  })
  const rootError = form.formState.errors.root?.message

  return (
    <SchedulingDialog
      title="Edit Scheduling"
      description={`${shift.employeeName} (${shift.employeeCode})`}
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          <Button
            type="submit"
            form="edit-entry-form"
            variant="success"
            size="lg"
            disabled={update.isPending}
            className={dialogButtonClass}
          >
            {update.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="edit-entry-form" noValidate onSubmit={submit} aria-label="Edit Scheduling">
        <FieldLayoutContext value="horizontal">
          <div className="grid gap-5">
            <DatePickerField control={form.control} name="workDate" label="Date" required />
            <TimeSlotSelectField control={form.control} name="timeSlotId" required />
            <CheckboxField
              control={form.control}
              name="customTimes"
              label="Other times than the slot's"
            />
            {customTimes && (
              <div className="grid gap-5 @3xl:grid-cols-2 @3xl:gap-x-10">
                <TimePickerField control={form.control} name="startTime" label="Start Time" />
                <TimePickerField control={form.control} name="endTime" label="End Time" />
              </div>
            )}
            <GeoFenceSelect control={form.control} name="geoFenceId" />
            <CheckboxField control={form.control} name="isWfh" label="Work From Home" />
            {shift.breaks.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Breaks:{' '}
                {shift.breaks
                  .map(
                    (item) =>
                      `${item.breakTypeName} ${clockOf(item.startAt) ?? ''}–${clockOf(item.endAt) ?? ''}`,
                  )
                  .join(', ')}
                . They stay unless the time slot changes.
              </p>
            )}
            {rootError && (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            )}
          </div>
        </FieldLayoutContext>
      </form>
    </SchedulingDialog>
  )
}

/** Edit Scheduling (one shift): date, time slot, other times, geo fence, work from home. */
export function EditEntryDialog({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const query = useSchedule(shiftId)
  if (!query.data) {
    return (
      <SchedulingDialog title="Edit Scheduling" onRequestClose={onClose} className="max-w-3xl">
        {query.error ? (
          <ErrorState
            message={query.error.message}
            onRetry={() => {
              void query.refetch()
            }}
            className="shadow-none"
          />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </SchedulingDialog>
    )
  }
  return <EditForm key={query.data.rowVersion} shift={query.data} onClose={onClose} />
}
