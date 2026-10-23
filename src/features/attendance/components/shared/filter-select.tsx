import { useId } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

const ALL = '__all__'

/**
 * A filter dropdown. With `allLabel` it has an "All …" first option that
 * means no filter (`undefined`). `showLabel` puts the label above, as on the
 * All Time Sheet; otherwise the label is the placeholder, as on the overview.
 */
export function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
  showLabel = false,
  tone = 'poppins',
  className,
}: {
  label: string
  allLabel?: string
  options: readonly FilterOption[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  showLabel?: boolean
  /** `inter`: the older Inter frames (overview, time sheet), values Inter Regular 14 #475569. */
  tone?: 'poppins' | 'inter'
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('grid min-w-0 gap-1.5', tone === 'inter' && 'font-inter', className)}>
      {showLabel && (
        <label htmlFor={id} className="text-sm font-medium text-heading">
          {label}
        </label>
      )}
      <Select
        value={value ?? (allLabel ? ALL : '')}
        onValueChange={(picked) => {
          onChange(picked === ALL ? undefined : picked)
        }}
      >
        <SelectTrigger
          id={id}
          aria-label={showLabel ? undefined : label}
          className={cn(
            'w-full',
            tone === 'inter' && 'text-field-value data-[placeholder]:text-field-value',
          )}
        >
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
