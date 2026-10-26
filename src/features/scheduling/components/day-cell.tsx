import {
  type CSSProperties,
  type DragEvent,
  type FocusEvent,
  type ReactNode,
  useState,
} from 'react'
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Moon,
  Plus,
  SquarePen,
  X,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDisplayDate } from '@/lib/date'
import { cn } from '@/lib/utils'

import { LEGEND, type ShiftTone } from '../constants'
import type { BoardHoliday, BoardRestDay, BoardShift } from '../types/scheduling.types'
import { clockOf, formatClock } from '../utils/shift-hours'
import { schedulingType } from './type-styles'

export type CellAction = 'edit' | 'view' | 'swap' | 'delete'

/** MIME type used while a shift is dragged onto another cell (Swap Shift / move). */
export const DRAG_TYPE = 'application/x-hrms-schedule-entry'

/** What the signed-in user may do from a cell. */
export interface CellPermissions {
  create: boolean
  edit: boolean
  delete: boolean
  createRestDay: boolean
  deleteRestDay: boolean
}

interface DayCellProps {
  /** The shifts of this person on this date (usually one). */
  shifts: readonly BoardShift[]
  restDay: BoardRestDay | undefined
  holiday: BoardHoliday | undefined
  employeeName: string
  date: string
  toneFor: (timeSlotId: string | null) => ShiftTone
  isToday: boolean
  multiselect: boolean
  selected: boolean
  /** Empty cells offer "Create schedule" / "Create rest day" on the All / Subordinates tabs. */
  canCreateHere: boolean
  can: CellPermissions
  onToggleSelect: (shift: BoardShift) => void
  onAction: (action: CellAction, shift: BoardShift) => void
  onRestDayAction: (action: 'view' | 'delete', restDay: BoardRestDay) => void
  /** Move (or swap) a dragged shift to this cell. */
  onDropShift: (shiftId: string) => void
  /** Move a shift one day earlier or later for the same person. */
  onNudge: (shift: BoardShift, days: -1 | 1) => void
  onCreate: (kind: 'shift' | 'rest') => void
}

function Dots({ shift, holiday }: { shift: BoardShift; holiday: BoardHoliday | undefined }) {
  const dots = [
    shift.isWfh && LEGEND.workFromHome,
    shift.geoFenceId !== null && LEGEND.geoFence,
    holiday !== undefined && LEGEND.holiday,
  ].filter((dot) => dot !== false)
  if (dots.length === 0) return null
  return (
    <span className="flex items-center gap-1">
      {dots.map((dot) => (
        <span key={dot.label} title={dot.label} className={cn('size-1.5 rounded-full', dot.dot)} />
      ))}
      <span className="sr-only">{dots.map((dot) => dot.label).join(', ')}</span>
    </span>
  )
}

/** The slot's own colour (Scheduling settings), softened for the cell; else the tone classes. */
function slotStyle(color: string | null): { cell?: CSSProperties; bar?: CSSProperties } {
  if (!color) return {}
  return {
    cell: { backgroundColor: `color-mix(in srgb, ${color} 45%, transparent)` },
    bar: { backgroundColor: color },
  }
}

/**
 * One day of one person on the board: a shift block (dots, start / end, coloured by time
 * slot), a "Rest Day" / "Day off" chip, a holiday chip, or an empty slot. Click a shift
 * for Edit / View / Swap / Delete; drag it onto another cell to swap or move it; in
 * multiselect mode a click selects it instead.
 */
export function DayCell({
  shifts,
  restDay,
  holiday,
  employeeName,
  date,
  toneFor,
  isToday,
  multiselect,
  selected,
  canCreateHere,
  can,
  onToggleSelect,
  onAction,
  onRestDayAction,
  onDropShift,
  onNudge,
  onCreate,
}: DayCellProps) {
  const [open, setOpen] = useState(false)
  const [dropTarget, setDropTarget] = useState(false)
  const label = `${employeeName}, ${formatDisplayDate(date)}`
  const shift = shifts[0]
  const more = shifts.length - 1

  const dropHandlers = can.edit
    ? {
        onDragOver: (event: DragEvent) => {
          if (!event.dataTransfer.types.includes(DRAG_TYPE)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          setDropTarget(true)
        },
        onDragLeave: () => {
          setDropTarget(false)
        },
        onDrop: (event: DragEvent) => {
          setDropTarget(false)
          const id = event.dataTransfer.getData(DRAG_TYPE)
          if (id && id !== shift?.id) {
            event.preventDefault()
            onDropShift(id)
          }
        },
      }
    : {}

  const frame = cn(
    'relative h-[4.75rem] p-1 align-top transition-colors',
    isToday && 'bg-violet-100/70 dark:bg-violet-500/10',
    dropTarget && 'bg-primary/15 outline-2 -outline-offset-2 outline-primary outline-dashed',
  )
  const close = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }

  if (!shift && restDay) {
    const text = restDay.isPayable ? 'Rest Day' : 'Day off'
    return (
      <td className={frame} {...dropHandlers}>
        <div onBlur={close} className="relative">
          <button
            type="button"
            aria-label={`${label}: ${restDay.isPayable ? 'paid rest day' : 'day off'}`}
            aria-expanded={open}
            disabled={multiselect}
            onClick={() => {
              setOpen((value) => !value)
            }}
            className={cn(
              // Figma: "Day off" Inter Medium 16 #585858, one line across the whole cell.
              'flex h-7 w-full items-center justify-center gap-1 rounded-sm bg-chip px-1.5 text-xs font-medium whitespace-nowrap outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-base dark:bg-input',
              schedulingType.grey,
            )}
          >
            <span className={cn('size-1.5 rounded-full', LEGEND.restDay.dot)} aria-hidden="true" />
            {text}
          </button>
          {holiday && <HolidayChip holiday={holiday} className="mt-1" />}
          {open && (
            <div className="absolute top-8 left-0 z-10 flex gap-1 rounded-md border bg-popover p-1 shadow-md">
              <IconButton
                label={`View ${label}`}
                onClick={() => {
                  setOpen(false)
                  onRestDayAction('view', restDay)
                }}
              >
                <Eye />
              </IconButton>
              {can.deleteRestDay && (
                <IconButton
                  label={`Delete ${label}`}
                  tone="danger"
                  onClick={() => {
                    setOpen(false)
                    onRestDayAction('delete', restDay)
                  }}
                >
                  <X />
                </IconButton>
              )}
            </div>
          )}
        </div>
      </td>
    )
  }

  if (!shift) {
    const offers = canCreateHere && (can.create || can.createRestDay)
    return (
      <td className={frame} {...dropHandlers}>
        {holiday && <HolidayChip holiday={holiday} />}
        {offers && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={`Add to ${label}`}
              className={cn(
                'flex w-full items-center justify-center rounded-sm text-label opacity-0 transition-opacity outline-none hover:bg-muted hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:opacity-100 pointer-coarse:opacity-60',
                holiday ? 'h-8' : 'size-full',
              )}
            >
              <Plus className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="font-inter">
              {can.create && (
                <DropdownMenuItem
                  onSelect={() => {
                    onCreate('shift')
                  }}
                >
                  Create schedule
                </DropdownMenuItem>
              )}
              {can.createRestDay && (
                <DropdownMenuItem
                  onSelect={() => {
                    onCreate('rest')
                  }}
                >
                  Create rest day
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    )
  }

  const start = clockOf(shift.startAt)
  const end = clockOf(shift.endAt)
  const times = `${formatClock(start)} to ${formatClock(end)}`
  const tone = toneFor(shift.timeSlotId)
  const style = slotStyle(shift.timeSlotColor)
  const act = (action: CellAction) => {
    setOpen(false)
    onAction(action, shift)
  }
  const canChange = can.edit && !multiselect

  return (
    <td className={frame} {...dropHandlers}>
      <div
        onBlur={close}
        draggable={canChange}
        onDragStart={(event) => {
          event.dataTransfer.setData(DRAG_TYPE, shift.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        style={selected ? undefined : style.cell}
        className={cn(
          'group/cell relative flex size-full flex-col rounded-sm px-2 pt-1.5 pb-1 text-field-foreground',
          !style.cell && tone.cell,
          selected && 'bg-orange-200/80 ring-2 ring-heading dark:bg-orange-400/30',
          canChange && 'cursor-grab active:cursor-grabbing',
        )}
      >
        <span
          aria-hidden="true"
          style={style.bar}
          className={cn('absolute inset-y-0 left-0 w-1 rounded-l-sm', !style.bar && tone.bar)}
        />
        <span
          aria-hidden="true"
          style={style.bar}
          className={cn('absolute inset-y-0 right-0 w-1 rounded-r-sm', !style.bar && tone.bar)}
        />

        <button
          type="button"
          aria-label={`${label}: ${shift.timeSlotName}, ${times}${more > 0 ? `, and ${more} more` : ''}`}
          aria-pressed={multiselect ? selected : undefined}
          aria-expanded={multiselect ? undefined : open}
          onClick={() => {
            if (multiselect) onToggleSelect(shift)
            else setOpen((value) => !value)
          }}
          className="absolute inset-0 z-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />

        <span className="pointer-events-none relative flex min-h-2.5 items-center justify-between gap-1">
          <Dots shift={shift} holiday={holiday} />
          {more > 0 && (
            <span className="rounded-sm bg-card/80 px-1 text-[0.625rem] leading-tight text-heading">
              +{more}
            </span>
          )}
          {shift.isOvernight && (
            <Moon aria-hidden="true" className="ml-auto size-3 text-muted-foreground" />
          )}
          {multiselect && (
            <X
              aria-hidden="true"
              className={cn('size-3.5', selected ? 'text-heading' : 'text-heading/70')}
              strokeWidth={3}
            />
          )}
        </span>
        {/* Figma: shift times Inter Medium 12 #585858. */}
        <span
          className={cn(
            'pointer-events-none relative mt-auto mb-auto text-center text-[0.6875rem] leading-snug font-medium tabular-nums sm:text-xs',
            schedulingType.grey,
          )}
        >
          <span className="block">{formatClock(start)}</span>
          <span className="block">{formatClock(end)}</span>
        </span>

        {canChange && (
          <>
            <button
              type="button"
              aria-label={`Move ${label} to the previous day`}
              onClick={() => {
                onNudge(shift, -1)
              }}
              className="absolute top-1/2 -left-0.5 z-10 flex h-6 w-3 -translate-y-1/2 items-center justify-center text-heading/70 opacity-0 transition-opacity outline-none group-hover/cell:opacity-100 hover:text-heading focus-visible:opacity-100 pointer-coarse:opacity-70"
            >
              <ChevronLeft className="size-3" strokeWidth={3} />
            </button>
            <button
              type="button"
              aria-label={`Move ${label} to the next day`}
              onClick={() => {
                onNudge(shift, 1)
              }}
              className="absolute top-1/2 -right-0.5 z-10 flex h-6 w-3 -translate-y-1/2 items-center justify-center text-heading/70 opacity-0 transition-opacity outline-none group-hover/cell:opacity-100 hover:text-heading focus-visible:opacity-100 pointer-coarse:opacity-70"
            >
              <ChevronRight className="size-3" strokeWidth={3} />
            </button>
          </>
        )}

        {open && !multiselect && (
          // "On click edit": white strip with Edit / View (and Swap), red strip to delete.
          <div className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-sm bg-card shadow-md ring-1 ring-border">
            <div className="flex flex-1 items-center justify-center gap-0.5">
              {can.edit && (
                <IconButton
                  label={`Edit ${label}`}
                  onClick={() => {
                    act('edit')
                  }}
                >
                  <SquarePen />
                </IconButton>
              )}
              <IconButton
                label={`View ${label}`}
                onClick={() => {
                  act('view')
                }}
              >
                <Eye />
              </IconButton>
              {can.edit && (
                <IconButton
                  label={`Swap ${label}`}
                  onClick={() => {
                    act('swap')
                  }}
                >
                  <ArrowLeftRight />
                </IconButton>
              )}
            </div>
            {can.delete && (
              <button
                type="button"
                aria-label={`Delete ${label}`}
                onClick={() => {
                  act('delete')
                }}
                className="flex h-5 shrink-0 items-center justify-center bg-destructive text-destructive-foreground outline-none hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
      </div>
    </td>
  )
}

function HolidayChip({ holiday, className }: { holiday: BoardHoliday; className?: string }) {
  return (
    <span
      title={`${holiday.holidayName}${holiday.attendanceExempt ? '' : ' (working day)'}`}
      className={cn(
        'flex h-6 w-full items-center justify-center gap-1 truncate rounded-sm bg-amber-100 px-1.5 text-[0.6875rem] font-medium text-amber-900 dark:bg-amber-400/20 dark:text-amber-100',
        className,
      )}
    >
      <span
        className={cn('size-1.5 shrink-0 rounded-full', LEGEND.holiday.dot)}
        aria-hidden="true"
      />
      <span className="truncate">{holiday.holidayName}</span>
    </span>
  )
}

function IconButton({
  label,
  onClick,
  tone = 'default',
  children,
}: {
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label.split(' ')[0]}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:size-9 [&_svg]:size-4',
        tone === 'danger' ? 'text-destructive' : 'text-heading',
      )}
    >
      {children}
    </button>
  )
}
