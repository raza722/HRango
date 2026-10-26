import { type ChangeEvent, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { WORKSPACE_DESCRIPTION_MAX } from '../../constants'
import { useSetCover } from '../../hooks/use-pm'
import { pmButton } from '../../pm-styles'
import type { Workspace, WorkspacePatch } from '../../types/pm.types'
import { COVER_MAX_BYTES, COVER_MIME, COVER_TYPES, coverStyle } from './covers'
import { CoverIcon, DescriptionIcon } from './workspace-icons'
import { bannerStyles, popupStyles } from './workspace-styles'

type Save = (patch: WorkspacePatch, success?: string) => Promise<boolean>

/** "Add Description": the workspace's description, up to 300 characters. */
export function DescriptionPopover({ workspace, onSave }: { workspace: Workspace; onSave: Save }) {
  const [open, setOpen] = useState(false)
  const label = workspace.description ? 'Edit Description' : 'Add Description'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={bannerStyles.iconButton}>
          <DescriptionIcon className="h-[1.344rem] w-[1.588rem] shrink-0" />
          <span className={bannerStyles.label}>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={cn(popupStyles.content, 'w-[22rem]')}>
        {open && (
          <DescriptionForm
            initial={workspace.description}
            title={label}
            onCancel={() => {
              setOpen(false)
            }}
            onSave={async (description) => {
              if (await onSave({ description }, 'Description saved')) setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

function DescriptionForm({
  initial,
  title,
  onCancel,
  onSave,
}: {
  initial: string
  title: string
  onCancel: () => void
  onSave: (description: string) => Promise<void>
}) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setSaving(true)
        void onSave(value.trim()).finally(() => {
          setSaving(false)
        })
      }}
    >
      <h2 className={popupStyles.title}>{title}</h2>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Description</span>
        <textarea
          autoFocus
          rows={5}
          value={value}
          maxLength={WORKSPACE_DESCRIPTION_MAX}
          onChange={(event) => {
            setValue(event.target.value)
          }}
          placeholder="Write what this workspace is for..."
          className={cn(popupStyles.field, 'resize-none')}
        />
        <span className="self-end text-[0.6875rem] text-[#909090]" aria-live="polite">
          {value.length}/{WORKSPACE_DESCRIPTION_MAX}
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(pmButton.cancel, 'h-9 rounded-xl px-5 text-sm')}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className={cn(pmButton.save, 'h-9 disabled:opacity-60')}
        >
          Save
        </button>
      </div>
    </form>
  )
}

/** "Change Cover": upload an image (PNG, JPG, GIF or WebP), or go back to the default banner. */
export function CoverPopover({ workspace }: { workspace: Workspace }) {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const setCover = useSetCover()

  const pick = (file: File | null) => {
    setCover.mutate(
      { workspace, file },
      {
        onSuccess: () => {
          setOpen(false)
        },
      },
    )
  }

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!COVER_MIME.includes(file.type)) {
      toast.error('Choose an image file (JPG, PNG, WebP or GIF).')
      return
    }
    if (file.size > COVER_MAX_BYTES) {
      toast.error('Choose an image under 5 MB.')
      return
    }
    pick(file)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={bannerStyles.iconButton}>
          <CoverIcon className="size-6 shrink-0" />
          <span className={bannerStyles.label}>Change Cover</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(popupStyles.content, 'flex w-[22rem] flex-col gap-3')}
      >
        <h2 className={popupStyles.title}>Change Cover</h2>
        <div
          aria-hidden="true"
          className="h-20 rounded-lg"
          style={coverStyle(workspace.cover?.url ?? null)}
        />
        <input
          ref={input}
          type="file"
          accept={COVER_TYPES}
          className="sr-only"
          tabIndex={-1}
          aria-label="Cover image file"
          onChange={upload}
        />
        <button
          type="button"
          disabled={setCover.isPending}
          aria-busy={setCover.isPending || undefined}
          onClick={() => input.current?.click()}
          className={cn(pmButton.back, 'h-10 rounded-xl text-sm disabled:opacity-60')}
        >
          {setCover.isPending ? 'Uploading...' : 'Upload Cover'}
        </button>
        {workspace.cover && (
          <button
            type="button"
            disabled={setCover.isPending}
            onClick={() => {
              pick(null)
            }}
            className="self-start text-xs font-medium text-[#B7192C] hover:underline disabled:opacity-60"
          >
            Remove cover
          </button>
        )}
        <p className={popupStyles.text}>
          JPG, PNG, WebP or GIF, up to 5 MB. Wide images look best.
        </p>
      </PopoverContent>
    </Popover>
  )
}
