import { useId, useRef, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'

import { FormField } from '@/components/form'
import { ApiError } from '@/lib/api-error'
import { ACCEPTED_FILE_TYPES, type FileRef, uploadFile, type UploadModule } from '@/lib/files'

/**
 * The designs' "Attachment" box (name on grey, dark "Attach" button), uploading for real:
 * choosing a file sends it to `POST /files` straight away and keeps the returned
 * `{id, name, url}`; the form then saves the id. A saved file shows as a signed link.
 */
export function UploadField({
  value,
  onChange,
  module,
  disabled = false,
  label = 'Attachment',
  error,
}: {
  value: FileRef | null
  onChange: (file: FileRef | null) => void
  module: UploadModule
  disabled?: boolean
  label?: string
  error?: string | undefined
}) {
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [progress, setProgress] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const uploading = progress !== null
  const name = value ? (value.name ?? 'Attachment') : ''

  const choose = async (file: File) => {
    setFailure(null)
    setProgress(0)
    try {
      const uploaded = await uploadFile(file, module, setProgress)
      onChange({ id: uploaded.id, name: uploaded.name, url: uploaded.url })
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : 'The file could not be uploaded.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <FormField label={label} error={failure ?? error}>
      {(a11y) => (
        <div className="flex h-10 overflow-hidden rounded-md bg-[#D9D9D9]/70 dark:bg-muted">
          <span
            id={a11y.id}
            className="flex min-w-0 flex-1 items-center truncate px-4 font-inter text-sm text-field-value"
          >
            {uploading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Uploading {progress}%
              </span>
            ) : value?.url ? (
              <a
                href={value.url}
                target="_blank"
                rel="noreferrer"
                className="truncate underline-offset-2 hover:underline"
              >
                {name}
              </a>
            ) : (
              name
            )}
          </span>
          {value && !disabled && !uploading && (
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
          {!disabled && (
            <button
              type="button"
              disabled={uploading}
              aria-label={value ? `Attach another file (now ${name})` : 'Attach a file'}
              aria-describedby={a11y['aria-describedby']}
              onClick={() => input.current?.click()}
              className="flex shrink-0 items-center gap-2 bg-[#707070] px-4 font-inter text-sm font-normal text-white outline-none hover:bg-[#5c5c5c] focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
            >
              <Paperclip aria-hidden="true" className="size-4" />
              Attach
            </button>
          )}
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void choose(file)
            }}
          />
        </div>
      )}
    </FormField>
  )
}

/** A saved attachment in a list or read-only view: the name as a signed link. */
export function FileLink({ file }: { file: FileRef | null }) {
  if (!file) return <>—</>
  return (
    <a href={file.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {file.name ?? 'Attachment'}
    </a>
  )
}
