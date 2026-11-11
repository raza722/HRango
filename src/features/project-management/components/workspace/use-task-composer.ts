import { useRef, useState } from 'react'

import { useCreateTask } from '../../hooks/use-pm'
import type { TaskType } from '../../types/pm.types'

interface ComposerTarget {
  workspaceId: string
  listId: string | null
  statusId: string | undefined
  type: TaskType
  /** A subtask's parent (the task panel's "Add subtask"); null for a top-level task. */
  parentId?: string | null
}

/**
 * The name box of an inline "Add Task" (the List view's new-task row, a Board column's foot).
 *
 * Enter clears the box at once and the save runs in the background, so the next name can be
 * typed straight away: nothing typed during a save is joined to the previous name or wiped when
 * it finishes. Saves run one after another, so the tasks keep the order they were typed in. A
 * failed save puts its name back (unless the box already holds the next one) with an error.
 */
export function useTaskComposer({
  workspaceId,
  listId,
  statusId,
  type,
  parentId = null,
}: ComposerTarget) {
  const create = useCreateTask()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(0)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const label = parentId ? 'subtask' : type === 'milestone' ? 'milestone' : 'task'

  const change = (value: string) => {
    setName(value)
    if (error) setError(null)
  }

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(`Enter the ${label} name`)
      return
    }
    setError(null)
    setName('')
    setSaving((count) => count + 1)
    queue.current = queue.current.then(async () => {
      try {
        await create.mutateAsync({ workspaceId, listId, parentId, name: trimmed, statusId, type })
      } catch {
        // The global mutation toast says why; the name is kept so it can be sent again.
        setName((current) => (current.trim() === '' ? trimmed : current))
        setError(`"${trimmed}" was not saved. Press Enter to try again.`)
      } finally {
        setSaving((count) => count - 1)
      }
    })
  }

  /** "Saving the task…" while saves run, for a polite status line. */
  const savingText =
    saving === 0 ? '' : saving === 1 ? `Saving the ${label}…` : `Saving ${saving} ${label}s…`

  return { name, change, error, submit, savingText, label }
}
