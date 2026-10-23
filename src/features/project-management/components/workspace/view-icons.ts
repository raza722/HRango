import type { ComponentType } from 'react'

import type { ViewKind } from '../../types/pm.types'
import {
  ActivityViewIcon,
  BoardViewIcon,
  CalendarViewIcon,
  GanttViewIcon,
  ListViewIcon,
  MindMapViewIcon,
  TableViewIcon,
  TeamViewIcon,
  TimelineViewIcon,
  WorkloadViewIcon,
} from './workspace-icons'

/** Each view button's icon and its drawn size (view bar 1:3769). */
export const VIEW_ICONS: Record<
  ViewKind,
  { Icon: ComponentType<{ className?: string }>; size: string }
> = {
  list: { Icon: ListViewIcon, size: 'h-[1.0175rem] w-[1.7325rem]' },
  board: { Icon: BoardViewIcon, size: 'size-[1.277rem]' },
  calendar: { Icon: CalendarViewIcon, size: 'h-[1.624rem] w-[1.474rem]' },
  activity: { Icon: ActivityViewIcon, size: 'h-[1.396rem] w-[1.2rem]' },
  team: { Icon: TeamViewIcon, size: 'size-[1.4rem]' },
  timeline: { Icon: TimelineViewIcon, size: 'h-[1.03rem] w-[1.593rem]' },
  table: { Icon: TableViewIcon, size: 'size-[1.4rem]' },
  gantt: { Icon: GanttViewIcon, size: 'size-[1.4rem]' },
  workload: { Icon: WorkloadViewIcon, size: 'size-[1.4rem]' },
  'mind-map': { Icon: MindMapViewIcon, size: 'size-[1.4rem]' },
}
