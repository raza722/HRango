import { useCallback } from 'react'

import { useUpdateTask } from '../../hooks/use-pm'
import type { TaskPatch } from '../../types/pm.types'
import type { TaskUpdate } from './field-utils'

/**
 * Saves task patches from the column popups. Resolves to whether every patch was accepted; a
 * refused patch is toasted by the app's mutation cache with the server's message.
 */
export function useTaskSave() {
  const { mutateAsync, isPending } = useUpdateTask()

  const save = useCallback(
    async (id: string, patch: TaskPatch): Promise<boolean> => {
      try {
        await mutateAsync({ id, patch })
        return true
      } catch {
        return false
      }
    },
    [mutateAsync],
  )

  /** Several tasks in order (both sides of a dependency); stops at the first refusal. */
  const saveAll = useCallback(
    async (updates: readonly TaskUpdate[]): Promise<boolean> => {
      for (const update of updates) {
        if (!(await save(update.id, update.patch))) return false
      }
      return true
    },
    [save],
  )

  return { save, saveAll, isPending }
}
