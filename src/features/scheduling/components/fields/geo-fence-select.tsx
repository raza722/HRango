import { useState } from 'react'
import {
  type Control,
  type FieldPathByValue,
  type FieldValues,
  useController,
} from 'react-hook-form'
import { ChevronDown, Plus, RefreshCw, Search, X } from 'lucide-react'

import { FormField } from '@/components/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { useGeoFences } from '../../hooks/use-scheduling'
import { GeoFenceDialog } from '../dialogs/geo-fence-dialog'
import { schedulingType } from '../type-styles'

interface GeoFenceSelectProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string[]>,
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  disabled?: boolean
}

/**
 * "Apply Geo Fence": the chosen fences as chips; the list opens with a
 * refresh button, a "+" that draws a new fence, a search box and checkboxes.
 */
export function GeoFenceSelect<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string[]>,
>({
  control,
  name,
  label = 'Apply Geo Fence',
  disabled = false,
}: GeoFenceSelectProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name })
  const fences = useGeoFences()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const raw: unknown = field.value
  const value: string[] = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === 'string')
    : []
  const all = fences.data ?? []
  const shown = all.filter((fence) =>
    fence.name.toLowerCase().includes(search.trim().toLowerCase()),
  )
  const nameOf = (id: string) => all.find((fence) => fence.id === id)?.name ?? id

  const set = (next: string[]) => {
    field.onChange(next)
  }

  return (
    <FormField label={label} error={fieldState.error?.message}>
      {(a11y) => (
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                {...a11y}
                ref={field.ref}
                disabled={disabled}
                aria-haspopup="listbox"
                className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-left text-sm text-field-value shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-50 pointer-coarse:min-h-11"
              >
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {value.length === 0 ? (
                    <span>Select Geo Fence</span>
                  ) : (
                    value.map((id) => (
                      <span
                        key={id}
                        // Figma: Inter Regular 10 #585858, raised to the 11px floor.
                        className={cn(
                          'inline-flex max-w-full items-center gap-1 rounded-sm bg-chip px-1.5 py-0.5 text-[0.6875rem] dark:bg-input',
                          schedulingType.grey,
                        )}
                      >
                        <span className="truncate">{nameOf(id)}</span>
                      </span>
                    ))
                  )}
                </span>
                {value.length > 0 && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Clear geo fences"
                    onClick={(event) => {
                      event.stopPropagation()
                      set([])
                    }}
                    className="rounded-sm p-0.5 text-label hover:text-field-foreground"
                  >
                    <X className="size-4" />
                  </span>
                )}
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-label" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(32rem,calc(100vw-2rem))] p-3 font-inter"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Refresh geo fences"
                  onClick={() => {
                    void fences.refetch()
                  }}
                  className="flex h-8 w-12 items-center justify-center rounded-sm bg-success text-white outline-none hover:bg-success/90 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <RefreshCw className={cn('size-4', fences.isFetching && 'animate-spin')} />
                </button>
                <button
                  type="button"
                  aria-label="Create a geo fence"
                  onClick={() => {
                    setOpen(false)
                    setCreating(true)
                  }}
                  className="flex h-8 w-12 items-center justify-center rounded-sm bg-success text-white outline-none hover:bg-success/90 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Plus className="size-4" strokeWidth={3} />
                </button>
                <div className="relative min-w-0 flex-1">
                  <input
                    aria-label="Search geo fences"
                    value={search}
                    autoFocus
                    onChange={(event) => {
                      setSearch(event.target.value)
                    }}
                    className="h-8 w-full rounded-sm border border-primary/60 bg-card pr-8 pl-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                  <Search
                    aria-hidden="true"
                    className="absolute top-1/2 right-2 size-4 -translate-y-1/2 text-label"
                  />
                </div>
              </div>
              <ul
                role="listbox"
                aria-multiselectable="true"
                aria-label="Geo fences"
                className="mt-2 scrollbar-thin max-h-56 overflow-y-auto"
              >
                {shown.map((fence) => {
                  const checked = value.includes(fence.id)
                  return (
                    <li key={fence.id} role="option" aria-selected={checked}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-sm text-title hover:bg-muted">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            set(
                              next === true
                                ? [...value, fence.id]
                                : value.filter((id) => id !== fence.id),
                            )
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{fence.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {fence.shape.type === 'circle'
                            ? `${fence.shape.radiusMeters} m circle`
                            : 'Polygon'}
                        </span>
                      </label>
                    </li>
                  )
                })}
                {shown.length === 0 && (
                  <li className="px-2 py-4 text-center text-sm text-muted-foreground">
                    {fences.isPending ? 'Loading…' : 'No geo fences match. Use + to draw one.'}
                  </li>
                )}
              </ul>
            </PopoverContent>
          </Popover>
          {creating && (
            <GeoFenceDialog
              onClose={() => {
                setCreating(false)
              }}
              onCreated={(fence) => {
                set([...value, fence.id])
              }}
            />
          )}
        </>
      )}
    </FormField>
  )
}
