import { type DragEvent, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { CalendarClock, Star } from 'lucide-react'

import { type RowAction, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusChip } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { BOARD_COLUMN_SIZE, OFFER_STATUS_META, STAGE_COLOUR, STAGE_META } from '../../constants'
import { applicationsQueryOptions } from '../../hooks/recruitment.keys'
import {
  type Application,
  type ApplicationFilters,
  MOVE_STAGES,
  type MoveStage,
  type Stage,
} from '../../types/recruitment.types'
import { formatDay, formatRating, formatStamp } from '../../utils/format'
import { isClosedStage } from '../../utils/stages'
import { ListError } from '../shared/list-parts'

const isMoveStage = (stage: Stage): stage is MoveStage =>
  (MOVE_STAGES as readonly string[]).includes(stage)

function Card({
  application,
  draggable,
  onOpen,
  actions,
  onDragStart,
  onDragEnd,
}: {
  application: Application
  draggable: boolean
  onOpen: () => void
  actions: RowAction[]
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <li
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', application.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'grid gap-1.5 rounded-lg border bg-card p-3 shadow-xs',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 rounded-sm text-left text-sm font-medium break-words text-heading underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {application.applicantName}
        </button>
        {actions.length > 0 && (
          <span className="-mt-1 -mr-1 shrink-0">
            <RowActionsMenu
              label={`Actions for ${application.applicantName}, ${application.jobOpeningTitle}`}
              itemClassName={rowMenuItemClass.inter}
              actions={actions}
            />
          </span>
        )}
      </div>
      <p className="text-xs break-words text-field-foreground">{application.jobOpeningTitle}</p>
      <p className="text-xs text-muted-foreground">Applied {formatDay(application.appliedOn)}</p>
      {(application.nextInterviewAt !== null || application.averageRating !== null) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-field-foreground">
          {application.nextInterviewAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Next interview</span>
              {formatStamp(application.nextInterviewAt)}
            </span>
          )}
          {application.averageRating !== null && (
            <span className="inline-flex items-center gap-1">
              <Star aria-hidden="true" className="size-3.5" />
              <span className="sr-only">Rating</span>
              {formatRating(application.averageRating)}
            </span>
          )}
        </p>
      )}
      {application.latestOfferStatus && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Offer <StatusChip {...OFFER_STATUS_META[application.latestOfferStatus]} />
        </span>
      )}
    </li>
  )
}

/**
 * The pipeline as a board: one column per stage with its count, the cards newest first and
 * "Show more" for the rest (each column is its own `stage=` read). A card's ⋮ moves it to any other
 * stage from the keyboard (and has every action); on a pointer device cards can also be dragged
 * onto a column. Dropping on Rejected, Withdrawn or Hired opens that step's dialog.
 */
export function PipelineBoard({
  filters,
  stages,
  onOpen,
  actionsFor,
  canMove,
  onMove,
  onDropClosed,
}: {
  filters: Omit<ApplicationFilters, 'stage'>
  stages: readonly Stage[]
  onOpen: (application: Application) => void
  actionsFor: (application: Application) => RowAction[]
  canMove: boolean
  /** Straight to another stage (menu item or drop). */
  onMove: (application: Application, stage: MoveStage) => void
  /** Dropped on Rejected / Withdrawn / Hired: open that dialog. */
  onDropClosed: (application: Application, stage: 'rejected' | 'withdrawn' | 'hired') => void
}) {
  const [limits, setLimits] = useState<Partial<Record<Stage, number>>>({})
  const [over, setOver] = useState<Stage | null>(null)
  const dragging = useRef<Application | null>(null)
  const columns = useQueries({
    queries: stages.map((stage) =>
      applicationsQueryOptions({
        ...filters,
        stage,
        page: 1,
        pageSize: limits[stage] ?? BOARD_COLUMN_SIZE,
      }),
    ),
  })
  const failed = columns.find((column) => column.isError)
  if (failed) {
    return (
      <ListError
        error={failed.error}
        what="the pipeline"
        onRetry={() => {
          for (const column of columns) if (column.isError) void column.refetch()
        }}
      />
    )
  }

  const moveItems = (application: Application): RowAction[] =>
    canMove && !isClosedStage(application)
      ? MOVE_STAGES.filter((stage) => stage !== application.stage).map((stage) => ({
          label: `Move to ${STAGE_META[stage].label}`,
          onSelect: () => {
            onMove(application, stage)
          },
        }))
      : []

  const canDropOn = (stage: Stage) => {
    const application = dragging.current
    return !!application && !isClosedStage(application) && application.stage !== stage
  }
  const drop = (event: DragEvent, stage: Stage) => {
    event.preventDefault()
    setOver(null)
    const application = dragging.current
    dragging.current = null
    if (!application || !canDropOn(stage)) return
    if (isMoveStage(stage)) onMove(application, stage)
    else onDropClosed(application, stage)
  }

  return (
    <div
      className="relative min-w-0 overflow-x-auto pb-2"
      role="region"
      aria-label="Pipeline board"
      tabIndex={-1}
    >
      <div className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3">
        {stages.map((stage, index) => {
          const column = columns[index]
          const rows = column?.data?.data ?? []
          const total = column?.data?.meta.total ?? 0
          const headingId = `board-${stage}`
          return (
            <section
              key={stage}
              aria-labelledby={headingId}
              onDragOver={(event) => {
                if (!canDropOn(stage)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setOver(stage)
              }}
              onDragLeave={() => {
                setOver((current) => (current === stage ? null : current))
              }}
              onDrop={(event) => {
                drop(event, stage)
              }}
              className={cn(
                'grid min-h-40 content-start gap-2 rounded-lg bg-muted/60 p-2 transition-colors dark:bg-muted/30',
                over === stage && 'ring-2 ring-primary/60',
              )}
            >
              <header className="grid gap-1.5 px-1 pt-1">
                <span
                  aria-hidden="true"
                  className="h-1 rounded-full"
                  style={{ background: STAGE_COLOUR[stage] }}
                />
                <h3
                  id={headingId}
                  className="flex items-center justify-between gap-2 text-sm font-semibold text-heading"
                >
                  {STAGE_META[stage].label}
                  <span className="rounded-full bg-card px-2 text-xs font-medium text-field-foreground tabular-nums">
                    {column?.isPending ? '…' : total}
                    <span className="sr-only">
                      {total === 1 ? ' application' : ' applications'}
                    </span>
                  </span>
                </h3>
              </header>
              {column?.isPending ? (
                <div aria-busy="true" className="grid gap-2">
                  <span className="sr-only">Loading {STAGE_META[stage].label}</span>
                  <Skeleton className="h-20 w-full bg-card" />
                  <Skeleton className="h-20 w-full bg-card" />
                </div>
              ) : rows.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  No applications
                </p>
              ) : (
                <ul aria-label={`${STAGE_META[stage].label} applications`} className="grid gap-2">
                  {rows.map((application) => (
                    <Card
                      key={application.id}
                      application={application}
                      draggable={canMove && !isClosedStage(application)}
                      onOpen={() => {
                        onOpen(application)
                      }}
                      actions={[...moveItems(application), ...actionsFor(application)]}
                      onDragStart={() => {
                        dragging.current = application
                      }}
                      onDragEnd={() => {
                        dragging.current = null
                        setOver(null)
                      }}
                    />
                  ))}
                </ul>
              )}
              {total > rows.length && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={column?.isFetching}
                  onClick={() => {
                    setLimits((current) => ({
                      ...current,
                      [stage]: (current[stage] ?? BOARD_COLUMN_SIZE) + BOARD_COLUMN_SIZE,
                    }))
                  }}
                  className="h-8 text-xs"
                >
                  Show more ({total - rows.length})
                </Button>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
