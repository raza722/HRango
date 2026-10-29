import { Check, Circle, CircleDot } from 'lucide-react'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { cn } from '@/lib/utils'

import { APPRAISAL_STEPS, CHANGE_TYPE_LABELS, labelOf, OUTCOME_LABELS } from '../../constants'
import type {
  AppraisalDetail,
  AppraisalStatus,
  RatingRow,
  ScaleLevel,
} from '../../types/performance.types'
import { formatDate, formatNumber, formatScore } from '../../utils/format'
import { ratingText } from '../../utils/scores'
import { tableClass } from '../../utils/styles'
import { EmptyNote, GoalStatusChips, ProgressBar, SectionCard } from '../shared/parts'

const ORDER: AppraisalStatus[] = ['draft', 'self_review', 'manager_review', 'reviewed', 'finalised']

/**
 * The appraisal's stages as a step list: each step says Done, Current or To come in words
 * (with an icon), so the stage is never told by colour alone. Without a self review the first
 * step is left out.
 */
export function StageSteps({
  status,
  hasSelfReview,
}: {
  status: AppraisalStatus
  hasSelfReview: boolean
}) {
  const at = ORDER.indexOf(status)
  const steps = APPRAISAL_STEPS.filter((step) => hasSelfReview || step.status !== 'self_review')
  return (
    <ol aria-label="Appraisal stages" className="grid gap-2 @md:grid-cols-4">
      {steps.map((step) => {
        const index = ORDER.indexOf(step.status)
        const state =
          index < at || (status === 'finalised' && index === at)
            ? 'done'
            : index === at
              ? 'current'
              : 'todo'
        const Icon = state === 'done' ? Check : state === 'current' ? CircleDot : Circle
        return (
          <li
            key={step.status}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2',
              state === 'done' && 'border-[#2CBD4D]/40 bg-[#2CBD4D]/[0.08]',
              state === 'current' && 'border-sidebar bg-sidebar/[0.05] dark:border-primary',
              state === 'todo' && 'border-[#E6E9F0] dark:border-border',
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                'size-4 shrink-0',
                state === 'done' ? 'text-[#2E9E48]' : 'text-sidebar dark:text-heading',
              )}
            />
            <span className="grid leading-tight">
              <span className="text-xs font-medium text-title">{step.label}</span>
              <span className="text-[0.625rem] text-grey">
                {state === 'done' ? 'Done' : state === 'current' ? 'Current' : 'To come'}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const range = (scale: readonly ScaleLevel[]) => {
  const scores = scale.map((level) => level.score)
  return scores.length ? { min: Math.min(...scores), max: Math.max(...scores) } : { min: 0, max: 5 }
}

/** Goals, Self, Manager and Final scores, each as a bar on the rating scale. */
export function ScoreTiles({ appraisal }: { appraisal: AppraisalDetail }) {
  const { max } = range(appraisal.scale)
  const tiles = [
    {
      label: 'Goals Score',
      value: appraisal.goalsScore,
      note: `${String(appraisal.goalsWeight)}% of the final score`,
    },
    ...(appraisal.hasSelfReview
      ? [{ label: 'Self Score', value: appraisal.selfScore, note: 'The employee’s own ratings' }]
      : []),
    { label: 'Manager Score', value: appraisal.managerScore, note: 'The reviewer’s ratings' },
    {
      label: 'Final Score',
      value: appraisal.finalScore,
      note: appraisal.finalRatingLabel ?? 'Set when finalised',
    },
  ]
  return (
    <ul aria-label="Scores" className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.label} className="grid gap-1.5 rounded-xl bg-card px-4 py-3 shadow-xs">
          <span className="text-[0.625rem] font-medium text-title">{tile.label}</span>
          <span className="text-2xl leading-8 font-medium text-title">
            {formatScore(tile.value)}
            <span className="text-xs font-normal text-grey"> / {formatNumber(max)}</span>
          </span>
          <ProgressBar
            value={tile.value}
            max={max}
            label={`${tile.label} on the rating scale`}
            text={tile.value === null ? '—' : formatScore(tile.value)}
          />
          <span className="text-[0.625rem] text-grey">{tile.note}</span>
        </li>
      ))}
    </ul>
  )
}

function RatingCell({
  scale,
  rating,
  comment,
}: {
  scale: readonly ScaleLevel[]
  rating: number | null
  comment: string | null
}) {
  return (
    <span className="grid gap-0.5">
      <span className={cn('font-medium', rating === null && 'font-normal text-grey')}>
        {ratingText(scale, rating)}
      </span>
      {comment && <span className="text-[0.6875rem] leading-snug text-grey">{comment}</span>}
    </span>
  )
}

/** The criteria with the self and manager ratings side by side. */
export function RatingsTable({ appraisal }: { appraisal: AppraisalDetail }) {
  const columns: DataTableColumn<RatingRow>[] = [
    {
      id: 'criterion',
      header: 'Criterion',
      mobile: 'heading',
      className: 'min-w-44 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="font-medium">{row.name}</span>
          {row.kpiName && <span className="text-[0.625rem] text-grey">KPI: {row.kpiName}</span>}
        </span>
      ),
    },
    {
      id: 'weight',
      header: 'Weight',
      align: 'right',
      cell: (row) => `${formatNumber(row.weight)}%`,
    },
    ...(appraisal.hasSelfReview
      ? [
          {
            id: 'self',
            header: 'Self Review',
            className: 'min-w-44 whitespace-normal',
            cell: (row: RatingRow) => (
              <RatingCell
                scale={appraisal.scale}
                rating={row.selfRating}
                comment={row.selfComment}
              />
            ),
          },
        ]
      : []),
    {
      id: 'manager',
      header: 'Manager Review',
      className: 'min-w-44 whitespace-normal',
      cell: (row) => (
        <RatingCell
          scale={appraisal.scale}
          rating={row.managerRating}
          comment={row.managerComment}
        />
      ),
    },
  ]
  return (
    <div className={tableClass}>
      <DataTable
        caption="Ratings by criterion"
        columns={columns}
        data={appraisal.ratings}
        getRowId={(row) => row.criterionId}
        emptyState="The appraisal form has no criteria."
      />
    </div>
  )
}

/** The employee's goals in the cycle with their progress. */
export function AppraisalGoals({ appraisal }: { appraisal: AppraisalDetail }) {
  if (appraisal.goals.length === 0) {
    return <EmptyNote>No goals in this cycle.</EmptyNote>
  }
  return (
    <ul aria-label="Goals in this cycle" className="grid gap-2">
      {appraisal.goals.map((goal) => (
        <li
          key={goal.id}
          className="grid gap-2 rounded-lg border border-[#E6E9F0] px-3 py-2.5 @lg:grid-cols-[minmax(0,1fr)_12rem_auto] @lg:items-center dark:border-border"
        >
          <span className="grid min-w-0 gap-0.5">
            <span className="text-sm font-medium text-title">{goal.title}</span>
            <span className="text-[0.6875rem] text-grey">
              Due {formatDate(goal.dueDate)} · weight {formatNumber(goal.weight)}%
            </span>
          </span>
          <ProgressBar value={goal.progress} label={`Progress of ${goal.title}`} />
          <GoalStatusChips status={goal.status} />
        </li>
      ))}
    </ul>
  )
}

/** Self comments, manager comments, development needs, the outcome and final comments. */
export function AppraisalNotes({ appraisal }: { appraisal: AppraisalDetail }) {
  const increment = appraisal.increment
  const notes = [
    ...(appraisal.hasSelfReview
      ? [{ title: 'Self Review Comments', text: appraisal.selfComments }]
      : []),
    { title: 'Manager Comments', text: appraisal.managerComments },
    { title: 'Development Needs', text: appraisal.developmentNeeds },
    ...(appraisal.status === 'finalised'
      ? [
          {
            title: 'Outcome',
            text: [
              labelOf(OUTCOME_LABELS, appraisal.outcome) || 'No Change',
              increment
                ? `${labelOf(CHANGE_TYPE_LABELS, increment.changeType)} ${
                    increment.changeType === 'percent'
                      ? `${formatNumber(increment.changeValue)}%`
                      : formatNumber(increment.changeValue)
                  } from ${formatDate(increment.effectiveDate)} (${increment.status})`
                : null,
              appraisal.finalComments,
            ]
              .filter(Boolean)
              .join(' — '),
          },
        ]
      : []),
  ]
  return (
    <div className="grid gap-3 @lg:grid-cols-2">
      {notes.map((note) => (
        <SectionCard key={note.title} title={note.title} as="h3">
          <p className={cn('text-sm whitespace-pre-line', note.text ? 'text-title' : 'text-grey')}>
            {note.text ?? 'Nothing written.'}
          </p>
        </SectionCard>
      ))}
    </div>
  )
}
