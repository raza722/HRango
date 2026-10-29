import { useState } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import { FormField } from '@/components/form'
import {
  type DataTableColumn,
  PageContainer,
  PaginatedTableCard,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { EmployeeSearchSelect, SearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  APPRAISAL_STATUS_META,
  appraisalStatusMeta,
  PERF_CODES,
  PERF_PAGE_SIZES,
  SCOPE_LABELS,
} from '../../constants'
import {
  useAppraisal,
  useAppraisalList,
  useCycleOptions,
  useRemoveParticipant,
} from '../../hooks/use-performance'
import type { AppraisalsSearch } from '../../routing'
import {
  type Appraisal,
  APPRAISAL_STATUSES,
  type AppraisalDetail,
  type ScopeTab,
} from '../../types/performance.types'
import { formatPeriod, formatScore, serialOf } from '../../utils/format'
import { cardClass, navyButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import { FiltersDialog } from '../shared/dialogs'
import {
  BackButton,
  Chip,
  ConfirmAction,
  FilterButton,
  LoadingRows,
  PageHeaderCard,
  ScopeTabsBar,
  SearchBox,
  SectionCard,
} from '../shared/parts'
import {
  AppraisalGoals,
  AppraisalNotes,
  RatingsTable,
  ScoreTiles,
  StageSteps,
} from './appraisal-parts'
import { FinaliseDialog } from './finalise-dialog'

/** Props of a page that takes its URL state from its route. */
export interface AppraisalsViewProps {
  search: AppraisalsSearch
  onSearch: (patch: Partial<AppraisalsSearch>) => void
}

type AppraisalFilters = Pick<AppraisalsSearch, 'cycleId' | 'status' | 'employeeId'>
const NO_FILTERS: AppraisalFilters = {
  cycleId: undefined,
  status: undefined,
  employeeId: undefined,
}

const TITLES: Record<ScopeTab, string> = {
  my: 'My Appraisals',
  team: 'Team Appraisals',
  all: 'All Appraisals',
}

const canFinaliseNow = (appraisal: Appraisal) =>
  appraisal.status === 'reviewed' && appraisal.cycleStatus === 'active'
const canRemoveNow = (appraisal: Appraisal) =>
  appraisal.status !== 'finalised' && appraisal.cycleStatus !== 'closed'

function AppraisalFiltersDialog({
  value,
  onApply,
  onClose,
}: {
  value: AppraisalFilters
  onApply: (filters: AppraisalFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const cycles = useCycleOptions()
  return (
    <FiltersDialog
      onApply={() => {
        onApply(draft)
      }}
      onReset={() => {
        onApply(NO_FILTERS)
      }}
      onClose={onClose}
    >
      <FormField label="Review Cycle">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.cycleId ?? null}
            onChange={(next) => {
              setDraft((current) => ({ ...current, cycleId: next ?? undefined }))
            }}
            options={(cycles.data?.data ?? []).map((cycle) => ({
              value: cycle.id,
              label: cycle.name,
            }))}
            placeholder="All Cycles"
            clearable
          />
        )}
      </FormField>
      <FormField label="Status">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.status ?? null}
            onChange={(next) => {
              setDraft((current) => ({
                ...current,
                status: APPRAISAL_STATUSES.find((status) => status === next),
              }))
            }}
            options={APPRAISAL_STATUSES.map((status) => ({
              value: status,
              label: APPRAISAL_STATUS_META[status].label,
            }))}
            placeholder="All Statuses"
            clearable
          />
        )}
      </FormField>
      <FormField label="Employee" className="sm:col-span-2">
        {(a11y) => (
          <EmployeeSearchSelect
            {...a11y}
            value={draft.employeeId ?? null}
            onChange={(next) => {
              setDraft((current) => ({ ...current, employeeId: next ?? undefined }))
            }}
            filters={{ permission: PERF_CODES.appraisalsView, includeInactive: true }}
            placeholder="All Employees"
            clearable
          />
        )}
      </FormField>
    </FiltersDialog>
  )
}

/** One appraisal in full: stages, scores, both reviews side by side, goals and notes. */
function AppraisalDetailView({
  appraisalId,
  finaliseOpen,
  onSearch,
}: {
  appraisalId: string
  finaliseOpen: boolean
  onSearch: AppraisalsViewProps['onSearch']
}) {
  const query = useAppraisal(appraisalId)
  const canFinalise = useCan(PERF_CODES.appraisalsFinalise)
  const appraisal: AppraisalDetail | undefined = query.data
  const back = () => {
    onSearch({ appraisal: undefined, finalise: undefined })
  }
  return (
    <>
      <BackButton label="Back to appraisals" onClick={back} />
      {query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : !appraisal ? (
        <div className={cn(cardClass, 'p-5')}>
          <LoadingRows rows={5} label="the appraisal" />
        </div>
      ) : (
        <>
          <PageHeaderCard
            title={`Appraisal: ${appraisal.employeeName}`}
            description={[
              appraisal.employeeCode,
              appraisal.jobTitleName,
              appraisal.departmentName,
              `${appraisal.cycleName} (${formatPeriod(appraisal.periodStart, appraisal.periodEnd)})`,
              appraisal.reviewerName ? `Reviewer ${appraisal.reviewerName}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            actions={
              <>
                <Chip meta={appraisalStatusMeta(appraisal)} />
                {canFinalise && canFinaliseNow(appraisal) && (
                  <Button
                    onClick={() => {
                      onSearch({ finalise: true })
                    }}
                    className={cn(toolbarButtonClass, navyButtonClass, 'px-5 text-xs')}
                  >
                    Finalise
                  </Button>
                )}
              </>
            }
          />
          <div className={cn(cardClass, '@container grid gap-4 p-4 sm:p-5')}>
            <StageSteps status={appraisal.status} hasSelfReview={appraisal.hasSelfReview} />
            {appraisal.status !== 'reviewed' && appraisal.status !== 'finalised' && (
              <p className="text-xs text-muted-foreground">
                {appraisal.hasSelfReview
                  ? 'It can be finalised once both the self review and the manager review are submitted.'
                  : 'It can be finalised once the manager review is submitted.'}
              </p>
            )}
            <ScoreTiles appraisal={appraisal} />
            <SectionCard title="Ratings" as="h2">
              <RatingsTable appraisal={appraisal} />
            </SectionCard>
            <AppraisalNotes appraisal={appraisal} />
            <SectionCard title="Goals" as="h2">
              <AppraisalGoals appraisal={appraisal} />
            </SectionCard>
          </div>
          {finaliseOpen && canFinaliseNow(appraisal) && (
            <FinaliseDialog
              key={appraisal.rowVersion}
              appraisal={appraisal}
              onClose={() => {
                onSearch({ finalise: undefined })
              }}
            />
          )}
        </>
      )}
    </>
  )
}

/**
 * The Appraisals page body: My / Team / All, the search and filters (cycle, status, employee),
 * the list with the scores, and one appraisal in full with Finalise. It takes its URL state as
 * props, so it works under any route (`/performance/appraisals`, or beside the Payroll
 * Settings menu at `/payroll/settings/appraisal`).
 */
export function AppraisalsView({ search, onSearch }: AppraisalsViewProps) {
  const canTeam = useCan(PERF_CODES.appraisalsTeam)
  const canAll = useCan(PERF_CODES.appraisalsAll)
  const canFinalise = useCan(PERF_CODES.appraisalsFinalise)
  const canDelete = useCan(PERF_CODES.appraisalsDelete)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [removing, setRemoving] = useState<Appraisal | null>(null)
  const remove = useRemoveParticipant()

  const tabs: ScopeTab[] = [
    'my',
    ...(canTeam ? (['team'] as const) : []),
    ...(canAll ? (['all'] as const) : []),
  ]
  const tab = tabs.includes(search.tab) ? search.tab : 'my'
  const list = useAppraisalList(
    {
      tab,
      cycleId: search.cycleId,
      status: search.status,
      employeeId: search.employeeId,
      q: search.q,
      page: search.page,
      pageSize: search.pageSize,
    },
    !search.appraisal,
  )
  const filters: AppraisalFilters = {
    cycleId: search.cycleId,
    status: search.status,
    employeeId: search.employeeId,
  }
  const filterCount = Object.values(filters).filter(Boolean).length
  const page = list.data?.meta.page ?? search.page

  if (search.appraisal) {
    return (
      <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
        <AppraisalDetailView
          appraisalId={search.appraisal}
          finaliseOpen={search.finalise === true}
          onSearch={onSearch}
        />
      </div>
    )
  }

  const open = (row: Appraisal, finalise = false) => {
    onSearch({ appraisal: row.id, finalise: finalise ? true : undefined })
  }
  const columns: DataTableColumn<Appraisal>[] = [
    {
      id: 'serial',
      header: 'Sr. #',
      mobile: 'hidden',
      className: 'w-14',
      cell: (_row, index) => serialOf(page, search.pageSize, index),
    },
    {
      id: 'employee',
      header: 'Employee',
      mobile: 'heading',
      className: 'min-w-40 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-0.5">
          <button
            type="button"
            onClick={() => {
              open(row)
            }}
            className="w-fit text-left text-xs font-medium text-person outline-none hover:underline focus-visible:underline dark:text-heading"
          >
            {row.employeeName}
          </button>
          <span className="text-[0.625rem] text-grey">
            {[row.employeeCode, row.departmentName].filter(Boolean).join(' · ')}
          </span>
        </span>
      ),
    },
    {
      id: 'cycle',
      header: 'Review Cycle',
      className: 'whitespace-normal',
      cell: (row) => row.cycleName,
    },
    { id: 'reviewer', header: 'Reviewer', cell: (row) => row.reviewerName ?? '—' },
    {
      id: 'self',
      header: 'Self',
      align: 'right',
      cell: (row) => (row.hasSelfReview ? formatScore(row.selfScore) : 'n/a'),
    },
    {
      id: 'manager',
      header: 'Manager',
      align: 'right',
      cell: (row) => formatScore(row.managerScore),
    },
    {
      id: 'final',
      header: 'Final',
      cell: (row) =>
        row.finalScore === null ? (
          '—'
        ) : (
          <span className="grid">
            <span className="font-medium">{formatScore(row.finalScore)}</span>
            <span className="text-[0.625rem] text-grey">{row.finalRatingLabel}</span>
          </span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip meta={appraisalStatusMeta(row)} />,
    },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      className: 'w-16',
      cell: (row) => (
        <RowActionsMenu
          label={`Actions for the appraisal of ${row.employeeName}`}
          itemClassName={rowMenuItemClass.poppins}
          actions={[
            {
              label: 'View',
              onSelect: () => {
                open(row)
              },
            },
            ...(canFinalise && canFinaliseNow(row)
              ? [
                  {
                    label: 'Finalise',
                    onSelect: () => {
                      open(row, true)
                    },
                  },
                ]
              : []),
            ...(canDelete && canRemoveNow(row)
              ? [
                  {
                    label: 'Remove from cycle',
                    variant: 'destructive' as const,
                    onSelect: () => {
                      setRemoving(row)
                    },
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
      <PageHeaderCard
        title="Appraisals"
        description="Each participant of a review cycle: their self and manager reviews, scores and final rating."
      />
      <PaginatedTableCard
        title={TITLES[tab]}
        titleAs="h2"
        caption={TITLES[tab]}
        className={tableClass}
        toolbar={
          <div className="grid w-full gap-3">
            <ScopeTabsBar
              tabs={tabs}
              value={tab}
              label="Whose appraisals"
              onChange={(next) => {
                onSearch({ tab: next, page: 1 })
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox
                key={search.q ?? ''}
                value={search.q}
                label="Search appraisals"
                onSearch={(q) => {
                  onSearch({ q, page: 1 })
                }}
              />
              <FilterButton
                count={filterCount}
                onClick={() => {
                  setFiltersOpen(true)
                }}
              />
            </div>
          </div>
        }
        columns={columns}
        result={list}
        page={search.page}
        pageSize={search.pageSize}
        pageSizeOptions={PERF_PAGE_SIZES}
        onPageChange={(next) => {
          onSearch({ page: next })
        }}
        onPageSizeChange={(size) => {
          onSearch({ pageSize: size, page: 1 })
        }}
        getRowId={(row) => row.id}
        emptyState={
          search.q || filterCount > 0
            ? 'No appraisals match the search or filters.'
            : `No ${SCOPE_LABELS[tab].toLowerCase()} appraisals yet: they start when people join a review cycle.`
        }
      />
      {filtersOpen && (
        <AppraisalFiltersDialog
          value={filters}
          onApply={(next) => {
            onSearch({ ...next, page: 1 })
          }}
          onClose={() => {
            setFiltersOpen(false)
          }}
        />
      )}
      {removing && (
        <ConfirmAction
          title="Remove from cycle"
          description={`Remove ${removing.employeeName} from ${removing.cycleName}? Their appraisal and any review written so far go with it.`}
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            remove.mutate({
              id: removing.id,
              rowVersion: removing.rowVersion,
              name: removing.employeeName,
            })
          }}
          onClose={() => {
            setRemoving(null)
          }}
        />
      )}
    </div>
  )
}

/** `/performance/appraisals`: the view in the page container. */
export function AppraisalsPage(props: AppraisalsViewProps) {
  return (
    <PageContainer>
      <AppraisalsView {...props} />
    </PageContainer>
  )
}
