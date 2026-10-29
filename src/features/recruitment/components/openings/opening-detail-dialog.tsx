import { Link } from '@tanstack/react-router'

import { DataTable, type DataTableColumn, type RowAction } from '@/components/layout'
import { StatusChip } from '@/features/payroll'

import { OPENING_STATUS_META, STAGE_COLOUR, STAGE_META, WORK_MODE_LABELS } from '../../constants'
import { useApplications, useOpening, useStageCounts } from '../../hooks/use-recruitment'
import { type Application, type Opening, STAGES } from '../../types/recruitment.types'
import {
  formatDay,
  formatExperience,
  formatSalaryRange,
  formatStamp,
  labelOf,
} from '../../utils/format'
import { ActionButton, DetailDialog, DetailSection, FactList, Prose } from '../shared/dialog-parts'
import { CandidateCell } from '../shared/fields'

const columns: DataTableColumn<Application>[] = [
  {
    id: 'candidate',
    header: 'Candidate',
    mobile: 'heading',
    className: 'min-w-44',
    cell: (row) => <CandidateCell name={row.applicantName} detail={row.applicantEmail} />,
  },
  { id: 'applied', header: 'Applied', cell: (row) => formatDay(row.appliedOn) },
  { id: 'stage', header: 'Stage', cell: (row) => <StatusChip {...STAGE_META[row.stage]} /> },
]

/** How many applications are at each stage, as labelled counts (with a colour key, never alone). */
export function StageCountList({
  counts,
  label,
}: {
  counts: Partial<Record<(typeof STAGES)[number], number>> | undefined
  label: string
}) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-2 @md:grid-cols-4">
      {STAGES.map((stage) => (
        <li
          key={stage}
          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2 text-field-foreground">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: STAGE_COLOUR[stage] }}
            />
            <span className="truncate">{STAGE_META[stage].label}</span>
          </span>
          <span className="font-semibold text-heading tabular-nums">{counts?.[stage] ?? '…'}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * An opening's detail: status, the role and its numbers, how many applications sit at each stage,
 * the latest applications (with a link to its pipeline) and the description. The footer has the
 * actions its status allows.
 */
export function OpeningDetailDialog({
  id,
  onClose,
  actionsFor,
}: {
  id: string
  onClose: () => void
  /** The actions the page offers for this opening (by status and permission). */
  actionsFor: (opening: Opening) => RowAction[]
}) {
  const opening = useOpening(id)
  const counts = useStageCounts({ jobOpeningId: id })
  const latest = useApplications({ jobOpeningId: id, page: 1, pageSize: 5 })
  const record = opening.data
  return (
    <DetailDialog
      title={record ? record.title : 'Opening'}
      description={
        record ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{record.code}</span>
            <StatusChip {...OPENING_STATUS_META[record.status]} />
          </span>
        ) : undefined
      }
      onClose={onClose}
      loading={opening.isPending}
      error={opening.error}
      onRetry={() => void opening.refetch()}
      what="the opening"
      actions={
        record
          ? actionsFor(record).map((action) => (
              <ActionButton
                key={action.label}
                tone={action.variant === 'destructive' ? 'red' : 'navy'}
                onClick={action.onSelect}
              >
                {action.label}
              </ActionButton>
            ))
          : undefined
      }
    >
      {record && (
        <>
          <FactList
            label="Opening details"
            facts={[
              { label: 'Department', value: record.departmentName ?? '—' },
              { label: 'Branch', value: record.branchName ?? '—' },
              { label: 'Job Title', value: record.jobTitleName ?? '—' },
              { label: 'Designation', value: record.designationName ?? '—' },
              { label: 'Hiring Manager', value: record.hiringManagerName ?? '—' },
              {
                label: 'City',
                value: record.cityName
                  ? [record.cityName, record.stateName].filter(Boolean).join(', ')
                  : '—',
              },
              { label: 'Work Mode', value: labelOf(WORK_MODE_LABELS, record.workMode) },
              {
                label: 'Experience',
                value: formatExperience(record.experienceFromYears, record.experienceToYears),
              },
              {
                label: 'Vacancies',
                value: `${String(record.hiredCount)} hired of ${String(record.vacancies)} (${String(record.remainingVacancies)} left)`,
              },
              {
                label: 'Salary',
                value: `${formatSalaryRange(record.salaryFrom, record.salaryTo)}${record.isSalaryVisible ? ' (shown on the post)' : ''}`,
              },
              { label: 'Posted On', value: formatDay(record.postedOn) },
              { label: 'Apply By', value: formatDay(record.applyBy) },
              { label: 'Close On', value: formatDay(record.closeOn) },
              {
                label: 'Open Position',
                value: record.openPositionTitle
                  ? `${record.openPositionTitle}${record.openPositionSeats ? ` (${String(record.openPositionSeats)} seats)` : ''}`
                  : '—',
              },
              { label: 'Published', value: formatStamp(record.publishedAt) },
              {
                label: 'Created',
                value: `${formatStamp(record.createdAt)}${record.createdByName ? ` by ${record.createdByName}` : ''}`,
              },
            ]}
          />
          <DetailSection
            title={`Applications (${String(record.applicationCount)}, ${String(record.activeApplicationCount)} active)`}
            actions={
              <Link
                to="/recruitment/applications"
                search={{ jobOpeningId: record.id }}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Open in pipeline
              </Link>
            }
          >
            <StageCountList counts={counts.data} label="Applications by stage" />
            <DataTable
              columns={columns}
              data={latest.data?.data ?? []}
              getRowId={(row) => row.id}
              caption="Latest applications"
              isLoading={latest.isPending}
              emptyState="No applications yet."
            />
          </DetailSection>
          <DetailSection title="Description">
            <Prose>{record.description}</Prose>
          </DetailSection>
          <DetailSection title="Requirements">
            <Prose>{record.requirements}</Prose>
          </DetailSection>
        </>
      )}
    </DetailDialog>
  )
}
