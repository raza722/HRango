import { type DragEvent, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { CalendarClock, Hand, LoaderCircle, Star } from 'lucide-react'

import { PanScroll, type RowAction, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
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

type ClosedStage = Exclude<Stage, MoveStage>

const isMoveStage = (stage: Stage): stage is MoveStage =>
  (MOVE_STAGES as readonly string[]).includes(stage)

/** What dropping on a closing column does: each opens its dialog first. */
const CLOSE_VERB: Record<ClosedStage, string> = {
  hired: 'Hire',
  rejected: 'Reject',
  withdrawn: 'Withdraw',
}

/** How near the board's side (px) a dragged card scrolls it, and the most it scrolls per step. */
const EDGE = 72
const EDGE_SPEED = 28

interface PendingMove {
  application: Application
  to: MoveStage
}

function Card({
  application,
  draggable,
  lifted,
  moving,
  onOpen,
  actions,
  onDragStart,
  onDragEnd,
}: {
  application: Application
  draggable: boolean
  /** Being dragged: its place shows as a faded outline. */
  lifted: boolean
  /** Moved, waiting for the server: shown in its new column, not movable yet. */
  moving: boolean
  onOpen: () => void
  actions: RowAction[]
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <li
      draggable={draggable}
      aria-busy={moving || undefined}
      onDragStart={(event) => {
        const transfer = event.dataTransfer as DataTransfer | null
        transfer?.setData('text/plain', application.id)
        if (transfer) transfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'grid gap-1.5 rounded-lg border bg-card p-3 shadow-xs transition-[box-shadow,translate,opacity,border-color] duration-200 ease-out-soft',
        draggable && 'cursor-grab hover:-translate-y-0.5 hover:shadow-lift active:cursor-grabbing',
        lifted && 'translate-y-0! border-dashed border-primary/50 opacity-40 shadow-none!',
        moving && 'opacity-70',
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
        {moving ? (
          <span className="mt-0.5 shrink-0 text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            <span className="sr-only">Moving to {STAGE_META[application.stage].label}</span>
          </span>
        ) : (
          actions.length > 0 && (
            <span className="-mt-1 -mr-1 shrink-0">
              <RowActionsMenu
                label={`Actions for ${application.applicantName}, ${application.jobOpeningTitle}`}
                itemClassName={rowMenuItemClass.inter}
                actions={actions}
              />
            </span>
          )
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
 * "Show more" for the rest (each column is its own `stage=` read). On a mouse or trackpad screen a
 * card drags onto any other column: the columns it can go to are outlined, the one under it shows
 * where it lands, and the board scrolls when the card nears its side. A move shows at once (with
 * a spinner until the server confirms it, and goes back if it fails); dropping on Rejected,
 * Withdrawn or Hired opens that step's dialog. A card's ⋮ moves it too (keyboard and touch).
 * Dragging empty space scrolls the board sideways (PanScroll).
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
  /** Straight to another stage (menu item or drop); settles once the board has the change. */
  onMove: (application: Application, stage: MoveStage) => Promise<unknown>
  /** Dropped on Rejected / Withdrawn / Hired: open that dialog. */
  onDropClosed: (application: Application, stage: ClosedStage) => void
}) {
  const [limits, setLimits] = useState<Partial<Record<Stage, number>>>({})
  const [over, setOver] = useState<Stage | null>(null)
  // The card being dragged: the ref answers dragover straight away, the state redraws the columns.
  const dragged = useRef<Application | null>(null)
  const [lifted, setLifted] = useState<Application | null>(null)
  const [pending, setPending] = useState<ReadonlyMap<string, PendingMove>>(() => new Map())
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

  const move = (application: Application, stage: MoveStage) => {
    setPending((current) => new Map(current).set(application.id, { application, to: stage }))
    onMove(application, stage)
      // The mutation says what went wrong; the card goes back to where it was.
      .catch(() => undefined)
      .finally(() => {
        setPending((current) => {
          const next = new Map(current)
          next.delete(application.id)
          return next
        })
      })
  }

  const moveItems = (application: Application): RowAction[] =>
    canMove && !isClosedStage(application)
      ? MOVE_STAGES.filter((stage) => stage !== application.stage).map((stage) => ({
          label: `Move to ${STAGE_META[stage].label}`,
          onSelect: () => {
            move(application, stage)
          },
        }))
      : []

  const canDropOn = (stage: Stage) => {
    const application = dragged.current
    return !!application && !isClosedStage(application) && application.stage !== stage
  }
  const lift = (application: Application) => {
    dragged.current = application
    // A tick later, so the browser's drag image is the card itself, not its faded placeholder.
    window.setTimeout(() => {
      if (dragged.current === application) setLifted(application)
    }, 0)
  }
  const endDrag = () => {
    dragged.current = null
    setLifted(null)
    setOver(null)
  }
  const drop = (event: DragEvent, stage: Stage) => {
    event.preventDefault()
    const application = dragged.current
    const allowed = canDropOn(stage)
    endDrag()
    if (!application || !allowed) return
    if (isMoveStage(stage)) move(application, stage)
    else onDropClosed(application, stage)
  }
  // Near the board's left or right side a dragged card scrolls it, faster the closer it gets.
  const scrollNearEdge = (event: DragEvent<HTMLDivElement>) => {
    if (!dragged.current) return
    const box = event.currentTarget
    const { left, right } = box.getBoundingClientRect()
    const fromLeft = event.clientX - left
    const fromRight = right - event.clientX
    if (fromLeft < EDGE) box.scrollLeft -= Math.ceil(((EDGE - fromLeft) / EDGE) * EDGE_SPEED)
    else if (fromRight < EDGE) box.scrollLeft += Math.ceil(((EDGE - fromRight) / EDGE) * EDGE_SPEED)
  }

  const waiting = [...pending.values()]

  return (
    <div className="grid min-w-0 gap-2">
      {canMove && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Hand aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="hidden pointer-fine:inline">
            Drag a card onto another stage to move it, or use its ⋮ menu. Drag empty space to scroll
            sideways.
          </span>
          <span className="pointer-fine:hidden">
            Use a card&apos;s ⋮ menu to move it to another stage.
          </span>
        </p>
      )}
      <PanScroll
        className="pb-2"
        role="region"
        aria-label="Pipeline board"
        tabIndex={-1}
        edges
        onDragOver={scrollNearEdge}
      >
        <div className="grid auto-cols-[minmax(15rem,1fr)] grid-flow-col gap-3">
          {stages.map((stage, index) => {
            const column = columns[index]
            const loaded = column?.data?.data ?? []
            // Moves still on their way: out of the column they left, at the top of the new one.
            const leaving = loaded.filter((row) => {
              const entry = pending.get(row.id)
              return entry !== undefined && entry.to !== stage
            })
            const arriving = waiting
              .filter(
                (entry) =>
                  entry.to === stage && !loaded.some((row) => row.id === entry.application.id),
              )
              .map((entry) => ({ ...entry.application, stage: entry.to }))
            const rows = [...arriving, ...loaded.filter((row) => !leaving.includes(row))]
            const total = (column?.data?.meta.total ?? 0) - leaving.length + arriving.length
            const headingId = `board-${stage}`
            const accepts = lifted !== null && lifted.stage !== stage
            const hovered = accepts && over === stage
            return (
              <section
                key={stage}
                aria-labelledby={headingId}
                onDragOver={(event) => {
                  if (!canDropOn(stage)) return
                  event.preventDefault()
                  const transfer = event.dataTransfer as DataTransfer | null
                  if (transfer) transfer.dropEffect = 'move'
                  setOver(stage)
                }}
                onDragLeave={(event) => {
                  // Passing over a card inside the column is not leaving it.
                  const into = event.relatedTarget
                  if (into instanceof Node && event.currentTarget.contains(into)) return
                  setOver((current) => (current === stage ? null : current))
                }}
                onDrop={(event) => {
                  drop(event, stage)
                }}
                className={cn(
                  'grid min-h-40 content-start gap-2 rounded-lg bg-muted/60 p-2 transition-[background-color,outline-color] duration-200 dark:bg-muted/30',
                  accepts && 'outline-2 -outline-offset-2 outline-primary/30 outline-dashed',
                  hovered &&
                    'bg-primary/[0.07] outline-primary/70 outline-solid dark:bg-primary/15',
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
                {hovered && (
                  <p
                    aria-hidden="true"
                    className="grid h-14 animate-in place-items-center rounded-lg border-2 border-dashed border-primary/50 bg-card/70 text-xs font-medium text-primary duration-150 fade-in-0 zoom-in-95"
                  >
                    {isMoveStage(stage)
                      ? `Move to ${STAGE_META[stage].label}`
                      : `${CLOSE_VERB[stage]}…`}
                  </p>
                )}
                {column?.isPending ? (
                  <div aria-busy="true" className="grid gap-2">
                    <span className="sr-only">Loading {STAGE_META[stage].label}</span>
                    <Skeleton className="h-20 w-full bg-card" />
                    <Skeleton className="h-20 w-full bg-card" />
                  </div>
                ) : rows.length === 0 ? (
                  !hovered && (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                      {accepts ? 'Drop here' : 'No applications'}
                    </p>
                  )
                ) : (
                  <ul aria-label={`${STAGE_META[stage].label} applications`} className="grid gap-2">
                    {rows.map((application) => {
                      const moving = pending.has(application.id)
                      return (
                        <Card
                          key={application.id}
                          application={application}
                          draggable={canMove && !moving && !isClosedStage(application)}
                          lifted={lifted?.id === application.id}
                          moving={moving}
                          onOpen={() => {
                            onOpen(application)
                          }}
                          actions={[...moveItems(application), ...actionsFor(application)]}
                          onDragStart={() => {
                            lift(application)
                          }}
                          onDragEnd={endDrag}
                        />
                      )
                    })}
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
      </PanScroll>
    </div>
  )
}
