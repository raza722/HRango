import { useId } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/** A labelled picker in the hero (workspace, project): a Radix select, keyboard operable. */
export function ScopePicker({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="grid w-full min-w-0 gap-1 sm:w-64">
      <label htmlFor={id} className="text-xs font-medium text-grey">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled ?? options.length === 0}>
        <SelectTrigger
          id={id}
          className="h-10 rounded-[0.75rem] border-[#E4DAFB] bg-card text-sm font-medium text-title focus-visible:border-[#7127EA] focus-visible:ring-[#7127EA]/20 dark:border-border"
        >
          <SelectValue placeholder={`Choose a ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
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
