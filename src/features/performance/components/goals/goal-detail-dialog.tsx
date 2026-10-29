import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { GOAL_STATUS_META, metaOf } from '../../constants'
import { useGoal } from '../../hooks/use-performance'
import type { GoalDetail } from '../../types/performance.types'
import { formatDate, formatNumber, formatStamp } from '../../utils/format'
import { navyButtonClass, outlineButtonClass, saveButtonClass } from '../../utils/styles'
import { ViewDialog } from '../shared/dialogs'
import {
  Chip,
  EmptyNote,
  Facts,
  GoalStatusChips,
  LoadingRows,
  ProgressBar,
  SectionCard,
} from '../shared/parts'

export interface GoalActions {
  canCheckIn: boolean
  canEdit: boolean
  canDelete: boolean
  onCheckIn: (goal: GoalDetail) => void
  onEdit: (goal: GoalDetail) => void
  onDelete: (goal: GoalDetail) => void
}

/** The check-in history, newest first: when, by whom, progress, actual value, status, note. */
function CheckInHistory({ goal }: { goal: GoalDetail }) {
  if (goal.checkIns.length === 0) {
    return <EmptyNote>No check-ins yet. Check In records the progress.</EmptyNote>
  }
  return (
    <ol aria-label="Check-in history" className="grid gap-3">
      {goal.checkIns.map((entry) => (
        <li
          key={entry.id}
          className="grid gap-2 rounded-lg border border-[#E6E9F0] px-3 py-2.5 dark:border-border"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-grey">
              {formatStamp(entry.createdAt)}
              {entry.createdByName ? ` · ${entry.createdByName}` : ''}
            </span>
            <Chip meta={metaOf(GOAL_STATUS_META, entry.status)} />
          </div>
          <ProgressBar
            value={entry.progress}
            label={`Progress at the check-in of ${formatStamp(entry.createdAt)}`}
          />
          {entry.actualValue !== null && (
            <span className="text-xs text-title">Actual {formatNumber(entry.actualValue)}</span>
          )}
          {entry.comments && <p className="text-sm text-title">{entry.comments}</p>}
        </li>
      ))}
    </ol>
  )
}

/** A goal with its progress and its check-in history (`?goal=<id>`). */
export function GoalDetailDialog({
  goalId,
  actions,
  onClose,
}: {
  goalId: string
  actions: GoalActions
  onClose: () => void
}) {
  const query = useGoal(goalId)
  const goal = query.data
  const open = goal && !goal.isLocked
  return (
    <ViewDialog
      title={goal?.title ?? 'Goal'}
      description={
        goal ? `${goal.employeeName}${goal.cycleName ? ` · ${goal.cycleName}` : ''}` : undefined
      }
      onClose={onClose}
      footer={
        goal &&
        open && (
          <>
            {actions.canEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  actions.onEdit(goal)
                }}
                className={cn('h-12 rounded-lg px-6', outlineButtonClass)}
              >
                Edit
              </Button>
            )}
            {actions.canDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  actions.onDelete(goal)
                }}
                className="h-12 rounded-lg border-destructive px-6 text-destructive hover:bg-destructive/5"
              >
                Delete
              </Button>
            )}
            {actions.canCheckIn && (
              <Button
                type="button"
                onClick={() => {
                  actions.onCheckIn(goal)
                }}
                className={cn(saveButtonClass, navyButtonClass)}
              >
                Check In
              </Button>
            )}
          </>
        )
      }
    >
      {query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => {
            void query.refetch()
          }}
          className="shadow-none"
        />
      ) : !goal ? (
        <LoadingRows rows={4} label="the goal" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <GoalStatusChips
              status={goal.status}
              isOverdue={goal.isOverdue}
              isLocked={goal.isLocked}
            />
            <ProgressBar
              value={goal.progress}
              label={`Progress of ${goal.title}`}
              className="max-w-sm flex-1"
            />
          </div>
          {goal.isLocked && (
            <p className="text-xs text-muted-foreground">
              Locked: its review cycle is closed or its appraisal is finalised, so it can no longer
              change.
            </p>
          )}
          <Facts
            items={[
              { label: 'Employee', value: goal.employeeName },
              { label: 'Department', value: goal.departmentName ?? '—' },
              { label: 'Review Cycle', value: goal.cycleName ?? 'None' },
              { label: 'KPI', value: goal.kpiName ?? 'None' },
              { label: 'Start Date', value: formatDate(goal.startDate) },
              { label: 'Due Date', value: formatDate(goal.dueDate) },
              { label: 'Weight', value: `${formatNumber(goal.weight)}%` },
              { label: 'Target', value: formatNumber(goal.targetValue) },
              { label: 'Actual', value: formatNumber(goal.actualValue) },
              ...(goal.completedAt
                ? [{ label: 'Completed', value: formatStamp(goal.completedAt) }]
                : []),
            ]}
          />
          {goal.description && <p className="text-sm text-title">{goal.description}</p>}
          <SectionCard title="Check-in History" as="h3">
            <CheckInHistory goal={goal} />
          </SectionCard>
        </>
      )}
    </ViewDialog>
  )
}
