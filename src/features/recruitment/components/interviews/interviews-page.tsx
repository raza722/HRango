import { useId, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import { Clock, MapPin, Users } from 'lucide-react'

import { type RowAction, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  btn,
  DateInput,
  EmployeeSearchSelect,
  ListFooter,
  PayrollCard,
  SearchSelect,
  StatusChip,
  toolbarButton,
} from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_PAGE_SIZE,
  INTERVIEW_RESULT_META,
  INTERVIEW_STATUS_META,
  RC_CODES,
} from '../../constants'
import { useOpeningOptions } from '../../hooks/use-lookups'
import { useCancelInterview, useInterview, useInterviews } from '../../hooks/use-recruitment'
import type { InterviewsSearch } from '../../routing'
import { type Interview, INTERVIEW_STATUSES } from '../../types/recruitment.types'
import { dateOf, formatRating, formatTime, labelOf } from '../../utils/format'
import { DetailDialog } from '../shared/dialog-parts'
import { CandidateCell } from '../shared/fields'
import {
  EmptyNote,
  FilterBar,
  FilterField,
  ListError,
  SearchBox,
  StatusFilterChips,
} from '../shared/list-parts'
import { RemarksDialog } from '../shared/remarks-dialog'
import { Segmented } from '../shared/segmented'
import { InterviewDetailDialog } from './interview-detail-dialog'
import { CompleteDialog, EvaluationDialog } from './interview-dialogs'
import { InterviewFormDialog } from './interview-form-dialog'

const routeApi = getRouteApi('/_app/recruitment/interviews')

type Kind = 'edit' | 'complete' | 'evaluate' | 'cancel'

/** "Today", "Tomorrow", "Yesterday" or "Monday, 3 November 2026". */
function dayLabel(date: Date): string {
  const long = format(date, 'EEEE, d MMMM yyyy')
  if (isToday(date)) return `Today · ${long}`
  if (isTomorrow(date)) return `Tomorrow · ${long}`
  if (isYesterday(date)) return `Yesterday · ${long}`
  return long
}

function groupByDay(rows: readonly Interview[]) {
  const groups: { key: string; label: string; rows: Interview[] }[] = []
  for (const row of rows) {
    const date = dateOf(row.scheduledAt)
    const key = date ? format(date, 'yyyy-MM-dd') : 'unknown'
    let group = groups.find((item) => item.key === key)
    if (!group) {
      group = { key, label: date ? dayLabel(date) : 'No date', rows: [] }
      groups.push(group)
    }
    group.rows.push(row)
  }
  return groups
}

/** Evaluate needs the panel: read the interview first. */
function EvaluateFromRow({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useInterview(id)
  if (!detail.data) {
    return (
      <DetailDialog
        title="Evaluate Interview"
        onClose={onClose}
        loading={detail.isPending}
        error={detail.error}
        onRetry={() => void detail.refetch()}
        what="the interview"
      >
        {null}
      </DetailDialog>
    )
  }
  return <EvaluationDialog interview={detail.data} onClose={onClose} />
}

/**
 * Interviews: every round, grouped by day, with All / Mine (where you are on the panel), status
 * chips and filters (search, interviewer, opening, dates). Each row's ⋮ (and the detail) has Edit,
 * Complete, Evaluate and Cancel while it is scheduled; a completed one can still be evaluated.
 */
export function InterviewsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(RC_CODES.interviewsCreate)
  const canEdit = useCan(RC_CODES.interviewsEdit)
  const canCancel = useCan(RC_CODES.interviewsCancel)
  const canComplete = useCan(RC_CODES.interviewsComplete)
  const canEvaluate = useCan(RC_CODES.interviewsEvaluate)
  const openings = useOpeningOptions()
  const cancel = useCancelInterview()
  const [current, setCurrent] = useState<{ kind: Kind; interview: Interview } | null>(null)
  const headingId = useId()

  // Upcoming by default; a finished status, a From date or "All dates" shows the history.
  const [today] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const upcomingOnly =
    !search.past && !search.fromDate && (!search.status || search.status === 'scheduled')
  const list = useInterviews({
    q: search.q,
    mine: search.mine,
    status: search.status,
    interviewerId: search.interviewerId,
    jobOpeningId: search.jobOpeningId,
    fromDate: upcomingOnly ? today : search.fromDate,
    toDate: search.toDate,
    page: search.page,
    pageSize: INTERVIEW_PAGE_SIZE,
  })
  const update = (patch: Partial<InterviewsSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  const filter = (patch: Partial<InterviewsSearch>) => {
    update({ ...patch, page: 1 })
  }
  const active = [
    search.q,
    search.interviewerId,
    search.jobOpeningId,
    search.fromDate,
    search.toDate,
  ].filter(Boolean).length

  const actionsFor = (interview: Interview): RowAction[] => {
    const open = (kind: Kind) => () => {
      setCurrent({ kind, interview })
    }
    const items: RowAction[] = []
    if (interview.status === 'scheduled') {
      if (canEdit) items.push({ label: 'Edit', onSelect: open('edit') })
      if (canComplete) items.push({ label: 'Complete', onSelect: open('complete') })
    }
    if (canEvaluate && (interview.status === 'scheduled' || interview.status === 'completed')) {
      items.push({ label: 'Evaluate', onSelect: open('evaluate') })
    }
    if (interview.status === 'scheduled' && canCancel) {
      items.push({ label: 'Cancel Interview', variant: 'destructive', onSelect: open('cancel') })
    }
    return items
  }
  const close = () => {
    setCurrent(null)
  }
  const rows = list.data?.data ?? []
  const groups = groupByDay(rows)

  return (
    <PayrollCard
      title="Interviews"
      actions={
        <>
          <Segmented
            label="Whose interviews"
            value={search.mine ? 'mine' : 'all'}
            options={[
              { value: 'all', label: 'All' },
              { value: 'mine', label: 'Mine' },
            ]}
            onChange={(value) => {
              filter({ mine: value === 'mine' || undefined })
            }}
          />
          <Segmented
            label="Which dates"
            value={search.past ? 'all' : 'upcoming'}
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'all', label: 'All dates' },
            ]}
            onChange={(value) => {
              filter({ past: value === 'all' || undefined })
            }}
          />
          {canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'create', view: undefined })
              }}
              className={cn(toolbarButton, btn.navy)}
            >
              + Schedule Interview
            </Button>
          )}
        </>
      }
    >
      <StatusFilterChips
        label="Interview status"
        options={INTERVIEW_STATUSES.map((value) => ({
          value,
          label: INTERVIEW_STATUS_META[value].label,
        }))}
        value={search.status}
        onChange={(status) => {
          filter({ status })
        }}
      />
      <FilterBar
        label="Filter interviews"
        active={active}
        onClear={() => {
          filter({
            q: undefined,
            interviewerId: undefined,
            jobOpeningId: undefined,
            fromDate: undefined,
            toDate: undefined,
          })
        }}
      >
        <FilterField label="Search">
          {(id) => (
            <SearchBox
              key={search.q ?? ''}
              id={id}
              value={search.q}
              label="Search interviews"
              placeholder="Candidate, opening or title"
              onSearch={(q) => {
                filter({ q })
              }}
            />
          )}
        </FilterField>
        <FilterField label="Interviewer">
          {(id) => (
            <EmployeeSearchSelect
              id={id}
              value={search.interviewerId ?? null}
              onChange={(value) => {
                filter({ interviewerId: value ?? undefined })
              }}
              filters={{ permission: RC_CODES.people }}
              placeholder="Anyone"
              clearable
            />
          )}
        </FilterField>
        <FilterField label="Job Opening">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.jobOpeningId ?? null}
              onChange={(value) => {
                filter({ jobOpeningId: value ?? undefined })
              }}
              options={openings.options}
              placeholder="All openings"
              clearable
            />
          )}
        </FilterField>
        <div className="grid grid-cols-2 gap-3">
          <FilterField label="From">
            {(id) => (
              <DateInput
                id={id}
                value={search.fromDate ?? ''}
                onChange={(value) => {
                  filter({ fromDate: value || undefined })
                }}
                display="d MMM yyyy"
                placeholder="Any day"
              />
            )}
          </FilterField>
          <FilterField label="To">
            {(id) => (
              <DateInput
                id={id}
                value={search.toDate ?? ''}
                onChange={(value) => {
                  filter({ toDate: value || undefined })
                }}
                display="d MMM yyyy"
                placeholder="Any day"
              />
            )}
          </FilterField>
        </div>
      </FilterBar>

      {list.isError ? (
        <ListError error={list.error} what="interviews" onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <div aria-busy="true" className="grid gap-3">
          <span className="sr-only">Loading interviews</span>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyNote>
          {active > 0 || search.status || search.mine
            ? 'No interviews match the filters.'
            : 'No interviews yet. Schedule one from an application.'}
        </EmptyNote>
      ) : (
        <div
          aria-labelledby={headingId}
          className={cn(
            '@container grid gap-5 transition-opacity',
            list.isFetching && 'opacity-60',
          )}
        >
          <h2 id={headingId} className="sr-only">
            Interviews by day
          </h2>
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="grid gap-2">
              <h3 className="text-sm font-semibold text-heading">{group.label}</h3>
              <ul aria-label={`Interviews on ${group.label}`} className="grid gap-2">
                {group.rows.map((row) => {
                  const items = actionsFor(row)
                  return (
                    <li
                      key={row.id}
                      className="grid gap-3 rounded-lg border bg-card p-3 @2xl:grid-cols-[6.5rem_minmax(0,1fr)_auto] @2xl:items-center"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium text-heading tabular-nums">
                        <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
                        {formatTime(row.scheduledAt)}
                        <span className="text-xs font-normal text-muted-foreground">
                          {row.durationMinutes}m
                        </span>
                      </span>
                      <span className="grid min-w-0 gap-1">
                        <button
                          type="button"
                          aria-label={`Open the interview with ${row.applicantName}, round ${String(row.roundNo)}`}
                          onClick={() => {
                            update({ view: row.id })
                          }}
                          className="w-fit max-w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <CandidateCell
                            name={row.applicantName}
                            detail={`${row.jobOpeningTitle} · round ${String(row.roundNo)}, ${row.title}`}
                          />
                        </button>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-field-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin aria-hidden="true" className="size-3.5" />
                            {labelOf(INTERVIEW_MODE_LABELS, row.mode)}
                            {row.venue ? ` · ${row.venue}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users aria-hidden="true" className="size-3.5" />
                            <span className="sr-only">Interviewers:</span>
                            {row.interviewerNames ?? '—'}
                          </span>
                          {row.evaluationCount > 0 && (
                            <span>
                              Rating {formatRating(row.averageRating)} ({row.evaluationCount}/
                              {row.interviewerCount})
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2 @2xl:justify-end">
                        <StatusChip {...INTERVIEW_STATUS_META[row.status]} />
                        {row.result && <StatusChip {...INTERVIEW_RESULT_META[row.result]} />}
                        {items.length > 0 && (
                          <RowActionsMenu
                            label={`Actions for the interview with ${row.applicantName}, round ${String(row.roundNo)}`}
                            itemClassName={rowMenuItemClass.inter}
                            actions={items}
                          />
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ListFooter
        meta={list.data?.meta}
        noun="interviews"
        disabled={list.isFetching}
        onPageChange={(page) => {
          update({ page })
        }}
      />

      {search.view && (
        <InterviewDetailDialog
          id={search.view}
          onClose={() => {
            update({ view: undefined })
          }}
          actionsFor={actionsFor}
        />
      )}
      {search.dialog === 'create' && (
        <InterviewFormDialog
          id={null}
          onClose={() => {
            update({ dialog: undefined })
          }}
          onSaved={(saved) => {
            update({ dialog: undefined, view: saved.id })
          }}
        />
      )}
      {current?.kind === 'edit' && (
        <InterviewFormDialog id={current.interview.id} onClose={close} />
      )}
      {current?.kind === 'complete' && (
        <CompleteDialog interview={current.interview} onClose={close} />
      )}
      {current?.kind === 'evaluate' && (
        <EvaluateFromRow id={current.interview.id} onClose={close} />
      )}
      {current?.kind === 'cancel' && (
        <RemarksDialog
          title="Cancel Interview"
          intro={`Cancel round ${String(current.interview.roundNo)} with ${current.interview.applicantName}? The panel no longer sees it as scheduled.`}
          label="Reason"
          requiredMessage="Say why it is cancelled"
          saveLabel="Cancel Interview"
          saving={cancel.isPending}
          onSubmit={(remarks) => cancel.mutateAsync({ record: current.interview, remarks })}
          onClose={close}
        />
      )}
    </PayrollCard>
  )
}
