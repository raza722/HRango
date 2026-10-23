import { useId, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { usePmLookups } from '../../hooks/use-pm'
import type { Attachment, AttachmentSource, TaskRow } from '../../types/pm.types'
import {
  AttachIcon,
  CloudSourceIcon,
  DocFileIcon,
  GenericFileIcon,
  ImageFileIcon,
  PdfFileIcon,
  SheetFileIcon,
} from './field-icons'
import { FieldPopover, PopupHeader } from './field-popup'
import { fieldStyles } from './field-styles'
import {
  type FileKind,
  fileKind,
  formatFileSize,
  MAX_FILE_BYTES,
  newAttachmentId,
} from './field-utils'
import { RemoveButton } from './remove-button'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

const KINDS: Record<FileKind, { label: string; color: string; Icon: typeof PdfFileIcon }> = {
  pdf: { label: 'PDF', color: '#E5383B', Icon: PdfFileIcon },
  xls: { label: 'XLS', color: '#1D8F4E', Icon: SheetFileIcon },
  jpg: { label: 'JPG', color: '#F79009', Icon: ImageFileIcon },
  doc: { label: 'DOC', color: '#2E64E2', Icon: DocFileIcon },
  file: { label: 'FILE', color: '#87909E', Icon: GenericFileIcon },
}

/** The sources of "Attach File Dropdown", in its order; none can be connected in this app. */
const THIRD_PARTY: { source: AttachmentSource; label: string }[] = [
  { source: 'dropbox', label: 'Dropbox' },
  { source: 'onedrive', label: 'OneDrive' },
  { source: 'box', label: 'Box' },
  { source: 'google-drive', label: 'Google Drive' },
]

/** A file's type icon on the white circle of the file chips. */
function FileBadge({ name, className }: { name: string; className?: string }) {
  const kind = KINDS[fileKind(name)]
  return (
    <span
      className={cn(
        'flex size-[1.4rem] shrink-0 items-center justify-center rounded-full bg-white',
        className,
      )}
      style={{ color: kind.color }}
      title={kind.label}
    >
      <kind.Icon className="size-3.5" />
    </span>
  )
}

/** Files column: the first file as a chip ("Business Requirem..."), or "Attach files". */
export function FilesCell({ task }: TaskCellProps) {
  const [open, setOpen] = useState(false)
  const files = task.attachments
  const first = files[0]

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Attach Files"
      align="end"
      className="w-[min(22rem,calc(100vw-1rem))] p-[0.9rem]"
      trigger={
        <button
          type="button"
          aria-label={
            files.length > 0
              ? `Files: ${files.map((file) => file.name).join(', ')}`
              : `Attach files to ${task.name}`
          }
          className={cn(fieldStyles.cell, 'pr-1.5')}
        >
          {first ? (
            <span className="flex h-[1.8rem] min-w-0 flex-1 items-center gap-2 rounded-[0.25rem] bg-[#F6F2FF] pr-2 pl-1">
              <FileBadge name={first.name} />
              <span className="min-w-0 truncate">{first.name}</span>
              {files.length > 1 && (
                <span className="shrink-0 text-[0.6875rem] font-semibold text-[#7127EA]">
                  +{files.length - 1}
                </span>
              )}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate pl-1.5">Attach files</span>
          )}
          <span className={fieldStyles.cellIcon}>
            <AttachIcon />
          </span>
        </button>
      }
    >
      <FilesPanel
        task={task}
        onClose={() => {
          setOpen(false)
        }}
      />
    </FieldPopover>
  )
}

interface Upload {
  key: string
  name: string
  percent: number
  error: string | null
}

/** Reads a file in the browser, reporting progress (the mock keeps only its details). */
function readFile(file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    reader.onload = () => {
      onProgress(100)
      resolve()
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('The file could not be read'))
    }
    reader.readAsArrayBuffer(file)
  })
}

/** "Attach File Dropdown": Upload File From This Device, the other sources, the files. */
function FilesPanel({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const { data: lookups } = usePmLookups()
  const { save } = useTaskSave()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const noteId = useId()

  const update = (key: string, patch: Partial<Upload>) => {
    setUploads((current) =>
      current.map((upload) => (upload.key === key ? { ...upload, ...patch } : upload)),
    )
  }

  const upload = async (list: FileList | null) => {
    const files = [...(list ?? [])]
    if (files.length === 0) return
    const started = files.map((file, index) => ({
      key: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      percent: 0,
      error: file.size > MAX_FILE_BYTES ? 'Files must be 25 MB or smaller' : null,
    }))
    setUploads((current) => [...current, ...started])
    const added: Attachment[] = []
    await Promise.all(
      files.map(async (file, index) => {
        const entry = started[index]
        if (!entry || entry.error) return
        try {
          await readFile(file, (percent) => {
            update(entry.key, { percent })
          })
          added.push({
            id: newAttachmentId(),
            name: file.name,
            size: file.size,
            source: 'device',
            uploadedById: lookups?.me.id ?? '',
            uploadedAt: new Date().toISOString(),
          })
        } catch {
          update(entry.key, { error: 'The file could not be read' })
        }
      }),
    )
    if (added.length === 0) return
    if (await save(task.id, { attachments: [...task.attachments, ...added] })) {
      const done = new Set(started.filter((entry) => !entry.error).map((entry) => entry.key))
      setUploads((current) => current.filter((entry) => !done.has(entry.key)))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <PopupHeader title="Attach Files" onClose={onClose} />
      <input
        ref={inputRef}
        type="file"
        multiple
        aria-label="Upload File From This Device"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void upload(event.target.files)
          event.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 rounded-[0.5625rem] border border-dashed border-[#7127EA] bg-[#EEE7FF] px-[1.2rem] py-[1.6rem] text-center text-[0.8125rem] font-medium text-[#626262] transition-colors hover:bg-[#E4DAFF]"
      >
        <AttachIcon className="size-[0.9rem] text-[#7127EA]" />
        Upload File From This Device
      </button>

      {uploads.length > 0 && (
        <ul aria-label="Uploads" className="flex flex-col gap-1.5">
          {uploads.map((entry) => (
            <li
              key={entry.key}
              className="rounded-[0.5625rem] bg-[rgba(221,221,221,0.2)] px-2.5 py-2 text-xs"
            >
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium text-[#626262]">{entry.name}</span>
                <span className={entry.error ? 'text-[#DC3545]' : 'font-semibold text-[#7127EA]'}>
                  {entry.error ?? `${entry.percent}%`}
                </span>
              </div>
              {!entry.error && (
                <div
                  role="progressbar"
                  aria-label={`Uploading ${entry.name}`}
                  aria-valuenow={entry.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#E7E7E7]"
                >
                  <div
                    className="h-full rounded-full bg-[#7127EA] transition-[width]"
                    style={{ width: `${entry.percent}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ul aria-describedby={noteId} className="flex flex-col gap-2">
        {THIRD_PARTY.map((entry) => (
          <li key={entry.source}>
            <button
              type="button"
              disabled
              className="flex h-[2.6rem] w-full cursor-not-allowed items-center gap-2.5 rounded-[0.5625rem] bg-[rgba(221,221,221,0.2)] px-1.5 text-left text-[0.8125rem] font-medium text-[#626262] opacity-60"
            >
              <span className={fieldStyles.cellIcon}>
                <CloudSourceIcon />
              </span>
              {entry.label}
            </button>
          </li>
        ))}
      </ul>
      <p id={noteId} className={fieldStyles.muted}>
        Dropbox, OneDrive, Box and Google Drive cannot be connected in this app yet.
      </p>

      {task.attachments.length > 0 && (
        <section aria-label="Attached files" className="flex flex-col gap-2">
          <div className={fieldStyles.divider} />
          <ul className={cn(fieldStyles.scroll, 'flex max-h-56 flex-col gap-1.5 overflow-y-auto')}>
            {task.attachments.map((file) => (
              <li
                key={file.id}
                className="flex h-10 shrink-0 items-center gap-2 rounded-[0.25rem] bg-[#F6F2FF] pr-1.5 pl-1"
              >
                <FileBadge name={file.name} />
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[#626262]">
                  {file.name}
                </span>
                <span className="shrink-0 text-[0.625rem] text-[#909090]">
                  {formatFileSize(file.size)}
                </span>
                <RemoveButton
                  label={`Remove ${file.name}`}
                  className="ml-1"
                  onClick={() => {
                    void save(task.id, {
                      attachments: task.attachments.filter((other) => other.id !== file.id),
                    })
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
