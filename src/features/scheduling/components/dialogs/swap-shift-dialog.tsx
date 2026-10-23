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
import type { BoardRow, ScheduleEntry } from '../../types/scheduling.types'
import { toDate } from '../../utils/schedule-dates'
import { formatClock } from '../../utils/shift-hours'
import { schedulingType } from '../type-styles'
import { SchedulingDialog } from './scheduling-dialog'

interface SwapShiftDialogProps {
  entry: ScheduleEntry
  rows: readonly BoardRow[]
  days: readonly string[]
  onClose: () => void
}

function describe(entry: ScheduleEntry | undefined): string {
  if (!entry) return 'Nothing scheduled: the shift moves there.'
  if (entry.kind === 'rest') return 'A day off: the two days trade places.'
  return `${entry.slot.name}, ${formatClock(entry.clockIn)} – ${formatClock(entry.clockOut)}: the two shifts trade places.`
}

/**
 * Swap Shift without dragging: choose the person and day to swap with. The
 * same swap happens when a shift is dragged onto another cell.
 */
export function SwapShiftDialog({ entry, rows, days, onClose }: SwapShiftDialogProps) {
  const swap = useSwapShift()
  const [employeeId, setEmployeeId] = useState(
    rows.find((row) => row.employee.id !== entry.employeeId)?.employee.id ?? entry.employeeId,
  )
  const [date, setDate] = useState(entry.date)
  const source = rows.find((row) => row.employee.id === entry.employeeId)
  const targetRow = rows.find((row) => row.employee.id === employeeId)
  const target = targetRow?.entries.find((item) => item.date === date)
  const same = employeeId === entry.employeeId && date === entry.date

  return (
    <SchedulingDialog
      title="Swap Shift"
      description={`${source?.employee.name ?? 'This employee'} · ${format(toDate(entry.date), 'EEE d MMM yyyy')} · ${formatClock(entry.clockIn)} – ${formatClock(entry.clockOut)}`}
      onRequestClose={onClose}
      className="max-w-2xl"
      footer={
        <>
          <Button
            variant="success"
            size="lg"
            disabled={same || swap.isPending}
            onClick={() => {
              swap.mutate(
                { entryId: entry.id, targetEmployeeId: employeeId, targetDate: date },
                { onSuccess: onClose },
              )
            }}
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
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="swap-employee" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rows.map((row) => (
                  <SelectItem key={row.employee.id} value={row.employee.id}>
                    {row.employee.name} ({row.employee.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="swap-date">On</Label>
            <Select value={date} onValueChange={setDate}>
              <SelectTrigger id="swap-date" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day} value={day}>
                    {format(toDate(day), 'EEE d MMM yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p
          aria-live="polite"
          className={cn('rounded-md bg-muted px-3 py-2.5', schedulingType.value)}
        >
          {same ? 'Pick another person or day.' : describe(target)}
        </p>
        <p className="text-xs text-muted-foreground">
          Tip: on the board you can also drag a shift onto another cell, or use the arrows on its
          sides to move it a day.
        </p>
      </div>
    </SchedulingDialog>
  )
}
