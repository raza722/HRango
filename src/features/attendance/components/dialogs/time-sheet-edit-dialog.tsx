import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays } from 'lucide-react'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import {
  CheckboxField,
  DatePickerField,
  FieldLayoutContext,
  TimePickerField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { parseDateValue } from '@/lib/date'

import { useAttendanceDay, useUpdateDay } from '../../hooks/use-attendance'
import {
  dayEditSchema,
  type DayEditValues,
  toDayEditInput,
  toDayEditValues,
} from '../../schemas/time-sheet.schema'
import type { DayKey } from '../../types/attendance.types'
import { formatExpected, formatLongDate } from '../../utils/local-time'
import { interDialogClass } from '../../utils/settings-styles'
import { ManualBadge, ReadOnlyField } from '../shared/attendance-dialog'
import { PersonCard } from '../shared/person-card'
import { BreaksTable } from './breaks-table'
import { CommentsSection } from './comments-section'

const EMPTY: DayEditValues = {
  checkInDate: '',
  checkInTime: '',
  checkOutDate: '',
  checkOutTime: '',
  markAbsent: false,
  markHalfDay: false,
  markShortDay: false,
  breaks: [],
}

const expected = (time: string | null) =>
  time ? formatExpected(time).replace('Expected ', '') : '—'

/**
 * Time Sheet Edit (All): the person, Check In / Check Out dates and times
 * beside the expected ones, Mark Absent / Half Day / Short Day, the breaks
 * and the comments. Mark Absent folds the times away, as drawn.
 */
export function TimeSheetEditDialog({ dayKey, onClose }: { dayKey: DayKey; onClose: () => void }) {
  const formId = useId()
  const detail = useAttendanceDay(dayKey)
  const update = useUpdateDay()
  const form = useForm<DayEditValues>({
    resolver: zodResolver(dayEditSchema),
    defaultValues: EMPTY,
    // Loads the day once it arrives; a refetch (after a comment) keeps typed changes.
    values: detail.data ? toDayEditValues(detail.data) : undefined,
    resetOptions: { keepDirtyValues: true },
  })
  const { control } = form
  const markAbsent = useWatch({ control, name: 'markAbsent' })
  const checkInDate = useWatch({ control, name: 'checkInDate' })
  const data = detail.data
  const day = data?.day

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ key: dayKey, input: toDayEditInput(values) })
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = Object.entries(error.fieldErrors)
        for (const [field, message] of fields) {
          if (field === 'checkOut') form.setError('checkOutTime', { message })
          else if (/^breaks\.\d+\.inAt$/.test(field)) {
            form.setError(field.replace('inAt', 'inTime') as `breaks.${number}.inTime`, { message })
          }
        }
        if (fields.length === 0) form.setError('root', { message: error.message })
      }
      return
    }
    onClose()
  })

  const rootError = form.formState.errors.root?.message

  return (
    <AppDialog
      title={`Edit the time sheet of ${data?.profile.name ?? 'employee'}, ${formatLongDate(dayKey.date)}`}
      hideTitle
      className={interDialogClass}
      onRequestClose={onClose}
      footer={
        <>
          {rootError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {rootError}
            </p>
          )}
          <Button
            type="submit"
            form={formId}
            variant="success"
            size="lg"
            disabled={!data || update.isPending}
            className={dialogButtonClass}
          >
            Save
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      {detail.isError ? (
        <ErrorState
          title="Could not load this day"
          message="Check your connection and try again."
          onRetry={() => void detail.refetch()}
        />
      ) : (
        <div className="grid gap-7">
          <PersonCard profile={data?.profile} />

          <FieldLayoutContext value="vertical">
            <form
              id={formId}
              noValidate
              onSubmit={(event) => void submit(event)}
              className="grid gap-7"
              aria-label="Time sheet"
            >
              {day && (
                <div className="grid gap-x-6 gap-y-4 @xl:grid-cols-2 @3xl:grid-cols-3">
                  {markAbsent ? (
                    <>
                      <ReadOnlyField
                        tone="edit"
                        label="Date"
                        value={formatLongDate(day.date)}
                        icon={<CalendarDays className="size-4 shrink-0" aria-hidden="true" />}
                        className="@3xl:col-span-3 @3xl:max-w-md"
                      />
                      <div className="flex flex-wrap items-end gap-6 @3xl:col-span-3">
                        <CheckboxField control={control} name="markAbsent" label="Mark Absent" />
                        <ManualBadge updated={day.manuallyUpdated} />
                      </div>
                    </>
                  ) : (
                    <>
                      <ReadOnlyField
                        tone="edit"
                        label="Day"
                        value={formatLongDate(day.date)}
                        icon={<CalendarDays className="size-4 shrink-0" aria-hidden="true" />}
                      />
                      <DatePickerField control={control} name="checkInDate" label="Check In" />
                      <ReadOnlyField
                        tone="edit"
                        label="Expected Check In"
                        value={expected(day.expectedIn)}
                      />
                      <TimePickerField control={control} name="checkInTime" label="Check In Time" />
                      <DatePickerField
                        control={control}
                        name="checkOutDate"
                        label="Check Out Date"
                        minDate={parseDateValue(checkInDate)}
                      />
                      <ReadOnlyField
                        tone="edit"
                        label="Expected Check Out"
                        value={expected(day.expectedOut)}
                      />
                      <TimePickerField
                        control={control}
                        name="checkOutTime"
                        label="Check Out Time"
                      />
                      <div className="flex items-end">
                        <ManualBadge updated={day.manuallyUpdated} />
                      </div>
                      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                        <CheckboxField control={control} name="markAbsent" label="Mark Absent" />
                        <CheckboxField control={control} name="markHalfDay" label="Mark Half Day" />
                      </div>
                      <CheckboxField control={control} name="markShortDay" label="Mark Short Day" />
                    </>
                  )}
                </div>
              )}

              {day &&
                (markAbsent ? (
                  <p className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
                    An absent day has no check in, check out or breaks; saving clears them.
                  </p>
                ) : (
                  <BreaksTable control={control} day={day.date} />
                ))}
            </form>
          </FieldLayoutContext>

          {data && <CommentsSection dayKey={dayKey} comments={data.comments} />}
        </div>
      )}
    </AppDialog>
  )
}
