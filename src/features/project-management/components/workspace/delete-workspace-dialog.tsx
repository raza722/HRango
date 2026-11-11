import { useId, useState } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

import { useDeleteWorkspace } from '../../hooks/use-pm'
import type { Workspace } from '../../types/pm.types'

/**
 * Delete Workspace (`DELETE /projects/workspaces/{id}`, workspace admins only). It removes every
 * folder, list, task and comment for everyone, so the name is typed to confirm it.
 */
export function DeleteWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
  onDeleted,
}: {
  workspace: Workspace
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After the delete: the caller leaves the workspace's page. */
  onDeleted: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0">
        {open && (
          <DeleteForm
            workspace={workspace}
            onCancel={() => {
              onOpenChange(false)
            }}
            onDeleted={onDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeleteForm({
  workspace,
  onCancel,
  onDeleted,
}: {
  workspace: Workspace
  onCancel: () => void
  onDeleted: () => void
}) {
  const remove = useDeleteWorkspace()
  const [typed, setTyped] = useState('')
  const inputId = useId()
  const matches = typed.trim() === workspace.name.trim()

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!matches) return
        remove.mutate(workspace, { onSuccess: onDeleted })
      }}
      className="flex flex-col gap-5 p-6"
    >
      <div className="pr-8">
        <DialogTitle className="text-lg text-[#B7192C]">Delete this workspace?</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-[#3D3D3D] dark:text-title">
          <strong>{workspace.name}</strong> will be deleted with all of its folders, lists, tasks,
          docs, comments and files, for everyone. This cannot be undone.
        </DialogDescription>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-[#303030] dark:text-title">
          Type <span className="font-semibold">{workspace.name}</span> to confirm
        </label>
        <input
          id={inputId}
          autoFocus
          autoComplete="off"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value)
          }}
          className="h-11 rounded-xl border border-[#E9E9E9] bg-white px-3 text-sm text-[#303030] outline-none focus:border-[#B7192C] focus:ring-[3px] focus:ring-[#B7192C]/15 dark:border-border dark:bg-card dark:text-title"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center rounded-xl px-5 text-sm font-medium text-[#5D5D5D] hover:bg-[#F4F4F4] dark:text-title dark:hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!matches || remove.isPending}
          aria-busy={remove.isPending || undefined}
          className="inline-flex h-10 items-center rounded-xl bg-[#B7192C] px-5 text-sm font-semibold text-white hover:bg-[#9b1524] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {remove.isPending ? 'Deleting…' : 'Delete Workspace'}
        </button>
      </div>
    </form>
  )
}
