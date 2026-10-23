import { z } from 'zod'

import { VIEW_KINDS } from './types/pm.types'

/** `/project-management/workspaces`: `?create=true` opens the Create Workspace wizard. */
export const workspacesSearchSchema = z.object({
  create: z.boolean().optional().catch(undefined),
})
export type WorkspacesSearch = z.infer<typeof workspacesSearchSchema>

/** A workspace page: the list shown (all of the workspace's tasks when absent) and the view. */
export const workspaceSearchSchema = z.object({
  list: z.string().max(60).optional().catch(undefined),
  view: z.enum(VIEW_KINDS).optional().catch(undefined),
})
export type WorkspaceSearch = z.infer<typeof workspaceSearchSchema>
