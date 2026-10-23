import { useId } from 'react'

import { cn } from '@/lib/utils'

import { CloseButton } from './wizard-controls'
import { STATUS_SWATCHES } from './wizard-state'

/**
 * The "Add Status Color" picker (1087:486644): 283 x 124, two rows of 24px swatches and a
 * "Custom" (conic) swatch that opens the system colour picker.
 */
export function ColorPickerPanel({
  title,
  value,
  onPick,
  onClose,
}: {
  title: string
  value: string | null
  onPick: (color: string) => void
  onClose: () => void
}) {
  const customId = useId()
  const swatch = (color: string) => (
    <button
      key={color}
      type="button"
      aria-label={`Colour ${color}`}
      aria-pressed={value?.toUpperCase() === color}
      onClick={() => {
        onPick(color)
      }}
      className={cn(
        'size-6 shrink-0 rounded-full transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2',
        value?.toUpperCase() === color && 'ring-2 ring-[#7127EA] ring-offset-2',
      )}
      style={{ backgroundColor: color }}
    />
  )
  const [first = [], second = []] = STATUS_SWATCHES

  return (
    <div role="group" aria-label={title} className="w-[17.6875rem] px-3 pt-2.5 pb-2">
      <div className="flex items-center justify-between pl-[0.3125rem]">
        <span className="text-[0.75rem] leading-[1.0625rem] font-medium tracking-[0.0137rem] text-[#666666]">
          {title}
        </span>
        <CloseButton small label="Close colours" onClick={onClose} />
      </div>
      <div className="mt-2 flex gap-[0.6875rem]">{first.map(swatch)}</div>
      <div className="mt-[0.6875rem] flex items-start gap-[0.6875rem]">
        {second.map(swatch)}
        <label
          htmlFor={customId}
          className="flex cursor-pointer flex-col items-center gap-0.5 focus-within:outline-none [&:has(:focus-visible)>span:first-child]:ring-2 [&:has(:focus-visible)>span:first-child]:ring-[#A181FF]"
        >
          <span
            aria-hidden="true"
            className="size-6 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,#708307_0deg,#5BEFFF_72deg,#FFBFF7_134deg,#B2057E_217.8deg,#2898C8_286.2deg,#5BF901_344.27deg,#708307_360deg)]"
          />
          <span className="text-[0.5625rem] leading-[0.75rem] font-medium text-[#666666]">
            Custom
          </span>
          <input
            id={customId}
            type="color"
            aria-label="Custom colour"
            value={value ?? '#979797'}
            onChange={(event) => {
              onPick(event.target.value.toUpperCase())
            }}
            className="sr-only"
          />
        </label>
      </div>
    </div>
  )
}
