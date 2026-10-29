import { useId, useRef, useState } from 'react'

import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useAddAttachment, useAttachments, useDeleteAttachment } from '../../hooks/use-pm'
import { usePmAccess } from '../../hooks/use-pm-access'
import type { Attachment, TaskRow, Workspace } from '../../types/pm.types'
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
  ATTACHMENT_TYPES,
  type FileKind,
  fileKind,
  formatFileSize,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
} from './field-utils'
import { RemoveButton } from './remove-button'
import type { TaskCellProps } from './task-cell-types'

const KINDS: Record<FileKind, { label: string; color: string; Icon: typeof PdfFileIcon }> = {
  pdf: { label: 'PDF', color: '#E5383B', Icon: PdfFileIcon },
  xls: { label: 'XLS', color: '#1D8F4E', Icon: SheetFileIcon },
  jpg: { label: 'JPG', color: '#F79009', Icon: ImageFileIcon },
  doc: { label: 'DOC', color: '#2E64E2', Icon: DocFileIcon },
  file: { label: 'FILE', color: '#87909E', Icon: GenericFileIcon },
}

/** The sources of "Attach File Dropdown", in its order; none can be connected in this app. */
const THIRD_PARTY = [
  { source: 'dropbox', label: 'Dropbox' },
  { source: 'onedrive', label: 'OneDrive' },
  { source: 'box', label: 'Box' },
  { source: 'google-drive', label: 'Google Drive' },
] as const

/** A file's type icon on the white circle of the file chips. */
function FileBadge({ name, className }: { name: string; className?: string }) {
  const kind = KINDS[fileKind(name)]
  return (
    <span
      className={cn(
        'flex size-[1.4rem] shrink-0 items-center justify-center rounded-full bg-white dark:bg-card',
        className,
      )}
      style={{ color: kind.color }}
      title={kind.label}
    >
      <kind.Icon className="size-3.5" />
    </span>
  )
}

/**
 * Files column: the first file as a chip ("Business Requirem..."), or "Attach files". The row
 * carries the count; the names are read when the popup opens (`GET /tasks/{id}/attachments`).
 */
export function FilesCell({ task, workspace }: TaskCellProps) {
  const [open, setOpen] = useState(false)
  const attachments = useAttachments(task.id, open)
  const files = attachments.data ?? []
  const count = attachments.data ? files.length : task.attachmentCount
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
            count > 0
              ? `Files: ${first ? files.map((file) => file.name).join(', ') : `${count} attached`}`
              : `Attach files to ${task.name}`
          }
          className={cn(fieldStyles.cell, 'pr-1.5')}
        >
          {count > 0 ? (
            <span className="flex h-[1.8rem] min-w-0 flex-1 items-center gap-2 rounded-[0.25rem] bg-[#F6F2FF] pr-2 pl-1 dark:bg-[#7127EA]/10">
              <FileBadge name={first?.name ?? 'file'} />
              <span className="min-w-0 truncate">
                {first?.name ?? `${count} ${count === 1 ? 'file' : 'files'}`}
              </span>
              {first && count > 1 && (
                <span className="shrink-0 text-[0.6875rem] font-semibold text-[#7127EA] dark:text-[#C4ABFF]">
                  +{count - 1}
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
        workspace={workspace}
        files={files}
        loading={attachments.isPending}
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

/** "Attach File Dropdown": Upload File From This Device, the other sources, the files. */
function FilesPanel({
  task,
  workspace,
  files,
  loading,
  onClose,
}: {
  task: TaskRow
  workspace: Workspace
  files: readonly Attachment[]
  loading: boolean
  onClose: () => void
}) {
  const access = usePmAccess(workspace)
  const addAttachment = useAddAttachment()
  const deleteAttachment = useDeleteAttachment()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const noteId = useId()

  const update = (key: string, patch: Partial<Upload>) => {
    setUploads((current) =>
      current.map((upload) => (upload.key === key ? { ...upload, ...patch } : upload)),
    )
  }

  /** Uploads each file (`POST /files`, module projects), then attaches it to the task. */
  const upload = async (list: FileList | null) => {
    const picked = [...(list ?? [])]
    if (picked.length === 0) return
    const started = picked.map((file, index) => ({
      key: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      percent: 0,
      error: file.size > MAX_FILE_BYTES ? `Files must be ${MAX_FILE_LABEL} or smaller` : null,
    }))
    setUploads((current) => [...current, ...started])
    await Promise.all(
      picked.map(async (file, index) => {
        const entry = started[index]
        if (!entry || entry.error) return
        try {
          await addAttachment.mutateAsync({
            taskId: task.id,
            file,
            onProgress: (percent) => {
              update(entry.key, { percent })
            },
          })
          setUploads((current) => current.filter((other) => other.key !== entry.key))
        } catch (error) {
          update(entry.key, {
            error: error instanceof ApiError ? error.message : 'The file could not be uploaded',
          })
        }
      }),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <PopupHeader title="Attach Files" onClose={onClose} />
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_TYPES}
        multiple
        aria-label="Upload File From This Device"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void upload(event.target.files)
          event.target.value = ''
        }}
      />
      {access.editTasks && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-[0.5625rem] border border-dashed border-[#7127EA] bg-[#EEE7FF] px-[1.2rem] py-[1.6rem] text-center text-[0.8125rem] font-medium text-[#626262] transition-colors hover:bg-[#E4DAFF] dark:bg-[#7127EA]/10 dark:text-title dark:hover:bg-[#7127EA]/30"
        >
          <AttachIcon className="size-[0.9rem] text-[#7127EA] dark:text-[#C4ABFF]" />
          Upload File From This Device
          <span className="text-[0.6875rem] font-normal text-[#909090]">
            PDF, DOCX, XLSX, PNG or JPG, up to {MAX_FILE_LABEL}
          </span>
        </button>
      )}

      {uploads.length > 0 && (
        <ul aria-label="Uploads" className="flex flex-col gap-1.5">
          {uploads.map((entry) => (
            <li
              key={entry.key}
              className="rounded-[0.5625rem] bg-[rgba(221,221,221,0.2)] px-2.5 py-2 text-xs"
            >
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium text-[#626262] dark:text-title">
                  {entry.name}
                </span>
                <span
                  className={
                    entry.error
                      ? 'text-[#DC3545] dark:text-[#FF8A94]'
                      : 'font-semibold text-[#7127EA] dark:text-[#C4ABFF]'
                  }
                >
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
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#E7E7E7] dark:bg-white/10"
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
              className="flex h-[2.6rem] w-full cursor-not-allowed items-center gap-2.5 rounded-[0.5625rem] bg-[rgba(221,221,221,0.2)] px-1.5 text-left text-[0.8125rem] font-medium text-[#626262] opacity-60 dark:text-title"
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

      {loading && <p className={fieldStyles.muted}>Loading files...</p>}
      {files.length > 0 && (
        <section aria-label="Attached files" className="flex flex-col gap-2">
          <div className={fieldStyles.divider} />
          <ul className={cn(fieldStyles.scroll, 'flex max-h-56 flex-col gap-1.5 overflow-y-auto')}>
            {files.map((file) => (
              <li
                key={file.id}
                className="flex h-10 shrink-0 items-center gap-2 rounded-[0.25rem] bg-[#F6F2FF] pr-1.5 pl-1 dark:bg-[#7127EA]/10"
              >
                <FileBadge name={file.name} />
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  title={file.uploadedByName ? `Attached by ${file.uploadedByName}` : undefined}
                  className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[#626262] hover:text-[#7127EA] hover:underline dark:text-title dark:hover:text-[#C4ABFF]"
                >
                  {file.name}
                </a>
                <span className="shrink-0 text-[0.625rem] text-[#909090]">
                  {formatFileSize(file.size)}
                </span>
                {access.editTasks && (
                  <RemoveButton
                    label={`Remove ${file.name}`}
                    className="ml-1"
                    onClick={() => {
                      deleteAttachment.mutate(file.id)
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
