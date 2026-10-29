import { useRef, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'

import { ACCEPTED_FILE_TYPES, type FileRef, uploadFile } from '@/lib/files'

/**
 * A file question: the file goes to `POST /files` as soon as it is chosen (as the Payroll and
 * Talent Management upload fields do), showing how much has gone; the answer keeps
 * `{id, name, url}` and sends the id. The API has no "forms" upload module yet, so uploads go
 * under `core`.
 */
export function FileAnswer({
  id,
  value,
  onChange,
  disabled = false,
  disabledNote,
  describedBy,
  invalid,
  label,
}: {
  id: string
  value: FileRef | null
  onChange: (file: FileRef | null) => void
  disabled?: boolean
  /** Why the control is off (the builder's preview). */
  disabledNote?: string
  describedBy: string | undefined
  invalid: boolean
  /** The question, for the buttons' names. */
  label: string
}) {
  const input = useRef<HTMLInputElement>(null)
  // 0-100 while a file is going up; null otherwise.
  const [progress, setProgress] = useState<number | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const busy = progress !== null
  return (
    <div className="grid gap-1.5">
      <div
        className="flex min-h-10 flex-wrap items-center gap-3 rounded-lg border border-[#CFCFCF] px-1.5 py-1 aria-invalid:border-destructive dark:border-input"
        aria-invalid={invalid || undefined}
      >
        <button
          id={id}
          type="button"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-label={value ? `Replace the file for ${label}` : `Attach a file for ${label}`}
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
          className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-[#CFCFCF] bg-muted/60 px-3 text-xs text-title outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 dark:border-input dark:text-heading"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Paperclip aria-hidden="true" className="size-3.5" />
          )}
          {value ? 'Replace file' : 'Choose file'}
        </button>
        <span className="min-w-0 flex-1 truncate text-xs text-[#989799] dark:text-muted-foreground">
          {busy ? (
            `Uploading ${String(progress)}%`
          ) : value ? (
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="text-[#263871] underline-offset-2 hover:underline dark:text-sky-300"
            >
              {value.name ?? 'Attached file'}
            </a>
          ) : (
            (disabledNote ?? 'No file chosen')
          )}
        </span>
        {value && !busy && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
            }}
            className="rounded-sm px-2 text-xs text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Remove
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          tabIndex={-1}
          aria-label={`File for ${label}`}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            setProgress(0)
            setFailed(null)
            uploadFile(file, 'core', setProgress)
              .then((uploaded) => {
                onChange({ id: uploaded.id, name: uploaded.name, url: uploaded.url })
              })
              .catch((reason: unknown) => {
                setFailed(
                  reason instanceof Error ? reason.message : 'The file could not be uploaded.',
                )
              })
              .finally(() => {
                setProgress(null)
              })
          }}
        />
      </div>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {failed}
        </p>
      )}
    </div>
  )
}
