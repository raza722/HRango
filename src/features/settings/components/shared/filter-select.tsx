import type { SelectOption } from '@/components/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL = '__all__'

interface FilterSelectProps {
  /** Accessible name, e.g. "Filter by company". */
  label: string
  /** First item, e.g. "All companies". */
  allLabel: string
  options: readonly SelectOption[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}

/** A list filter: "All …" or one option. */
export function FilterSelect({ label, allLabel, options, value, onChange }: FilterSelectProps) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(picked) => {
        onChange(picked === ALL ? undefined : picked)
      }}
    >
      <SelectTrigger aria-label={label} className="w-full @lg:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
