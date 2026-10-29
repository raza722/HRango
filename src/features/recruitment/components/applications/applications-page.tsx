import { useId } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Columns3, List } from 'lucide-react'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  btn,
  DateInput,
  ListFooter,
  PayrollCard,
  payrollTableClass,
  SearchSelect,
  StatusChip,
  toolbarButton,
} from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  OFFER_STATUS_META,
  RC_CODES,
  RC_PAGE_SIZE,
  SOURCE_LABELS,
  STAGE_META,
} from '../../constants'
import { useOpeningOptions } from '../../hooks/use-lookups'
import { useApplications, useMoveApplication } from '../../hooks/use-recruitment'
import type { ApplicationsSearch } from '../../routing'
import { type Application, MOVE_STAGES, STAGES } from '../../types/recruitment.types'
import { formatDay, formatRating, formatStamp, labelOf } from '../../utils/format'
import { CandidateCell } from '../shared/fields'
import { FilterBar, FilterField, ListError, SearchBox } from '../shared/list-parts'
import { Segmented } from '../shared/segmented'
import { ApplicationDetailDialog } from './application-detail-dialog'
import { NewApplicationDialog } from './application-dialogs'
import { PipelineBoard } from './pipeline-board'
import { useApplicationActions } from './use-application-actions'

const routeApi = getRouteApi('/_app/recruitment/applications')

const STAGE_OPTIONS = STAGES.map((value) => ({ value, label: STAGE_META[value].label }))

/**
 * Applications, the pipeline: a board with a column per stage (move a card from its ⋮ menu or by
 * dragging it) or a paged list, both filtered by search, opening, stage, active only and the
 * applied dates. Every action (Move, Schedule Interview, Make Offer, Hire, Reject, Withdraw,
 * Delete) is in the card's or row's menu and in the application's detail. All of it is in the URL.
 */
export function ApplicationsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(RC_CODES.applicationsCreate)
  const openings = useOpeningOptions()
  const move = useMoveApplication()
  const activeId = useId()
  const update = (patch: Partial<ApplicationsSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  const filter = (patch: Partial<ApplicationsSearch>) => {
    update({ ...patch, page: 1 })
  }
  const openDetail = (id: string) => {
    update({ view: id, tab: 'overview' })
  }
  const actions = useApplicationActions({ onOpenDetail: openDetail })

  const filters = {
    q: search.q,
    jobOpeningId: search.jobOpeningId,
    applicantId: search.applicantId,
    activeOnly: search.activeOnly,
    fromDate: search.fromDate,
    toDate: search.toDate,
  }
  const listMode = search.mode === 'list'
  const list = useApplications(
    { ...filters, stage: search.stage, page: search.page, pageSize: RC_PAGE_SIZE },
    listMode,
  )
  const active = [
    search.q,
    search.jobOpeningId,
    search.applicantId,
    search.stage,
    search.activeOnly,
    search.fromDate,
    search.toDate,
  ].filter(Boolean).length

  const stages = search.stage ? [search.stage] : search.activeOnly ? [...MOVE_STAGES] : [...STAGES]

  const columns: DataTableColumn<Application>[] = [
    {
      id: 'candidate',
      header: 'Candidate',
      mobile: 'heading',
      className: 'min-w-48',
      cell: (row) => (
        <button
          type="button"
          aria-label={`Open ${row.applicantName}'s application for ${row.jobOpeningTitle}`}
          onClick={() => {
            openDetail(row.id)
          }}
          className="w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <CandidateCell name={row.applicantName} detail={row.applicantEmail} />
        </button>
      ),
    },
    {
      id: 'opening',
      header: 'Opening',
      className: 'min-w-36 whitespace-normal',
      cell: (row) => row.jobOpeningTitle,
    },
    { id: 'stage', header: 'Stage', cell: (row) => <StatusChip {...STAGE_META[row.stage]} /> },
    { id: 'applied', header: 'Applied', cell: (row) => formatDay(row.appliedOn) },
    {
      id: 'next',
      header: 'Next Interview',
      cell: (row) => formatStamp(row.nextInterviewAt),
    },
    { id: 'rating', header: 'Rating', cell: (row) => formatRating(row.averageRating) },
    {
      id: 'offer',
      header: 'Offer',
      cell: (row) =>
        row.latestOfferStatus ? <StatusChip {...OFFER_STATUS_META[row.latestOfferStatus]} /> : '—',
    },
    { id: 'source', header: 'Source', cell: (row) => labelOf(SOURCE_LABELS, row.source) },
  ]

  return (
    <PayrollCard
      title="Applications"
      actions={
        <>
          <Segmented
            label="View"
            value={search.mode}
            options={[
              {
                value: 'board',
                label: 'Board',
                icon: <Columns3 aria-hidden="true" className="size-3.5" />,
              },
              {
                value: 'list',
                label: 'List',
                icon: <List aria-hidden="true" className="size-3.5" />,
              },
            ]}
            onChange={(mode) => {
              update({ mode, page: 1 })
            }}
          />
          {canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'create', view: undefined })
              }}
              className={cn(toolbarButton, btn.navy)}
            >
              + New Application
            </Button>
          )}
        </>
      }
    >
      <FilterBar
        label="Filter applications"
        active={active}
        onClear={() => {
          filter({
            q: undefined,
            jobOpeningId: undefined,
            applicantId: undefined,
            stage: undefined,
            activeOnly: undefined,
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
              label="Search applications"
              placeholder="Candidate or opening"
              onSearch={(q) => {
                filter({ q })
              }}
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
        <FilterField label="Stage">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.stage ?? null}
              onChange={(value) => {
                filter({ stage: STAGES.find((stage) => stage === value) })
              }}
              options={STAGE_OPTIONS}
              placeholder="All stages"
              clearable
            />
          )}
        </FilterField>
        <div className="grid grid-cols-2 gap-3">
          <FilterField label="Applied from">
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
          <FilterField label="Applied to">
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
        <div className="flex items-center gap-2.5 @lg:col-span-2 @4xl:col-span-4">
          <Switch
            id={activeId}
            checked={search.activeOnly === true}
            onCheckedChange={(checked) => {
              filter({ activeOnly: checked || undefined })
            }}
          />
          <label htmlFor={activeId} className="text-sm text-heading">
            Active only (hide hired, rejected and withdrawn)
          </label>
        </div>
      </FilterBar>

      {listMode ? (
        <>
          {list.isError ? (
            <ListError error={list.error} what="applications" onRetry={() => void list.refetch()} />
          ) : (
            <div className="relative min-w-0 overflow-x-auto">
              <DataTable
                columns={columns}
                data={list.data?.data ?? []}
                getRowId={(row) => row.id}
                caption="Applications"
                isLoading={list.isPending}
                isFetching={list.isFetching}
                className={payrollTableClass}
                emptyState={
                  active > 0
                    ? 'No applications match the filters.'
                    : 'No applications yet. New Application adds the first one.'
                }
                rowActionsHeader="Actions"
                rowActions={(row) => (
                  <RowActionsMenu
                    label={`Actions for ${row.applicantName}, ${row.jobOpeningTitle}`}
                    itemClassName={rowMenuItemClass.inter}
                    actions={[
                      {
                        label: 'View',
                        onSelect: () => {
                          openDetail(row.id)
                        },
                      },
                      ...actions.actionsFor(row),
                    ]}
                  />
                )}
              />
            </div>
          )}
          <ListFooter
            meta={list.data?.meta}
            noun={list.data?.meta.total === 1 ? 'application' : 'applications'}
            disabled={list.isFetching}
            onPageChange={(page) => {
              update({ page })
            }}
          />
        </>
      ) : (
        <PipelineBoard
          filters={filters}
          stages={stages}
          canMove={actions.canMove}
          onOpen={(application) => {
            openDetail(application.id)
          }}
          actionsFor={(application) =>
            actions.actionsFor(application).filter((item) => item.label !== 'Move Stage')
          }
          onMove={(application, stage) => {
            move.mutate({ record: application, body: { stage } })
          }}
          onDropClosed={(application, stage) => {
            actions.open(
              stage === 'rejected' ? 'reject' : stage === 'hired' ? 'hire' : 'withdraw',
              application,
            )
          }}
        />
      )}

      {search.view && (
        <ApplicationDetailDialog
          id={search.view}
          tab={search.tab}
          onTabChange={(tab) => {
            update({ tab })
          }}
          onClose={() => {
            update({ view: undefined, tab: 'overview' })
          }}
          actionsFor={actions.actionsFor}
        />
      )}
      {search.dialog === 'create' && (
        <NewApplicationDialog
          applicantId={search.applicantId}
          jobOpeningId={search.jobOpeningId}
          onClose={() => {
            update({ dialog: undefined })
          }}
          onSaved={(saved) => {
            update({ dialog: undefined, view: saved.id, tab: 'overview' })
          }}
        />
      )}
      {actions.dialogs}
    </PayrollCard>
  )
}
