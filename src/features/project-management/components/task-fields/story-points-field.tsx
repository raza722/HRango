import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { usePeople } from '../../hooks/use-pm'
import type { StoryPoint, TaskRow } from '../../types/pm.types'
import { ChevronDownIcon, DeleteIcon, MoreVerticalIcon, StarIcon } from './field-icons'
import { FieldPopover, PersonAvatar, PopupHeader, SearchField } from './field-popup'
import { fieldStyles } from './field-styles'
import { RATING_LABELS, storyPointTotal } from './field-utils'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

/** The stars' fills: the first yellow, the second orange, the third green (Excellent Results). */
const STAR_COLORS = ['#FFC727', '#FF9A1F', '#7ED957'] as const

/** "Stars Rating": three stars; hovering each names its rating, clicking sets it. */
export function RatingStars({
  rating,
  onRate,
  size = 'size-5',
}: {
  rating: number
  onRate?: (rating: number) => void
  size?: string
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {RATING_LABELS.map((label, index) => {
        const value = index + 1
        const filled = value <= rating
        const star = (
          <StarIcon
            className={size}
            strokeWidth={1.5}
            style={{
              color: filled ? '#8A5A00' : '#A0855B',
              fill: filled ? STAR_COLORS[index] : '#E9DDBF',
            }}
          />
        )
        if (!onRate) return <span key={label}>{star}</span>
        return (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                aria-pressed={rating === value}
                onClick={() => {
                  onRate(rating === value ? 0 : value)
                }}
                className="rounded-sm focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
              >
                {star}
              </button>
            </TooltipTrigger>
            <TooltipContent className={fieldStyles.tooltip}>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </span>
  )
}

/** "05 Points": the number and the word on the lavender box. */
function PointsBadge({ points, className }: { points: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-[1.75rem] shrink-0 items-center gap-1.5 rounded-[0.4rem] bg-[#F6F2FF] px-2 text-[#626262]',
        className,
      )}
    >
      <span className="text-[1rem] leading-none font-medium">
        {String(points).padStart(2, '0')}
      </span>
      <span className="text-[0.71875rem] font-medium">Points</span>
    </span>
  )
}

/**
 * Story Points column ("Story Points Dropdown and Input Editable Field"): the task's points, the
 * rating stars and the assignees with points; the popup allocates points per assignee.
 */
export function StoryPointsCell({ task }: TaskCellProps) {
  const people = usePeople()
  const [open, setOpen] = useState(false)
  const total = storyPointTotal(task.storyPoints)
  const rating = RATING_LABELS[task.rating - 1]

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Story Points"
      className="w-[min(25rem,calc(100vw-1rem))] px-3 py-[0.9rem]"
      trigger={
        <button
          type="button"
          aria-label={`Story Points: ${total}${rating ? `, ${rating}` : ''}`}
          className={cn(fieldStyles.cell, 'gap-1.5')}
        >
          <PointsBadge points={total} />
          <RatingStars rating={task.rating} size="size-[1.05rem]" />
          {task.storyPoints[0] && (
            <PersonAvatar person={people.get(task.storyPoints[0].employeeId)} className="size-6" />
          )}
          <ChevronDownIcon className={fieldStyles.cellChevron} />
        </button>
      }
    >
      <StoryPointsPanel
        task={task}
        onClose={() => {
          setOpen(false)
        }}
      />
    </FieldPopover>
  )
}

function StoryPointsPanel({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const people = usePeople()
  const { save } = useTaskSave()
  const [search, setSearch] = useState('')
  const total = storyPointTotal(task.storyPoints)
  const allocated = new Set(task.storyPoints.map((entry) => entry.employeeId))
  const query = search.trim().toLowerCase()
  const available = task.assigneeIds.filter(
    (id) =>
      !allocated.has(id) && (!query || people.get(id)?.name.toLowerCase().includes(query) === true),
  )

  const setPoints = (points: StoryPoint[]) => {
    void save(task.id, { storyPoints: points })
  }

  return (
    <div className="flex flex-col gap-3">
      <PopupHeader title="Story Points" onClose={onClose}>
        <PointsBadge points={total} />
      </PopupHeader>

      <section aria-label="Allocated Story Points" className="flex flex-col gap-2">
        <h4 className={fieldStyles.sectionTitle}>Allocated Story Points</h4>
        {task.storyPoints.length === 0 ? (
          <p className="py-3 text-center text-sm font-medium text-[#909090]">
            No story points allocated
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {task.storyPoints.map((entry) => {
              const person = people.get(entry.employeeId)
              const name = person?.name ?? 'Unknown'
              return (
                <li key={entry.employeeId} className={cn(fieldStyles.row, 'pr-1')}>
                  <PersonAvatar person={person} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <PointsStepper
                    name={name}
                    value={entry.points}
                    onChange={(points) => {
                      setPoints(
                        task.storyPoints.map((other) =>
                          other.employeeId === entry.employeeId ? { ...other, points } : other,
                        ),
                      )
                    }}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Options for ${name}'s story points`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[#626262] hover:bg-white"
                    >
                      <MoreVerticalIcon className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="rounded-[0.625rem] p-1.5 shadow-[0_0_14px_rgba(0,0,0,0.12)]"
                    >
                      <DropdownMenuItem
                        onSelect={() => {
                          setPoints(
                            task.storyPoints.filter(
                              (other) => other.employeeId !== entry.employeeId,
                            ),
                          )
                        }}
                        className="h-9 gap-2 rounded-lg text-[0.8125rem] text-[#626262]"
                      >
                        <DeleteIcon className="size-4 text-[#DC3545]" />
                        Delete Story Points
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className={fieldStyles.divider} />

      <section aria-label="Select an Assignee for Story Points" className="flex flex-col gap-2">
        <h4 className={fieldStyles.sectionTitle}>Select an Assignee for Story Points</h4>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search assignee"
          label="Search assignee"
          className="h-9 w-full flex-none"
        />
        <ul className={cn(fieldStyles.scroll, 'flex max-h-44 flex-col gap-2 overflow-y-auto pr-1')}>
          {available.map((id) => {
            const person = people.get(id)
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setPoints([...task.storyPoints, { employeeId: id, points: 1 }])
                  }}
                  aria-label={`Allocate story points to ${person?.name ?? 'Unknown'}`}
                  className={fieldStyles.rowButton}
                >
                  <PersonAvatar person={person} />
                  <span className="truncate">{person?.name ?? 'Unknown'}</span>
                </button>
              </li>
            )
          })}
          {available.length === 0 && (
            <li className={cn(fieldStyles.muted, 'px-0.5')}>
              {task.assigneeIds.length === 0
                ? 'Add assignees to allocate story points'
                : 'Every assignee has story points'}
            </li>
          )}
        </ul>
      </section>

      <div className="flex items-center justify-between rounded-[0.5625rem] bg-[rgba(221,221,221,0.2)] px-3 py-2">
        <span className="text-[0.8125rem] font-medium text-[#626262]">
          {RATING_LABELS[task.rating - 1] ?? 'Rate the results'}
        </span>
        <RatingStars
          rating={task.rating}
          onRate={(rating) => {
            void save(task.id, { rating })
          }}
        />
      </div>
    </div>
  )
}

/** "00 Points" with purple minus / plus (1 to 100). */
function PointsStepper({
  name,
  value,
  onChange,
}: {
  name: string
  value: number
  onChange: (points: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const points = Math.round(Number(draft))
    setDraft(null)
    if (Number.isFinite(points) && points >= 0 && points <= 100 && points !== value) {
      onChange(points)
    }
  }
  const step = (delta: number) => {
    const points = Math.min(100, Math.max(0, value + delta))
    if (points !== value) onChange(points)
  }
  const stepButton =
    'flex size-5 items-center justify-center rounded text-sm leading-none font-semibold text-[#7127EA] hover:bg-[#EEE7FF] disabled:opacity-40'
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-md bg-white px-1 py-0.5 shadow-[0_0_7px_rgba(0,0,0,0.1)]">
      <button
        type="button"
        aria-label={`Fewer story points for ${name}`}
        disabled={value <= 0}
        onClick={() => {
          step(-1)
        }}
        className={stepButton}
      >
        −
      </button>
      <input
        aria-label={`Story points of ${name}`}
        inputMode="numeric"
        value={draft ?? String(value).padStart(2, '0')}
        onFocus={(event) => {
          event.target.select()
        }}
        onChange={(event) => {
          setDraft(event.target.value.replace(/\D/g, '').slice(0, 3))
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
        }}
        className="h-6 w-8 rounded-[0.125rem] bg-[#F6F4FF] text-center text-[0.9rem] font-medium text-[#626262] outline-none focus:ring-1 focus:ring-[#A181FF]"
      />
      <span className="text-[0.6875rem] font-medium text-[#626262]">Points</span>
      <button
        type="button"
        aria-label={`More story points for ${name}`}
        disabled={value >= 100}
        onClick={() => {
          step(1)
        }}
        className={stepButton}
      >
        +
      </button>
    </span>
  )
}
