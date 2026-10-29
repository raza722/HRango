import { z } from 'zod'

import { VIEW_KINDS } from './types/pm.types'

/** `/project-management/workspaces`: `?create=true` opens the Create Workspace wizard. */
export const workspacesSearchSchema = z.object({
  create: z.boolean().optional().catch(undefined),
})
export type WorkspacesSearch = z.infer<typeof workspacesSearchSchema>

/**
 * A workspace page: the list shown (all of the workspace's tasks when absent), the view, and
 * `overdue=true` for the Overdue tab (in place of the view). The Calendar and Timeline views keep
 * their settings here too (approved default: in the address, not saved for everyone): `on` the
 * day shown (today when absent), `calendar` month / week, `scale` week / month / quarter and
 * `group` list / assignee / status.
 */
export const workspaceSearchSchema = z.object({
  list: z.string().max(60).optional().catch(undefined),
  view: z.enum(VIEW_KINDS).optional().catch(undefined),
  overdue: z.boolean().optional().catch(undefined),
  on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  calendar: z.enum(['month', 'week']).optional().catch(undefined),
  scale: z.enum(['week', 'month', 'quarter']).optional().catch(undefined),
  group: z.enum(['list', 'assignee', 'status']).optional().catch(undefined),
})
export type WorkspaceSearch = z.infer<typeof workspaceSearchSchema>
