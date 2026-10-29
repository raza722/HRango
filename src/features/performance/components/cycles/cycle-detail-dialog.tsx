import { useState } from 'react'
import { X } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { FormField } from '@/components/form'
import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { EmployeeMultiSearchSelect, SearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { appraisalStatusMeta, CYCLE_STATUS_META, metaOf, PERF_CODES } from '../../constants'
import {
  useAddParticipants,
  useAppraisalList,
  useCycle,
  useCycleActions,
  useOrgLookup,
  useRemoveParticipant,
} from '../../hooks/use-performance'
import { participantsFormSchema } from '../../schemas/performance-forms.schema'
import type { Appraisal, Cycle } from '../../types/performance.types'
import { cycleConfirmCopy } from '../../utils/cycles'
import { formatDate, formatPeriod, formatStamp } from '../../utils/format'
import {
  navyButtonClass,
  outlineButtonClass,
  saveButtonClass,
  tableClass,
} from '../../utils/styles'
import { ViewDialog } from '../shared/dialogs'
import { Chip, ConfirmAction, Facts, LoadingRows, ProgressBar, SectionCard } from '../shared/parts'

const PARTICIPANT_PAGE_SIZE = 10

/**
 * How many appraisals wait at each stage, each as a bar of the whole: just after Launch every
 * appraisal waits for its self review, so the labels say "waiting" rather than "done".
 */
function StageCounts({ cycle }: { cycle: Cycle }) {
  const stages = [
    { label: 'Waiting for self review', count: cycle.selfReview },
    { label: 'Waiting for manager review', count: cycle.managerReview },
    { label: 'Reviewed, waiting to be finalised', count: cycle.reviewed },
    { label: 'Finalised', count: cycle.finalised },
  ]
  return (
    <ul aria-label="Appraisals by stage" className="grid gap-2 @md:grid-cols-2">
      {stages.map((stage) => (
        <li key={stage.label} className="grid gap-1">
          <span className="text-xs text-grey">{stage.label}</span>
          <ProgressBar
            value={stage.count}
            max={Math.max(1, cycle.participants)}
            label={`${stage.label}: ${String(stage.count)} of ${String(cycle.participants)}`}
            text={`${String(stage.count)} / ${String(cycle.participants)}`}
            className="[&>span:last-child]:w-14"
          />
        </li>
      ))}
    </ul>
  )
}

/** Add people (EmployeeMultiSearchSelect) and / or a whole department. */
function AddParticipants({ cycle }: { cycle: Cycle }) {
  const [people, setPeople] = useState<string[]>([])
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)
  const departments = useOrgLookup('departments')
  const add = useAddParticipants()
  return (
    <div className="grid gap-3 @lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] @lg:items-end">
      <FormField label="Employees" error={error}>
        {(a11y) => (
          <EmployeeMultiSearchSelect
            {...a11y}
            value={people}
            onChange={(next) => {
              setPeople(next)
              setError(undefined)
            }}
            filters={{ permission: PERF_CODES.cyclesParticipants }}
            placeholder="Select Employees"
          />
        )}
      </FormField>
      <FormField label="Or a whole department">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={departmentId}
            onChange={(next) => {
              setDepartmentId(next)
              setError(undefined)
            }}
            options={(departments.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
            placeholder="No department"
            clearable
          />
        )}
      </FormField>
      <Button
        type="button"
        disabled={add.isPending}
        onClick={() => {
          const checked = participantsFormSchema.safeParse({ employeeIds: people, departmentId })
          if (!checked.success) {
            setError(checked.error.issues[0]?.message)
            return
          }
          add.mutate(
            { id: cycle.id, employeeIds: people, departmentId },
            {
              onSuccess: () => {
                setPeople([])
                setDepartmentId(null)
              },
            },
          )
        }}
        className={cn('h-10 rounded-lg px-5', navyButtonClass)}
      >
        Add Participants
      </Button>
    </div>
  )
}

/** The cycle's people (their appraisals), paged, with Remove while the cycle is open. */
function Participants({ cycle }: { cycle: Cycle }) {
  const [page, setPage] = useState(1)
  const [removing, setRemoving] = useState<Appraisal | null>(null)
  const canManage = useCan(PERF_CODES.cyclesParticipants) && cycle.status !== 'closed'
  const remove = useRemoveParticipant()
  const list = useAppraisalList({
    tab: 'all',
    cycleId: cycle.id,
    page,
    pageSize: PARTICIPANT_PAGE_SIZE,
  })
  const columns: DataTableColumn<Appraisal>[] = [
    {
      id: 'employee',
      header: 'Employee',
      mobile: 'heading',
      className: 'min-w-36 whitespace-normal',
      cell: (row) => (
        <span className="grid">
          <span className="font-medium">{row.employeeName}</span>
          <span className="text-[0.625rem] text-grey">{row.employeeCode}</span>
        </span>
      ),
    },
    { id: 'department', header: 'Department', cell: (row) => row.departmentName ?? '—' },
    { id: 'reviewer', header: 'Reviewer', cell: (row) => row.reviewerName ?? '—' },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip meta={appraisalStatusMeta(row)} />,
    },
    ...(canManage
      ? [
          {
            id: 'remove',
            header: 'Remove',
            align: 'center' as const,
            className: 'w-16',
            cell: (row: Appraisal) =>
              row.status === 'finalised' ? (
                '—'
              ) : (
                <button
                  type="button"
                  aria-label={`Remove ${row.employeeName}`}
                  onClick={() => {
                    setRemoving(row)
                  }}
                  className="inline-flex size-8 items-center justify-center rounded-md text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              ),
          },
        ]
      : []),
  ]

  return (
    <div className="grid gap-3">
      {list.error && !list.data ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => {
            void list.refetch()
          }}
          className="shadow-none"
        />
      ) : (
        <>
          <div className={tableClass}>
            <DataTable
              caption="Participants"
              columns={columns}
              data={list.data?.data ?? []}
              getRowId={(row) => row.id}
              isLoading={list.isPending}
              isFetching={list.isFetching}
              loadingRowCount={3}
              emptyState="Nobody is in this cycle yet. Add Participants above."
            />
          </div>
          {(list.data?.meta.totalPages ?? 1) > 1 && (
            <Pagination
              page={list.data?.meta.page ?? page}
              totalPages={list.data?.meta.totalPages ?? 1}
              onPageChange={setPage}
              currentClassName="bg-pager-active font-medium text-white"
            />
          )}
        </>
      )}
      {removing && (
        <ConfirmAction
          title="Remove participant"
          description={`Remove ${removing.employeeName} from ${cycle.name}? Their appraisal and any review written so far go with it.`}
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

/**
 * A review cycle (`?cycle=<id>`): its form and dates, how far its appraisals are, its
 * participants (add people or a department, remove), and Launch or Close by its status.
 */
export function CycleDetailDialog({
  cycleId,
  onEdit,
  onClose,
}: {
  cycleId: string
  onEdit: (cycle: Cycle) => void
  onClose: () => void
}) {
  const query = useCycle(cycleId)
  const cycle = query.data
  const canEdit = useCan(PERF_CODES.cyclesEdit)
  const canParticipants = useCan(PERF_CODES.cyclesParticipants)
  const [confirming, setConfirming] = useState<'launch' | 'close' | null>(null)
  const actions = useCycleActions()

  return (
    <ViewDialog
      title={cycle?.name ?? 'Review Cycle'}
      description={
        cycle ? `${cycle.formName} · ${formatPeriod(cycle.startDate, cycle.endDate)}` : undefined
      }
      onClose={onClose}
      footer={
        cycle && (
          <>
            {canEdit && cycle.status !== 'closed' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onEdit(cycle)
                }}
                className={cn('h-12 rounded-lg px-6', outlineButtonClass)}
              >
                Edit
              </Button>
            )}
            {actions.canLaunch && cycle.status === 'draft' && (
              <>
                {cycle.participants === 0 && (
                  <p id="launch-reason" className="self-center text-xs text-grey">
                    Add participants before launching.
                  </p>
                )}
                <Button
                  type="button"
                  disabled={cycle.participants === 0}
                  aria-describedby={cycle.participants === 0 ? 'launch-reason' : undefined}
                  onClick={() => {
                    setConfirming('launch')
                  }}
                  className={saveButtonClass}
                >
                  Launch
                </Button>
              </>
            )}
            {actions.canClose && cycle.status === 'active' && (
              <Button
                type="button"
                onClick={() => {
                  setConfirming('close')
                }}
                className={saveButtonClass}
              >
                Close Cycle
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
      ) : !cycle ? (
        <LoadingRows rows={4} label="the review cycle" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Chip meta={metaOf(CYCLE_STATUS_META, cycle.status)} />
            <span className="text-xs text-grey">
              {cycle.participants} participant{cycle.participants === 1 ? '' : 's'}
            </span>
          </div>
          <Facts
            items={[
              { label: 'Appraisal Form', value: cycle.formName },
              { label: 'Period', value: formatPeriod(cycle.startDate, cycle.endDate) },
              { label: 'Self Review Due', value: formatDate(cycle.selfReviewDueDate) },
              { label: 'Manager Review Due', value: formatDate(cycle.managerReviewDueDate) },
              { label: 'Launched', value: formatStamp(cycle.launchedAt) },
              { label: 'Closed', value: formatStamp(cycle.closedAt) },
            ]}
          />
          {cycle.status !== 'draft' && (
            <SectionCard title="Progress" as="h3">
              <StageCounts cycle={cycle} />
            </SectionCard>
          )}
          <SectionCard title="Participants" as="h3">
            <div className="grid gap-4">
              {canParticipants && cycle.status !== 'closed' && <AddParticipants cycle={cycle} />}
              <Participants cycle={cycle} />
            </div>
          </SectionCard>
        </>
      )}
      {cycle && confirming && (
        <ConfirmAction
          title={cycleConfirmCopy(cycle, confirming).title}
          description={cycleConfirmCopy(cycle, confirming).text}
          confirmLabel={cycleConfirmCopy(cycle, confirming).label}
          onConfirm={() => {
            const variables = { id: cycle.id, rowVersion: cycle.rowVersion, name: cycle.name }
            if (confirming === 'launch') actions.launch.mutate(variables)
            else actions.close.mutate(variables)
          }}
          onClose={() => {
            setConfirming(null)
          }}
        />
      )}
    </ViewDialog>
  )
}
