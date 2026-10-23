import { useId, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { FLOW_AUTHORITY_LABELS } from '../../settings.constants'
import { FLOW_AUTHORITIES, type FlowAuthority } from '../../types/request-settings.types'

/**
 * Request Flow's "Authority": the chain a request goes through, in the
 * order picked, as removable chips ("Line Manager ×", "HOD ×"). General Flow
 * stands alone; picking it clears the rest, and the rest clear it.
 */
export function AuthorityPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: readonly FlowAuthority[]
  onChange: (value: FlowAuthority[]) => void
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)

  const toggle = (authority: FlowAuthority) => {
    if (value.includes(authority)) onChange(value.filter((item) => item !== authority))
    else if (authority === 'general-flow') onChange(['general-flow'])
    else onChange([...value.filter((item) => item !== 'general-flow'), authority])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex min-h-10 w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card py-1.5 pr-2 pl-3 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25 sm:pl-4">
        {value.map((authority) => (
          <span
            key={authority}
            className="inline-flex items-center gap-1 rounded-[3px] bg-[#D9D9D9] py-0.5 pr-1 pl-1.5 font-inter text-[0.625rem] text-[#585858] dark:bg-muted dark:text-heading"
          >
            {FLOW_AUTHORITY_LABELS[authority]}
            <button
              type="button"
              aria-label={`Remove ${FLOW_AUTHORITY_LABELS[authority]}`}
              onClick={() => {
                toggle(authority)
              }}
              className="rounded-sm outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </span>
        ))}
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className="flex h-7 min-w-24 flex-1 items-center justify-between gap-2 text-left font-inter text-sm text-field-value outline-none"
          >
            <span className={cn('truncate', value.length > 0 && 'sr-only')}>
              {value.length === 0
                ? 'Select Authority'
                : value.map((item) => FLOW_AUTHORITY_LABELS[item]).join(', ')}
            </span>
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-field-foreground/70" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-64 p-2">
        <div id={listId} role="listbox" aria-multiselectable="true" className="grid gap-0.5">
          {FLOW_AUTHORITIES.map((authority) => {
            const active = value.includes(authority)
            return (
              <button
                key={authority}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  toggle(authority)
                }}
                className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm text-field-foreground outline-none hover:bg-muted focus-visible:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[0.1875rem] border border-input',
                    active &&
                      'border-[#17263A] bg-[#17263A] text-white dark:border-primary dark:bg-primary',
                  )}
                >
                  {active && <Check className="size-3" strokeWidth={3} />}
                </span>
                {FLOW_AUTHORITY_LABELS[authority]}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
