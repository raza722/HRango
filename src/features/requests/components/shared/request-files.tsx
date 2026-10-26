import { useId, useRef, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'

import { FormField } from '@/components/form'
import { ApiError } from '@/lib/api-error'
import { ACCEPTED_FILE_TYPES, type FileRef, uploadFile } from '@/lib/files'

import type { RequestAttachment } from '../../types/requests.types'

/*
 * Request files are uploads (`POST /files`, module `requests`): a form uploads
 * the file when it is picked and sends its id (`attachments: [fileId]`, or a
 * `fileId` inside the details). Records hand back the name and a signed link.
 */

/**
 * "Attachment" as drawn: a grey box with the grey "Attach" button on its right.
 * Picking a file uploads it at once; the field keeps the uploaded file.
 */
export function RequestFileField({
  value,
  onChange,
  disabled = false,
  label = 'Attachment',
  error,
  required = false,
  description,
}: {
  value: FileRef | null
  onChange: (file: FileRef | null) => void
  disabled?: boolean
  label?: string
  error?: string | undefined
  /** Marks the label (e.g. the leave type asks for a document). */
  required?: boolean
  /** A hint under the field. */
  description?: string | undefined
}) {
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const pick = async (file: File) => {
    setUploading(true)
    setFailure(null)
    try {
      const uploaded = await uploadFile(file, 'requests')
      onChange({ id: uploaded.id, name: uploaded.name, url: uploaded.url })
    } catch (problem) {
      setFailure(problem instanceof ApiError ? problem.message : 'The file could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <FormField label={label} required={required} description={description} error={failure ?? error}>
      {(a11y) => (
        <div className="flex h-10 overflow-hidden rounded-md bg-[#D9D9D9]/70 dark:bg-muted">
          <span
            id={a11y.id}
            className="flex min-w-0 flex-1 items-center truncate px-4 font-inter text-sm text-field-value"
          >
            {uploading ? (
              'Uploading…'
            ) : value?.url ? (
              <a
                href={value.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-primary underline-offset-2 hover:underline"
              >
                {value.name ?? 'File'}
              </a>
            ) : (
              (value?.name ?? '')
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
          <button
            type="button"
            disabled={disabled || uploading}
            aria-label={
              value ? `Attach another file (now ${value.name ?? 'a file'})` : 'Attach a file'
            }
            onClick={() => input.current?.click()}
            className="flex shrink-0 items-center gap-2 bg-[#707070] px-4 font-inter text-sm font-normal text-white outline-none hover:bg-[#5c5c5c] focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
          >
            {uploading ? (
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
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pick(file)
              event.target.value = ''
            }}
          />
        </div>
      )}
    </FormField>
  )
}

/** The request's files as links (View and Approve popups). */
export function RequestFileLinks({ files }: { files: readonly RequestAttachment[] }) {
  if (files.length === 0) return <span>—</span>
  return (
    <ul className="grid gap-1">
      {files.map((file) => (
        <li key={file.id} className="flex min-w-0 items-center gap-2">
          <Paperclip aria-hidden="true" className="size-3.5 shrink-0" />
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-primary underline-offset-2 hover:underline"
          >
            {file.label ? `${file.label}: ${file.name}` : file.name}
          </a>
        </li>
      ))}
    </ul>
  )
}
