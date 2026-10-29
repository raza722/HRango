import { type ReactNode, useState } from 'react'

import { ChevronDownIcon, ChevronUpIcon } from './field-icons'
import { FieldPopover } from './field-popup'
import { fieldStyles } from './field-styles'
import { type Clock12, fromClock12, nextFullHour, toClock12 } from './field-utils'

interface AddTimePopoverProps {
  /** `HH:mm`, or null when no time is set. */
  value: string | null
  onSave: (time: string) => void
  /** The row that opens it ("Add Time"). */
  trigger: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** "Add Time Popup" (1:15113): Hour, Minute and AM / PM steppers, Cancel and Save. */
export function AddTimePopover({
  value,
  onSave,
  trigger,
  open,
  onOpenChange,
}: AddTimePopoverProps) {
  return (
    <FieldPopover
      open={open}
      onOpenChange={onOpenChange}
      label="Add Time"
      trigger={trigger}
      className="w-[min(23.5rem,calc(100vw-1rem))] px-3 py-3.5"
    >
      {/* Mounted per opening, so it starts from the saved value. */}
      <AddTimeForm
        initial={toClock12(value ?? nextFullHour())}
        onCancel={() => {
          onOpenChange(false)
        }}
        onSave={(clock) => {
          onSave(fromClock12(clock))
          onOpenChange(false)
        }}
      />
    </FieldPopover>
  )
}

const labelChip =
  'flex h-[1.9rem] w-[3.9rem] items-center justify-center rounded-md bg-[#DFD7FF] dark:bg-[#7127EA]/25 text-[0.8125rem] font-semibold tracking-[0.01em] text-[#4A4A4A] dark:text-title'

function AddTimeForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: Clock12
  onCancel: () => void
  onSave: (clock: Clock12) => void
}) {
  const [clock, setClock] = useState(initial)
  const wrap = (value: number, min: number, max: number) =>
    value > max ? min : value < min ? max : value

  return (
    <div className="flex flex-col gap-4">
      <h3 className={fieldStyles.popupTitle}>Add Time</h3>
      <div className="rounded-[0.8125rem] bg-[#EEE7FF] px-3 py-3 dark:bg-[#7127EA]/10">
        <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-x-2.5 gap-y-2.5">
          <span className={labelChip}>Hour</span>
          <span />
          <span className={labelChip}>Minute</span>
          <span />
          <Stepper
            label="Hour"
            display={String(clock.hour).padStart(2, '0')}
            onStep={(step) => {
              setClock((current) => ({ ...current, hour: wrap(current.hour + step, 1, 12) }))
            }}
            onType={(typed) => {
              const hour = Number(typed)
              if (hour >= 1 && hour <= 12) setClock((current) => ({ ...current, hour }))
            }}
          />
          <span className="flex size-[1.75rem] items-center justify-center rounded-md bg-white text-[1.05rem] font-bold text-[#626262] shadow-[0_0_7px_rgba(0,0,0,0.1)] dark:bg-card dark:text-title">
            :
          </span>
          <Stepper
            label="Minute"
            display={String(clock.minute).padStart(2, '0')}
            onStep={(step) => {
              setClock((current) => ({ ...current, minute: wrap(current.minute + step, 0, 59) }))
            }}
            onType={(typed) => {
              const minute = Number(typed)
              if (minute >= 0 && minute <= 59) setClock((current) => ({ ...current, minute }))
            }}
          />
          <Stepper
            label="AM or PM"
            display={clock.meridiem}
            onStep={() => {
              setClock((current) => ({
                ...current,
                meridiem: current.meridiem === 'AM' ? 'PM' : 'AM',
              }))
            }}
          />
        </div>
      </div>
      <div className="flex gap-9">
        <button type="button" onClick={onCancel} className={fieldStyles.cancel}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onSave(clock)
          }}
          className={fieldStyles.save}
        >
          Save
        </button>
      </div>
    </div>
  )
}

interface StepperProps {
  label: string
  display: string
  onStep: (step: 1 | -1) => void
  /** Typed digits; omitted for AM / PM. */
  onType?: (value: string) => void
}

/** A white box with the value on #F6F4FF and purple up / down arrows. */
function Stepper({ label, display, onStep, onType }: StepperProps) {
  const [typing, setTyping] = useState<string | null>(null)
  return (
    <div className="flex h-[2.4rem] items-center justify-between gap-1 rounded-md bg-white pr-1.5 pl-1.5 shadow-[0_0_7px_rgba(0,0,0,0.1)] dark:bg-card">
      <input
        aria-label={label}
        value={typing ?? display}
        readOnly={!onType}
        inputMode="numeric"
        maxLength={2}
        onFocus={(event) => {
          event.target.select()
        }}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '')
          setTyping(digits)
          if (digits) onType?.(digits)
        }}
        onBlur={() => {
          setTyping(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            setTyping(null)
            onStep(event.key === 'ArrowUp' ? 1 : -1)
          }
        }}
        className="h-[1.6rem] w-9 rounded-[0.125rem] bg-[#F6F4FF] text-center text-[1.05rem] font-medium text-[#626262] outline-none focus:ring-1 focus:ring-[#A181FF] dark:bg-[#7127EA]/10 dark:text-title"
      />
      <span className="flex flex-col gap-1">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => {
            onStep(1)
          }}
          className="flex h-2.5 w-3 items-center justify-center text-[#7127EA] dark:text-[#C4ABFF]"
        >
          <ChevronUpIcon className="h-[0.33rem] w-[0.6rem]" />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => {
            onStep(-1)
          }}
          className="flex h-2.5 w-3 items-center justify-center text-[#7127EA] dark:text-[#C4ABFF]"
        >
          <ChevronDownIcon className="h-[0.33rem] w-[0.6rem]" />
        </button>
      </span>
    </div>
  )
}
