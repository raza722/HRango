import { type DragEvent, type FocusEvent, useState } from 'react'
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
import type { ScheduleEntry } from '../types/scheduling.types'
import { formatClock } from '../utils/shift-hours'
import { schedulingType } from './type-styles'

export type CellAction = 'edit' | 'view' | 'swap' | 'delete'

/** MIME type used while a shift is dragged onto another cell (Swap Shift). */
export const DRAG_TYPE = 'application/x-hrms-schedule-entry'

interface DayCellProps {
  entry: ScheduleEntry | undefined
  employeeName: string
  date: string
  tone: ShiftTone
  isToday: boolean
  multiselect: boolean
  selected: boolean
  /** Empty cells offer "Create schedule" / "Create rest day". */
  canCreate: boolean
  onToggleSelect: (entry: ScheduleEntry) => void
  onAction: (action: CellAction, entry: ScheduleEntry) => void
  /** Move (or swap) a shift to this cell. */
  onDropEntry: (entryId: string) => void
  /** Move a shift one day earlier or later for the same person. */
  onNudge: (entry: ScheduleEntry, days: -1 | 1) => void
  onCreate: (kind: 'shift' | 'rest') => void
}

function Dots({ entry }: { entry: ScheduleEntry }) {
  const dots = [
    entry.workFromHome && LEGEND.workFromHome,
    entry.kind === 'rest' && LEGEND.restDay,
    entry.geoFenceIds.length > 0 && LEGEND.geoFence,
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

/**
 * One day of one person on the board: a shift block (dots, clock in / clock
 * out, coloured by time roster), a "Day off" chip, or an empty slot.
 * Click a shift for Edit / View / Swap / Delete; drag it onto another cell to
 * swap; in multiselect mode a click selects it instead.
 */
export function DayCell({
  entry,
  employeeName,
  date,
  tone,
  isToday,
  multiselect,
  selected,
  canCreate,
  onToggleSelect,
  onAction,
  onDropEntry,
  onNudge,
  onCreate,
}: DayCellProps) {
  const [open, setOpen] = useState(false)
  const [dropTarget, setDropTarget] = useState(false)
  const label = `${employeeName}, ${formatDisplayDate(date)}`

  const dropHandlers = {
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
      if (id && id !== entry?.id) {
        event.preventDefault()
        onDropEntry(id)
      }
    },
  }

  const frame = cn(
    'relative h-[4.75rem] p-1 align-top transition-colors',
    isToday && 'bg-violet-100/70 dark:bg-violet-500/10',
    dropTarget && 'bg-primary/15 outline-2 -outline-offset-2 outline-primary outline-dashed',
  )

  if (!entry) {
    return (
      <td className={frame} {...dropHandlers}>
        {canCreate && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={`Add to ${label}`}
              className="flex size-full items-center justify-center rounded-sm text-label opacity-0 transition-opacity outline-none hover:bg-muted hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:opacity-100 pointer-coarse:opacity-60"
            >
              <Plus className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="font-inter">
              <DropdownMenuItem
                onSelect={() => {
                  onCreate('shift')
                }}
              >
                Create schedule
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  onCreate('rest')
                }}
              >
                Create rest day
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    )
  }

  const isShift = entry.kind === 'shift'
  const close = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }
  const act = (action: CellAction) => {
    setOpen(false)
    onAction(action, entry)
  }

  if (!isShift && !multiselect) {
    return (
      <td className={frame} {...dropHandlers}>
        <div onBlur={close} className="relative">
          <button
            type="button"
            aria-label={`${label}: ${entry.restDayPayable ? 'paid rest day' : 'day off'}`}
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value)
            }}
            className={cn(
              // Figma: "Day off" Inter Medium 16 #585858. One line across the whole cell: at
              // 16 px the label is about as wide as a day column, so it must not wrap out of
              // the grey box.
              'flex h-7 w-full items-center justify-center gap-1 rounded-sm bg-chip px-1.5 text-xs font-medium whitespace-nowrap outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring/40 sm:text-base dark:bg-input',
              schedulingType.grey,
            )}
          >
            <span className={cn('size-1.5 rounded-full', LEGEND.restDay.dot)} aria-hidden="true" />
            {entry.restDayPayable ? 'Rest Day' : 'Day off'}
          </button>
          {open && (
            <div className="absolute top-8 left-0 z-10 flex gap-1 rounded-md border bg-popover p-1 shadow-md">
              <IconButton
                label="View"
                onClick={() => {
                  act('view')
                }}
              >
                <Eye />
              </IconButton>
              <IconButton
                label="Edit"
                onClick={() => {
                  act('edit')
                }}
              >
                <SquarePen />
              </IconButton>
              <IconButton
                label="Delete"
                tone="danger"
                onClick={() => {
                  act('delete')
                }}
              >
                <X />
              </IconButton>
            </div>
          )}
        </div>
      </td>
    )
  }

  const times = isShift
    ? `${formatClock(entry.clockIn)} to ${formatClock(entry.clockOut)}`
    : 'Day off'
  const overnight = isShift && entry.slot.isOvernight

  return (
    <td className={frame} {...dropHandlers}>
      <div
        onBlur={close}
        draggable={!multiselect && isShift}
        onDragStart={(event) => {
          event.dataTransfer.setData(DRAG_TYPE, entry.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        className={cn(
          'group/cell relative flex size-full flex-col rounded-sm px-2 pt-1.5 pb-1 text-field-foreground',
          isShift ? tone.cell : 'bg-chip/70 dark:bg-input',
          selected && 'bg-orange-200/80 ring-2 ring-heading dark:bg-orange-400/30',
          !multiselect && isShift && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {isShift && (
          <>
            <span
              aria-hidden="true"
              className={cn('absolute inset-y-0 left-0 w-1 rounded-l-sm', tone.bar)}
            />
            <span
              aria-hidden="true"
              className={cn('absolute inset-y-0 right-0 w-1 rounded-r-sm', tone.bar)}
            />
          </>
        )}

        <button
          type="button"
          aria-label={
            isShift
              ? `${label}: ${entry.slot.name}, ${times}`
              : `${label}: ${entry.restDayPayable ? 'paid rest day' : 'day off'}`
          }
          aria-pressed={multiselect ? selected : undefined}
          aria-expanded={multiselect ? undefined : open}
          onClick={() => {
            if (multiselect) onToggleSelect(entry)
            else setOpen((value) => !value)
          }}
          className="absolute inset-0 z-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />

        <span className="pointer-events-none relative flex min-h-2.5 items-center justify-between gap-1">
          <Dots entry={entry} />
          {overnight && (
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
          {isShift ? (
            <>
              <span className="block">{formatClock(entry.clockIn)}</span>
              <span className="block">{formatClock(entry.clockOut)}</span>
            </>
          ) : (
            'Day off'
          )}
        </span>

        {!multiselect && isShift && (
          <>
            <button
              type="button"
              aria-label={`Move ${label} to the previous day`}
              onClick={() => {
                onNudge(entry, -1)
              }}
              className="absolute top-1/2 -left-0.5 z-10 flex h-6 w-3 -translate-y-1/2 items-center justify-center text-heading/70 opacity-0 transition-opacity outline-none group-hover/cell:opacity-100 hover:text-heading focus-visible:opacity-100 pointer-coarse:opacity-70"
            >
              <ChevronLeft className="size-3" strokeWidth={3} />
            </button>
            <button
              type="button"
              aria-label={`Move ${label} to the next day`}
              onClick={() => {
                onNudge(entry, 1)
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
              <IconButton
                label={`Edit ${label}`}
                onClick={() => {
                  act('edit')
                }}
              >
                <SquarePen />
              </IconButton>
              <IconButton
                label={`View ${label}`}
                onClick={() => {
                  act('view')
                }}
              >
                <Eye />
              </IconButton>
              <IconButton
                label={`Swap ${label}`}
                onClick={() => {
                  act('swap')
                }}
              >
                <ArrowLeftRight />
              </IconButton>
            </div>
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
          </div>
        )}
      </div>
    </td>
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
  children: React.ReactNode
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
