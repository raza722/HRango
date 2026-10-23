import type { TaskRow, Workspace } from '../../types/pm.types'

export interface TaskCellProps {
  task: TaskRow
  workspace: Workspace
  /** Every task of the workspace view, for dependencies and mentions. */
  tasks: readonly TaskRow[]
  /**
   * Opens the workspace's status settings (the gear of the Status popup). Without it the gear
   * stays disabled: the design has no settings screen for it.
   */
  onOpenStatusSettings?: (() => void) | undefined
}
