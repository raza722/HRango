import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeftRight, Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { useSwapShift } from '../../hooks/use-scheduling'
import type { BoardRow, BoardShift } from '../../types/scheduling.types'
import { toDate } from '../../utils/schedule-dates'
import { clockOf, formatClock } from '../../utils/shift-hours'
import { schedulingType } from '../type-styles'
import { SchedulingDialog } from './scheduling-dialog'

interface SwapShiftDialogProps {
  shift: BoardShift
  /** The person the shift belongs to. */
  row: BoardRow
  /** Everyone on the board page (the people to swap with). */
  rows: readonly BoardRow[]
  onClose: () => void
}

const times = (shift: BoardShift) =>
  `${formatClock(clockOf(shift.startAt))} – ${formatClock(clockOf(shift.endAt))}`

/**
 * Swap Shift (`POST /scheduling/schedules/{id}/swap`): on the same date, trade with another
 * person's shift, or give the shift to someone who has none that day. Moving a shift to
 * another date is an edit (the arrows on a block, or dragging it along its own row).
 */
export function SwapShiftDialog({ shift, row, rows, onClose }: SwapShiftDialogProps) {
  const swap = useSwapShift()
  const others = rows.filter((item) => item.employee.id !== row.employee.id)
  const [employeeId, setEmployeeId] = useState(others[0]?.employee.id ?? '')
  const target = others.find((item) => item.employee.id === employeeId)
  const targetShifts = (target?.shifts ?? []).filter((item) => item.workDate === shift.workDate)
  const [pickedShiftId, setPickedShiftId] = useState<string | null>(null)
  const withShift = targetShifts.find((item) => item.id === pickedShiftId) ?? targetShifts[0]

  const submit = () => {
    swap.mutate(
      {
        id: shift.id,
        input: {
          ...(withShift ? { withScheduleId: withShift.id } : { withEmployeeId: employeeId }),
          rowVersion: shift.rowVersion,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <SchedulingDialog
      title="Swap Shift"
      description={`${row.employee.name} · ${format(toDate(shift.workDate), 'EEE d MMM yyyy')} · ${shift.timeSlotName} ${times(shift)}`}
      onRequestClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button
            variant="success"
            size="lg"
            disabled={!target || swap.isPending}
            onClick={submit}
            className={dialogButtonClass}
          >
            {swap.isPending ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
            Swap
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-4 @md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="swap-employee">Swap with</Label>
            <Select
              value={employeeId}
              onValueChange={(next) => {
                setEmployeeId(next)
                setPickedShiftId(null)
              }}
            >
              <SelectTrigger id="swap-employee" className="w-full">
                <SelectValue placeholder="Pick someone on this page" />
              </SelectTrigger>
              <SelectContent>
                {others.map((item) => (
                  <SelectItem key={item.employee.id} value={item.employee.id}>
                    {item.employee.name} ({item.employee.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {targetShifts.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="swap-shift">Their shift</Label>
              <Select value={withShift?.id ?? ''} onValueChange={setPickedShiftId}>
                <SelectTrigger id="swap-shift" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targetShifts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.timeSlotName} {times(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p
          aria-live="polite"
          className={cn('rounded-md bg-muted px-3 py-2.5', schedulingType.value)}
        >
          {!target
            ? 'Nobody else is on this page of the board.'
            : withShift
              ? `${withShift.timeSlotName}, ${times(withShift)}: the two shifts trade places.`
              : `${target.employee.name} has no shift that day: the shift moves to them.`}
        </p>
        <p className="text-xs text-muted-foreground">
          Tip: on the board you can also drag a shift onto someone else&apos;s cell on the same
          date, or use the arrows on its sides to move it a day.
        </p>
      </div>
    </SchedulingDialog>
  )
}
