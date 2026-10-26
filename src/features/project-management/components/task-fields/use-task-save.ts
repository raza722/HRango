import { useCallback } from 'react'

import { useUpdateTask } from '../../hooks/use-pm'
import type { TaskPatch } from '../../types/pm.types'

/**
 * Saves task patches from the column popups (the API layer sends each part to its endpoint).
 * Resolves to whether the patch was accepted; a refused patch is toasted by the app's mutation
 * cache with the server's message.
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

  return { save, isPending }
}
