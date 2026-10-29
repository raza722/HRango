import { type ReactNode, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { FormField } from '@/components/form'
import { RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { type FileRef, uploadFile } from '@/lib/files'
import { cn } from '@/lib/utils'

import { type ChipMeta, UPLOAD_ACCEPT } from '../../constants'
import { cardTitleClass, chipClass, sectionCardClass } from '../../utils/styles'

/** A status chip ("Active", "On Probation", "Approved" …). */
export function Chip({ meta }: { meta: ChipMeta }) {
  return <span className={cn(chipClass, meta.className)}>{meta.label}</span>
}

/**
 * One of the profile's white cards: the title with its buttons, the content, and the link at
 * its foot ("View History", "View More").
 */
export function SectionCard({
  title,
  actions,
  footer,
  children,
  className,
}: {
  title: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className={cn(sectionCardClass, 'grid gap-3 p-4', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className={cardTitleClass}>
          {title}
        </h3>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="min-w-0">{children}</div>
      {footer && <div className="flex justify-end">{footer}</div>}
    </section>
  )
}

/** "Nothing here yet" inside a card. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

/** Placeholder rows while a card loads. */
export function LoadingRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div aria-busy="true" className="grid gap-2">
      <span className="sr-only">Loading {label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

/** A card's or row's ⋮ menu with Edit and Delete (only the ones allowed). */
export function EditDeleteMenu({
  label,
  onEdit,
  onDelete,
}: {
  label: string
  onEdit?: (() => void) | undefined
  onDelete?: (() => void) | undefined
}) {
  const actions = [
    ...(onEdit ? [{ label: 'Edit', onSelect: onEdit }] : []),
    ...(onDelete ? [{ label: 'Delete', onSelect: onDelete, variant: 'destructive' as const }] : []),
  ]
  if (actions.length === 0) return null
  return <RowActionsMenu label={label} actions={actions} itemClassName={rowMenuItemClass.poppins} />
}

/** "Are you sure?" before deleting a row; `onConfirm` runs the delete. */
export function ConfirmDelete({
  what,
  onConfirm,
  onClose,
}: {
  /** "the dependent Ashraf Hussain". */
  what: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Delete"
      description={`Are you sure you want to delete ${what}?`}
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={onConfirm}
    />
  )
}

/**
 * "Upload Document": Choose File / No File Chosen, as the popups draw it. The file goes to
 * `POST /files` (module employees) as soon as it is chosen; the form keeps `{id, name, url}` and
 * sends the id. A chosen file can be removed again.
 */
export function FilePickerField({
  label,
  value,
  onChange,
  error,
  accept = UPLOAD_ACCEPT,
}: {
  label: string
  value: FileRef | null
  onChange: (file: FileRef | null) => void
  error?: string | undefined
  accept?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const message = failed ?? error
  return (
    <FormField label={label} {...(message ? { error: message } : {})}>
      {(a11y) => (
        <div className="flex min-h-10 flex-wrap items-center gap-3 rounded-lg border border-[#CFCFCF] px-1.5 py-1 dark:border-input">
          <button
            type="button"
            id={a11y.id}
            aria-describedby={a11y['aria-describedby']}
            aria-invalid={a11y['aria-invalid']}
            disabled={busy}
            onClick={() => input.current?.click()}
            className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-[#CFCFCF] bg-muted/60 px-3 text-xs text-title outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 dark:border-input dark:text-heading"
          >
            {busy && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
            Choose File
          </button>
          <span className="min-w-0 flex-1 truncate text-xs text-[#989799] dark:text-muted-foreground">
            {busy ? (
              'Uploading…'
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
              'No File Chosen'
            )}
          </span>
          {value && !busy && (
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
            accept={accept}
            className="sr-only"
            tabIndex={-1}
            aria-label={`${label} file`}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setBusy(true)
              setFailed(null)
              uploadFile(file, 'employees')
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
