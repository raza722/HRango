import { useId, useRef, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'

import { FormField } from '@/components/form'
import { ACCEPTED_FILE_TYPES, type FileRef, uploadFile } from '@/lib/files'

/**
 * "Attachment" as drawn, with a real upload: the file goes to `POST /files` (module
 * `payroll`) as soon as it is chosen, and the form keeps `{id, name, url}` to send `fileId`.
 * A saved file shows as a link (signed, it expires; reopen the record for a fresh one).
 */
export function UploadField({
  value,
  onChange,
  disabled = false,
  label = 'Attachment',
  accept = ACCEPTED_FILE_TYPES,
  error,
}: {
  value: FileRef | null
  onChange: (file: FileRef | null) => void
  disabled?: boolean
  label?: string
  accept?: string
  error?: string | undefined
}) {
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const message = failed ?? error
  return (
    <FormField label={label} {...(message ? { error: message } : {})}>
      {(a11y) => (
        <div className="flex h-10 overflow-hidden rounded-md bg-[#D9D9D9]/70 dark:bg-muted">
          <span
            id={a11y.id}
            className="flex min-w-0 flex-1 items-center truncate px-4 font-inter text-sm text-field-value"
          >
            {busy ? (
              'Uploading…'
            ) : value ? (
              <a
                href={value.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-primary underline-offset-2 hover:underline"
              >
                {value.name ?? 'Attachment'}
              </a>
            ) : (
              ''
            )}
          </span>
          {value && !disabled && !busy && (
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
            disabled={disabled || busy}
            aria-label={
              value ? `Attach another file (now ${value.name ?? 'a file'})` : 'Attach a file'
            }
            onClick={() => input.current?.click()}
            className="flex shrink-0 items-center gap-2 bg-[#707070] px-4 font-inter text-sm font-normal text-white outline-none hover:bg-[#5c5c5c] focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Paperclip aria-hidden="true" className="size-4" />
            )}
            Attach
          </button>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={accept}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBusy(true)
              setFailed(null)
              uploadFile(file, 'payroll')
                .then((uploaded) => {
                  onChange({ id: uploaded.id, name: uploaded.name, url: uploaded.url })
                })
                .catch((reason: unknown) => {
                  setFailed(
                    reason instanceof Error ? reason.message : 'The file could not be uploaded.',
                  )
                })
                .finally(() => {
                  setBusy(false)
                })
            }}
          />
        </div>
      )}
    </FormField>
  )
}
