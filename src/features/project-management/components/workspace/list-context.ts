import { createContext, useContext } from 'react'

import type { PmAccess } from '../../hooks/use-pm-access'
import type {
  ListColumn,
  PmPerson,
  TaskColumnKey,
  TaskRow,
  TaskType,
  Workspace,
  WorkspaceTree,
} from '../../types/pm.types'
import type { ListSort, SortContext } from './list-utils'
import type { TaskActions } from './use-task-actions'

/** What the List view's groups, headers and rows share. */
export interface ListViewContextValue {
  workspace: Workspace
  tree: WorkspaceTree
  /** What the caller may do here (company codes and workspace role). */
  access: PmAccess
  /** Every task of the view (before search and filters), for cells and menus. */
  allTasks: readonly TaskRow[]
  /** Visible columns, Task Name first. */
  columns: readonly ListColumn[]
  people: ReadonlyMap<string, PmPerson>
  sortContext: SortContext
  sort: ListSort | null
  onSort: (sort: ListSort | null) => void
  /** Column actions of the header menu and the "+". */
  onColumnAction: (key: TaskColumnKey, action: ColumnAction) => void
  onShowColumn: (key: TaskColumnKey) => void
  onOpenPermission: (key: TaskColumnKey) => void

  selected: ReadonlySet<string>
  onSelect: (ids: readonly string[], selected: boolean) => void
  expanded: ReadonlySet<string>
  /** Opens or closes a task's subtasks; `open` forces one way. */
  onToggleExpand: (taskId: string, open?: boolean) => void
  renamingId: string | null
  onRename: (taskId: string | null) => void
  /** The row a copied link pointed at. */
  highlightedId: string | null

  /** Opens the inline new-task row in a status group. */
  onCompose: (statusId: string, type: TaskType) => void
  /** Drag and drop / keyboard reorder: `movingId` takes `targetId`'s place. */
  onMove: (movingId: string, targetId: string) => void
  draggingId: string | null
  onDragging: (taskId: string | null) => void
  /** Row menu actions. */
  actions: TaskActions
  /** Opens a list (after Convert to List). */
  onOpenList: (listId: string) => void
  /** The link that opens the page on a task (Copy link, Open in new tab). */
  taskHref: (task: TaskRow) => string
}

export type ColumnAction =
  'sort-asc' | 'sort-desc' | 'clear-sort' | 'move-start' | 'move-end' | 'hide' | 'delete'

export const ListViewContext = createContext<ListViewContextValue | null>(null)

export function useListView(): ListViewContextValue {
  const value = useContext(ListViewContext)
  if (!value) throw new Error('useListView must be used inside the List view')
  return value
}
