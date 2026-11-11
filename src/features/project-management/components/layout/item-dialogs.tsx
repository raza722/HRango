import { useId, useState } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { WorkspaceItem, WorkspaceItemKind } from '../../types/pm.types'

/** A folder's or list's name, as the API allows it (`FolderIn` / `ListIn`: 1 to 200 characters). */
const NAME_MAX = 200
/** The folder select's value for "no folder" (Radix Select has no empty value). */
const TOP_LEVEL = '__top__'

const KIND_LABEL: Record<WorkspaceItemKind, string> = { folder: 'folder', list: 'list' }

const field =
  'h-11 w-full rounded-xl border border-[#E9E9E9] bg-white px-3 text-sm text-[#303030] outline-none placeholder:text-[#909090] focus:border-[#A181FF] focus:ring-[3px] focus:ring-[rgba(132,78,255,0.2)] aria-invalid:border-[#DC3545] dark:border-border dark:bg-card dark:text-title'
const primary =
  'inline-flex h-10 items-center justify-center rounded-xl bg-[#7127EA] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#5f1fd0] disabled:opacity-60'
const secondary =
  'inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-medium text-[#5D5D5D] transition-colors hover:bg-[#F4F4F4] dark:text-title dark:hover:bg-white/5'

export type ItemDialogState =
  | { mode: 'create'; kind: WorkspaceItemKind; parentId: string | null }
  | { mode: 'rename'; item: WorkspaceItem }

/**
 * New folder / New list (named before it is made, a list optionally in a folder) and Rename.
 * The dialog stays open while saving; a refused save (a duplicate name) is toasted by the app.
 */
export function ItemNameDialog({
  state,
  folders,
  saving,
  onSubmit,
  onClose,
}: {
  state: ItemDialogState | null
  /** The workspace's folders, for a new list's "In folder". */
  folders: readonly WorkspaceItem[]
  saving: boolean
  onSubmit: (name: string, parentId: string | null) => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-md p-0">
        {state && (
          <ItemNameForm
            // A fresh form for each item or kind.
            key={state.mode === 'rename' ? state.item.id : `new-${state.kind}`}
            state={state}
            folders={folders}
            saving={saving}
            onSubmit={onSubmit}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ItemNameForm({
  state,
  folders,
  saving,
  onSubmit,
  onClose,
}: {
  state: ItemDialogState
  folders: readonly WorkspaceItem[]
  saving: boolean
  onSubmit: (name: string, parentId: string | null) => void
  onClose: () => void
}) {
  const kind = state.mode === 'rename' ? state.item.kind : state.kind
  const label = KIND_LABEL[kind]
  const [name, setName] = useState(state.mode === 'rename' ? state.item.name : '')
  const [parentId, setParentId] = useState<string | null>(
    state.mode === 'create' ? state.parentId : null,
  )
  const [error, setError] = useState<string | null>(null)
  const ids = { name: useId(), error: useId(), folder: useId() }
  const title = state.mode === 'rename' ? `Rename ${label}` : `New ${label}`

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(`Name the ${label}`)
      return
    }
    if (state.mode === 'rename' && trimmed === state.item.name) {
      onClose()
      return
    }
    onSubmit(trimmed, parentId)
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex flex-col gap-5 p-6"
    >
      <div className="pr-8">
        <DialogTitle className="text-lg">{title}</DialogTitle>
        <DialogDescription className="mt-1">
          {kind === 'folder'
            ? 'A folder groups lists. The Project Dashboard shows each folder as a project.'
            : 'A list holds tasks. Put it in a folder to group it with related lists.'}
        </DialogDescription>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={ids.name} className="text-sm font-medium text-[#303030] dark:text-title">
          Name
        </label>
        <input
          id={ids.name}
          autoFocus
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          placeholder={kind === 'folder' ? 'e.g. Recruitment drive 2027' : 'e.g. Interview round 1'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.error : undefined}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError(null)
          }}
          onFocus={(event) => {
            event.currentTarget.select()
          }}
          className={field}
        />
        {error && (
          <p id={ids.error} role="alert" className="text-xs text-[#DC3545] dark:text-[#FF8A94]">
            {error}
          </p>
        )}
      </div>

      {state.mode === 'create' && kind === 'list' && folders.length > 0 && (
        <div className="grid gap-1.5">
          <span id={ids.folder} className="text-sm font-medium text-[#303030] dark:text-title">
            In folder <span className="font-normal text-[#909090]">(optional)</span>
          </span>
          <Select
            value={parentId ?? TOP_LEVEL}
            onValueChange={(value) => {
              setParentId(value === TOP_LEVEL ? null : value)
            }}
          >
            <SelectTrigger aria-labelledby={ids.folder} className={cn(field, 'justify-between')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP_LEVEL}>No folder (top level)</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} aria-busy={saving || undefined} className={primary}>
          {state.mode === 'rename' ? 'Save' : `Create ${label}`}
        </button>
      </div>
    </form>
  )
}
