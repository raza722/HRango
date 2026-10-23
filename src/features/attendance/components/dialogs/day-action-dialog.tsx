import type { ReactNode, SyntheticEvent } from 'react'
import { useId } from 'react'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import { FieldLayoutContext } from '@/components/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { TimeSheetDay } from '../../types/attendance.types'
import { formatClockTime, formatExpected, formatSheetDate } from '../../utils/local-time'
import { interDialogClass } from '../../utils/settings-styles'
import { PunchChip } from '../shared/status-badges'

/** What the day looks like now: expected and actual times with their chips. */
function DaySummary({ day }: { day: TimeSheetDay }) {
  const side = (
    label: string,
    actual: string | null,
    expected: string | null,
    status: TimeSheetDay['clockInStatus'],
  ) => (
    <div className="grid gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2 text-sm text-heading">
        {actual ? formatClockTime(actual) : 'No punch'}
        {status && <PunchChip status={status} />}
      </dd>
      {expected && (
        <dd className="text-xs text-muted-foreground italic">{formatExpected(expected)}</dd>
      )}
    </div>
  )
  return (
    <dl className="grid grid-cols-2 gap-4 rounded-md bg-muted/60 px-4 py-3">
      {side('Clock In', day.checkIn, day.expectedIn, day.clockInStatus)}
      {side('Clock Out', day.checkOut, day.expectedOut, day.clockOutStatus)}
    </dl>
  )
}

/**
 * The small dialogs behind the row actions (Missing Punch, Relaxation,
 * Absent, Overtime): the day's summary, a short form, Save and Cancel.
 */
export function DayActionDialog({
  title,
  day,
  description,
  submitLabel = 'Save',
  pending,
  rootError,
  onSubmit,
  onClose,
  children,
}: {
  title: string
  day: TimeSheetDay
  description: ReactNode
  submitLabel?: string
  pending: boolean
  rootError: string | undefined
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
  onClose: () => void
  children: ReactNode
}) {
  const formId = useId()
  return (
    <AppDialog
      title={`${title}, ${formatSheetDate(day.date)}`}
      description={description}
      onRequestClose={onClose}
      className={cn('max-w-xl', interDialogClass)}
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
            disabled={pending}
            className={dialogButtonClass}
          >
            {submitLabel}
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <DaySummary day={day} />
        <FieldLayoutContext value="vertical">
          <form id={formId} noValidate onSubmit={onSubmit} className="grid gap-4">
            {children}
          </form>
        </FieldLayoutContext>
      </div>
    </AppDialog>
  )
}
