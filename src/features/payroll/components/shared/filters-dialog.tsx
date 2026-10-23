import { useId, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { type FilterField, type FilterValues, presetKey } from '../../utils/filters'
import { btn, dialogFieldType, footerButton } from '../../utils/styles'
import { DateInput } from './date-input'
import { MonthPicker } from './month-picker'
import { SearchSelect } from './search-select'

/**
 * The Filters dialog of every Payroll list: the fields, then Save Preset
 * (remembers them for next time), Search (applies) and Reset (clears).
 * `rows` puts each label on the left as in most frames; `grid` is the
 * three-column layout of Pay Slips.
 */
export function FiltersDialog({
  fields,
  value,
  onApply,
  onClose,
  preset,
  layout = 'rows',
  mediumLabels = false,
}: {
  fields: readonly FilterField[]
  value: FilterValues
  onApply: (values: FilterValues) => void
  onClose: () => void
  preset: string
  layout?: 'rows' | 'grid'
  /** Inter Medium 16 labels, as the Salary Sheet and Pay Slips filters draw them (default Regular). */
  mediumLabels?: boolean
}) {
  const [draft, setDraft] = useState<FilterValues>(value)
  const baseId = useId()
  const set = (key: string, next: string | undefined) => {
    setDraft((current) => ({ ...current, [key]: next === '' ? undefined : next }))
  }

  const control = (field: FilterField, id: string) => {
    if (field.kind === 'select') {
      return (
        <SearchSelect
          id={id}
          value={draft[field.key] ?? null}
          onChange={(next) => {
            set(field.key, next ?? undefined)
          }}
          options={field.options}
          placeholder={field.placeholder}
          clearable
        />
      )
    }
    if (field.kind === 'text') {
      return (
        <Input
          id={id}
          value={draft[field.key] ?? ''}
          placeholder={field.placeholder}
          onChange={(event) => {
            set(field.key, event.target.value)
          }}
        />
      )
    }
    if (field.kind === 'range') {
      return (
        <div className="grid grid-cols-2 gap-3">
          <Input
            id={id}
            inputMode="decimal"
            aria-label={`${field.label} from`}
            placeholder="From"
            value={draft[field.from] ?? ''}
            onChange={(event) => {
              set(field.from, event.target.value)
            }}
          />
          <Input
            inputMode="decimal"
            aria-label={`${field.label} to`}
            placeholder="To"
            value={draft[field.to] ?? ''}
            onChange={(event) => {
              set(field.to, event.target.value)
            }}
          />
        </div>
      )
    }
    if (field.kind === 'month') {
      return (
        <MonthPicker
          id={id}
          value={draft[field.key] ?? ''}
          onChange={(next) => {
            set(field.key, next)
          }}
        />
      )
    }
    return (
      <DateInput
        id={id}
        value={draft[field.key] ?? ''}
        onChange={(next) => {
          set(field.key, next)
        }}
      />
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showClose={false} className={cn('max-w-3xl gap-0 p-0', dialogFieldType)}>
        <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8">
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription className="sr-only">Choose what the list shows.</DialogDescription>
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E50141] text-white outline-none hover:bg-[#E50141]/90 focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <X aria-hidden="true" className="size-4" strokeWidth={3} />
          </button>
        </div>
        <div
          className={cn(
            '@container min-h-0 overflow-y-auto px-6 py-5 sm:px-8',
            layout === 'grid' ? 'grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4',
          )}
        >
          {fields.map((field, index) => {
            const id = `${baseId}-${index}`
            return (
              <div
                key={field.key}
                className={cn(
                  layout === 'grid'
                    ? 'grid content-start gap-2'
                    : 'grid gap-2 @lg:grid-cols-[8rem_minmax(0,1fr)] @lg:items-center',
                )}
              >
                <label
                  htmlFor={id}
                  className={cn(
                    'font-inter text-sm text-heading @lg:text-base',
                    mediumLabels && 'font-medium',
                  )}
                >
                  {field.label}
                </label>
                {control(field, id)}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap justify-end gap-3 px-6 pb-6 sm:px-8">
          <Button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(presetKey(preset), JSON.stringify(draft))
                toast.success('Preset saved')
              } catch {
                toast.error('The preset could not be saved in this browser.')
              }
            }}
            className={cn(footerButton, btn.green)}
          >
            Save Preset
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
            className={cn(footerButton, btn.orange)}
          >
            Search
          </Button>
          <Button
            type="button"
            onClick={() => {
              setDraft({})
              onApply({})
              try {
                localStorage.removeItem(presetKey(preset))
              } catch {
                // Nothing saved.
              }
            }}
            className={cn(footerButton, btn.blue)}
          >
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
