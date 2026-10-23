import type { ComponentType } from 'react'

import type { TaskColumnKey } from '../../types/pm.types'
import { AssigneesCell } from './assignee-field'
import { DueDateCell, StartDateCell } from './date-field'
import { DependenciesCell } from './dependency-field'
import { FilesCell } from './files-field'
import {
  CreatedByCell,
  DateClosedCell,
  DateCreatedCell,
  LatestCommentCell,
  NameCell,
  ProgressCell,
  TaskIdCell,
} from './info-cells'
import { PriorityCell } from './priority-field'
import { StatusCell } from './status-field'
import { StoryPointsCell } from './story-points-field'
import { LabelsCell, TagsCell } from './tag-field'
import type { TaskCellProps } from './task-cell-types'
import { TimeEstimateCell } from './time-estimate-field'
import { TimeTrackedCell } from './time-tracked-field'

export { averageStoryPoints } from './field-utils'
export { TaskNameAdornments } from './name-adornments'
export type { TaskCellProps } from './task-cell-types'

/**
 * The List view's cell for each column: what it shows and the popup it opens.
 * The workspace page draws `TASK_CELLS[column.key]` in each column (the Task Name column draws
 * the name itself and adds `TaskNameAdornments`).
 */
export const TASK_CELLS: Record<TaskColumnKey, ComponentType<TaskCellProps>> = {
  name: NameCell,
  assignees: AssigneesCell,
  startDate: StartDateCell,
  dueDate: DueDateCell,
  priority: PriorityCell,
  tags: TagsCell,
  dependencies: DependenciesCell,
  status: StatusCell,
  progress: ProgressCell,
  timeEstimate: TimeEstimateCell,
  timeTracked: TimeTrackedCell,
  taskId: TaskIdCell,
  createdBy: CreatedByCell,
  dateCreated: DateCreatedCell,
  dateClosed: DateClosedCell,
  latestComment: LatestCommentCell,
  storyPoints: StoryPointsCell,
  files: FilesCell,
  labels: LabelsCell,
}
