import { z } from 'zod'

/** The Task Dashboard's tiles that open a list of their tasks (`?show=`). */
export const TASK_TILES = ['unassigned', 'in-progress', 'completed', 'completed-this-week'] as const
export type TaskTile = (typeof TASK_TILES)[number]

const itemId = z.string().max(80).optional().catch(undefined)

/** `/project-management/workspace-dashboard?workspace=` (the first workspace when absent). */
export const workspaceDashboardSearchSchema = z.object({ workspace: itemId })
export type WorkspaceDashboardSearch = z.infer<typeof workspaceDashboardSearchSchema>

/**
 * `/project-management/project-dashboard?workspace=&folder=`: a project is a folder (approved);
 * the folder is its item id (`folder:<id>`).
 */
export const projectDashboardSearchSchema = z.object({ workspace: itemId, folder: itemId })
export type ProjectDashboardSearch = z.infer<typeof projectDashboardSearchSchema>

/** `/project-management/task-dashboard?workspace=&show=`: every workspace when `workspace` is absent. */
export const taskDashboardSearchSchema = z.object({
  workspace: itemId,
  show: z.enum(TASK_TILES).optional().catch(undefined),
})
export type TaskDashboardSearch = z.infer<typeof taskDashboardSearchSchema>
