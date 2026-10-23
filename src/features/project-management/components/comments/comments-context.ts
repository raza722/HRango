import { createContext, useContext } from 'react'

export interface CommentsTarget {
  taskId: string
  workspaceId: string
}

export const CommentsContext = createContext<((target: CommentsTarget) => void) | null>(null)

/**
 * Opens the Comments panel of a task. Any part of a workspace page (the Latest Comment cell,
 * the comment icon after a task's name) can call it; the panel is drawn once by the layout.
 */
export function useOpenComments(): (target: CommentsTarget) => void {
  const open = useContext(CommentsContext)
  if (!open) throw new Error('useOpenComments must be used inside CommentsProvider')
  return open
}
