import type {
  ShareSettings,
  Tag,
  Task,
  TaskComment,
  Workspace,
  WorkspaceItem,
} from '@/features/project-management'

import { createMockCollection } from '../collection'
import { seedComments, seedItems, seedShares, seedTags, seedTasks, seedWorkspaces } from './seed'

const key = (name: string) => `hrms-mock-pm-${name}`

export const workspaces = createMockCollection<Workspace>({
  storageKey: key('workspaces'),
  seed: seedWorkspaces,
})
export const workspaceItems = createMockCollection<WorkspaceItem>({
  storageKey: key('items'),
  seed: seedItems,
})
export const tasks = createMockCollection<Task>({ storageKey: key('tasks'), seed: seedTasks })
export const comments = createMockCollection<TaskComment>({
  storageKey: key('comments'),
  seed: seedComments,
})
export const tags = createMockCollection<Tag>({ storageKey: key('tags'), seed: seedTags })
export const shares = createMockCollection<ShareSettings & { id: string }>({
  storageKey: key('shares'),
  seed: seedShares,
})

export function resetProjectManagementDb(): void {
  for (const collection of [workspaces, workspaceItems, tasks, comments, tags, shares]) {
    collection.reset()
  }
}
