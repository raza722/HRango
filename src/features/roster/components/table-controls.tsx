import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'
import type { PaginationMeta } from '@/types/api'

interface EntriesSelectProps {
  value: number
  onChange: (pageSize: number) => void
  /** Accessible name of the select. */
  label: string
}

/** "Show [10] entries", as drawn above the Roster tables (Inter Regular 16 #000). */
export function EntriesSelect({ value, onChange, label }: EntriesSelectProps) {
  return (
    <div className="flex items-center gap-2.5 font-inter text-base text-heading">
      <span aria-hidden="true">Show</span>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          onChange(Number(next))
        }}
      >
        <SelectTrigger aria-label={label} className="h-9 w-20 px-3 text-heading sm:text-base">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span aria-hidden="true">entries</span>
    </div>
  )
}

/** "Showing 1 to 10 of 22 entries". */
export function PageSummary({
  meta,
  rowCount,
}: {
  meta: PaginationMeta | undefined
  rowCount: number
}) {
  const total = meta?.total ?? 0
  const first = total === 0 || !meta ? 0 : (meta.page - 1) * meta.pageSize + 1
  const last = total === 0 ? 0 : Math.min(first + rowCount - 1, total)
  return (
    <p aria-live="polite" className="text-sm text-muted-foreground">
      {total === 0 ? 'No entries' : `Showing ${first} to ${last} of ${total} entries`}
    </p>
  )
}
