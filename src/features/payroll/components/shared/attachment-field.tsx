import { useId, useRef } from 'react'
import { Paperclip } from 'lucide-react'

import { FormField } from '@/components/form'

/**
 * "Attachment" as drawn: a grey box with the grey "Attach" button on its
 * right. Only the file's name is kept (the mock has no file store).
 */
export function AttachmentField({
  value,
  onChange,
  disabled = false,
  label = 'Attachment',
}: {
  value: string | null
  onChange: (name: string | null) => void
  disabled?: boolean
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  return (
    <FormField label={label}>
      {(a11y) => (
        <div className="flex h-10 overflow-hidden rounded-md bg-[#D9D9D9]/70 dark:bg-muted">
          <span
            id={a11y.id}
            className="flex min-w-0 flex-1 items-center truncate px-4 font-inter text-sm text-field-value"
          >
            {value ?? ''}
          </span>
          {value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange(null)
              }}
              className="px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            aria-label={value ? `Attach another file (now ${value})` : 'Attach a file'}
            onClick={() => input.current?.click()}
            className="flex shrink-0 items-center gap-2 bg-[#707070] px-4 font-inter text-sm font-normal text-white outline-none hover:bg-[#5c5c5c] focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
          >
            <Paperclip aria-hidden="true" className="size-4" />
            Attach
          </button>
          <input
            ref={input}
            id={inputId}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onChange(file.name)
              event.target.value = ''
            }}
          />
        </div>
      )}
    </FormField>
  )
}
