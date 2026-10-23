import { type DragEvent, type KeyboardEvent, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { STATUS_GROUP_LABELS } from '../../constants'
import type { StatusGroup, TaskStatus } from '../../types/pm.types'
import { ColorPickerPanel } from './color-picker'
import { AddStatusColorChip, FormError, InfoTip, StatusRing } from './wizard-controls'
import { STATUS_GROUP_HELP } from './wizard-icon-maps'
import { DotsIcon, DragHandleIcon, PlusIcon } from './wizard-icons'
import { STATUS_NAME_MAX, type StatusEditing } from './wizard-state'
import { wz } from './wizard-styles'

interface StatusGroupProps {
  group: StatusGroup
  statuses: readonly TaskStatus[]
  /** Custom statuses can be changed; the defaults are read-only. */
  editable: boolean
  editing: StatusEditing | null
  dragId: string | null
  onStartAdd: (group: StatusGroup, color?: string) => void
  onStartRename: (status: TaskStatus) => void
  onEditColor: (color: string) => void
  /** Returns why the name cannot be used, or null once saved. */
  onSubmitEdit: (name: string) => string | null
  onCancelEdit: () => void
  onRecolor: (id: string, color: string) => void
  onDelete: (status: TaskStatus) => void
  onMove: (id: string, offset: -1 | 1) => void
  onDragStart: (id: string) => void
  onDrop: (overId: string) => void
  onDragEnd: () => void
  /** Explains the drag handle's keys to screen readers. */
  handleHintId: string
}

/**
 * A status group of Edit Statuses (651:209727, 702:210425): the Medium 25 heading with its info
 * and "Add Status Color +", the 65px status rows (drag handle, ring, name, 3-dot menu) and, for
 * custom statuses, the dashed "+ Add status" row.
 */
export function StatusGroupSection({
  group,
  statuses,
  editable,
  editing,
  dragId,
  onStartAdd,
  onStartRename,
  onEditColor,
  onSubmitEdit,
  onCancelEdit,
  onRecolor,
  onDelete,
  onMove,
  onDragStart,
  onDrop,
  onDragEnd,
  handleHintId,
}: StatusGroupProps) {
  const headingId = useId()
  const [pickingNew, setPickingNew] = useState(false)
  const label = STATUS_GROUP_LABELS[group]
  const adding = editing?.kind === 'add' && editing.group === group

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={headingId} className={wz.title}>
          {label}
        </h3>
        <InfoTip label={label} text={STATUS_GROUP_HELP[group]} />
        <Popover open={pickingNew} onOpenChange={setPickingNew}>
          <PopoverTrigger asChild>
            <AddStatusColorChip
              disabled={!editable}
              aria-label={`Add Status Color to ${label}`}
              className="ml-auto"
            />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-auto rounded-2xl border-0 bg-white p-0 shadow-[0_0_7.8px_rgba(0,0,0,0.15)]"
          >
            <ColorPickerPanel
              title="Add Status Color"
              value={null}
              onPick={(color) => {
                setPickingNew(false)
                onStartAdd(group, color)
              }}
              onClose={() => {
                setPickingNew(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <ul aria-labelledby={headingId} className="mt-[0.6875rem] flex flex-col gap-3">
        {statuses.map((status, index) =>
          editing?.kind === 'rename' && editing.id === status.id ? (
            <StatusEditor
              key={status.id}
              color={editing.color}
              initialName={status.name}
              submitLabel="Save"
              inputLabel={`Rename ${status.name}`}
              onColor={onEditColor}
              onSubmit={onSubmitEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            <StatusRow
              key={status.id}
              status={status}
              editable={editable}
              position={index}
              count={statuses.length}
              dragging={dragId === status.id}
              canDrop={dragId !== null && dragId !== status.id}
              onRename={() => {
                onStartRename(status)
              }}
              onRecolor={(color) => {
                onRecolor(status.id, color)
              }}
              onDelete={() => {
                onDelete(status)
              }}
              onMove={(offset) => {
                onMove(status.id, offset)
              }}
              onDragStart={() => {
                onDragStart(status.id)
              }}
              onDrop={() => {
                onDrop(status.id)
              }}
              onDragEnd={onDragEnd}
              handleHintId={handleHintId}
            />
          ),
        )}
        {editable &&
          (adding ? (
            <StatusEditor
              color={editing.color}
              initialName=""
              submitLabel="Add Status"
              inputLabel={`New status in ${label}`}
              onColor={onEditColor}
              onSubmit={onSubmitEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            <li>
              <button
                type="button"
                onClick={() => {
                  onStartAdd(group)
                }}
                aria-label={`Add status to ${label}`}
                className="flex h-[4.0625rem] w-full items-center gap-[0.98rem] rounded-[1.125rem] border border-dashed border-[#A975FD] bg-white pl-[3.8125rem] text-left text-[1.0625rem] leading-[1.875rem] font-medium tracking-[0.0168rem] text-[#5D5D5D] transition-colors hover:bg-[#FAF8FF] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none sm:text-[1.25rem]"
              >
                <PlusIcon className="size-[0.9rem] text-[#7127EA]" />
                Add status
              </button>
            </li>
          ))}
      </ul>
    </section>
  )
}

function StatusRow({
  status,
  editable,
  position,
  count,
  dragging,
  canDrop,
  onRename,
  onRecolor,
  onDelete,
  onMove,
  onDragStart,
  onDrop,
  onDragEnd,
  handleHintId,
}: {
  status: TaskStatus
  editable: boolean
  position: number
  count: number
  dragging: boolean
  canDrop: boolean
  onRename: () => void
  onRecolor: (color: string) => void
  onDelete: () => void
  onMove: (offset: -1 | 1) => void
  onDragStart: () => void
  onDrop: () => void
  onDragEnd: () => void
  handleHintId: string
}) {
  const [recoloring, setRecoloring] = useState(false)
  const openPicker = useRef(false)

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const offset =
      event.key === 'ArrowUp' && position > 0
        ? -1
        : event.key === 'ArrowDown' && position < count - 1
          ? 1
          : 0
    if (offset === 0) return
    event.preventDefault()
    const handle = event.currentTarget
    // Moving the row can take the focus with it; keep it on the handle.
    flushSync(() => {
      onMove(offset)
    })
    handle.focus()
  }
  const dropProps = editable
    ? {
        draggable: true,
        onDragStart: (event: DragEvent) => {
          // Firefox only starts a drag that carries data.
          event.dataTransfer.setData('text/plain', status.id)
          onDragStart()
        },
        onDragOver: (event: DragEvent) => {
          if (canDrop) event.preventDefault()
        },
        onDrop: (event: DragEvent) => {
          event.preventDefault()
          onDrop()
        },
        onDragEnd,
      }
    : {}

  return (
    <li
      {...dropProps}
      aria-label={status.name}
      className={cn(
        'flex h-[4.0625rem] items-center rounded-[1.125rem] bg-white pr-[1.0625rem] pl-[0.5625rem] transition-opacity',
        dragging && 'opacity-50',
      )}
    >
      {editable ? (
        <button
          type="button"
          aria-label={`Reorder ${status.name}, position ${position + 1} of ${count}`}
          aria-describedby={handleHintId}
          onKeyDown={onHandleKey}
          className="inline-flex h-[1.875rem] w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-[#CECECE] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none active:cursor-grabbing"
        >
          <DragHandleIcon className="h-4 w-2.5" />
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-[1.875rem] w-7 shrink-0 items-center justify-center text-[#CECECE]"
        >
          <DragHandleIcon className="h-4 w-2.5" />
        </span>
      )}
      <Popover open={recoloring} onOpenChange={setRecoloring}>
        <PopoverPrimitive.Anchor asChild>
          <span className="ml-[1.1875rem] inline-flex">
            <StatusRing color={status.color} />
          </span>
        </PopoverPrimitive.Anchor>
        <PopoverContent
          align="start"
          className="w-auto rounded-2xl border-0 bg-white p-0 shadow-[0_0_7.8px_rgba(0,0,0,0.15)]"
        >
          <ColorPickerPanel
            title="Status Color"
            value={status.color}
            onPick={(color) => {
              onRecolor(color)
              setRecoloring(false)
            }}
            onClose={() => {
              setRecoloring(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <span className={cn(wz.statusName, 'ml-[0.6875rem]')}>{status.name}</span>
      {editable && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`${status.name} options`} className={wz.dotsButton}>
              <DotsIcon className="h-[0.33rem] w-[1.3125rem]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={wz.menu}
            onCloseAutoFocus={(event) => {
              // The colour picker takes the focus instead of the 3-dot button.
              if (openPicker.current) {
                event.preventDefault()
                openPicker.current = false
              }
            }}
          >
            <DropdownMenuItem className={wz.menuItem} onSelect={onRename}>
              <Pencil className="size-[1.125rem] text-[#844EFF]" strokeWidth={2} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className={wz.menuItem}
              onSelect={() => {
                openPicker.current = true
                setRecoloring(true)
              }}
            >
              <span
                aria-hidden="true"
                className="size-[1.125rem] rounded-full bg-[conic-gradient(#EC4899,#9751F2,#0EA5E9,#10B981,#84CC16,#E9540D,#EC4899)]"
              />
              Change Color
            </DropdownMenuItem>
            <DropdownMenuItem className={wz.menuItem} onSelect={onDelete}>
              <Trash2 className="size-[1.125rem] text-[#FF6640]" strokeWidth={2} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}

/** "Add Status Input Add Text Field": the ring, the name being typed and "Add Status". */
function StatusEditor({
  color,
  initialName,
  submitLabel,
  inputLabel,
  onColor,
  onSubmit,
  onCancel,
}: {
  color: string
  initialName: string
  submitLabel: string
  inputLabel: string
  onColor: (color: string) => void
  onSubmit: (name: string) => string | null
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const errorId = useId()

  const submit = () => {
    const problem = onSubmit(name)
    setError(problem)
  }

  return (
    <li>
      <div className="flex h-[4.0625rem] items-center gap-[0.6875rem] rounded-[1.125rem] border border-[#A975FD] bg-white pr-[0.5625rem] pl-[3.4375rem] shadow-[0_0_0_4px_rgba(132,78,255,0.2)]">
        <Popover open={picking} onOpenChange={setPicking}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Status color"
              className="inline-flex shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
            >
              <StatusRing color={color} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto rounded-2xl border-0 bg-white p-0 shadow-[0_0_7.8px_rgba(0,0,0,0.15)]"
          >
            <ColorPickerPanel
              title="Add Status Color"
              value={color}
              onPick={(next) => {
                onColor(next)
                setPicking(false)
              }}
              onClose={() => {
                setPicking(false)
              }}
            />
          </PopoverContent>
        </Popover>
        <input
          autoFocus
          value={name}
          maxLength={STATUS_NAME_MAX}
          data-escape-local
          aria-label={inputLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder="Add status"
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onCancel()
            }
          }}
          className={cn(
            wz.statusName,
            'min-w-0 bg-transparent outline-none placeholder:text-[#5D5D5D]',
          )}
        />
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-[2.9375rem] shrink-0 items-center justify-center rounded-[0.684rem] bg-[#7127EA] px-4 text-[0.9375rem] leading-[1.6875rem] font-medium tracking-[0.0153rem] text-white transition-colors hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2 focus-visible:outline-none sm:w-[8.3125rem] sm:text-[1.1405rem]"
        >
          {submitLabel}
        </button>
      </div>
      <FormError id={errorId} message={error ?? undefined} />
    </li>
  )
}
