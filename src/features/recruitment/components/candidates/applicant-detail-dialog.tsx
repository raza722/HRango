import { Link } from '@tanstack/react-router'

import { DataTable, type DataTableColumn, type RowAction } from '@/components/layout'
import { FileLink } from '@/features/assets'
import { StatusChip } from '@/features/payroll'

import { GENDER_LABELS, OFFER_STATUS_META, SOURCE_LABELS, STAGE_META } from '../../constants'
import { useApplicant } from '../../hooks/use-recruitment'
import type { ApplicantDetail, Application } from '../../types/recruitment.types'
import { formatAmount, formatDay, formatRating, formatStamp, labelOf } from '../../utils/format'
import { ActionButton, DetailDialog, DetailSection, FactList, Prose } from '../shared/dialog-parts'

const columns: DataTableColumn<Application>[] = [
  {
    id: 'opening',
    header: 'Opening',
    mobile: 'heading',
    className: 'min-w-44 whitespace-normal',
    cell: (row) => (
      <Link
        to="/recruitment/applications"
        search={{ view: row.id }}
        className="font-medium text-heading underline-offset-2 hover:underline"
      >
        {row.jobOpeningTitle}
      </Link>
    ),
  },
  { id: 'applied', header: 'Applied', cell: (row) => formatDay(row.appliedOn) },
  { id: 'stage', header: 'Stage', cell: (row) => <StatusChip {...STAGE_META[row.stage]} /> },
  {
    id: 'offer',
    header: 'Offer',
    cell: (row) =>
      row.latestOfferStatus ? <StatusChip {...OFFER_STATUS_META[row.latestOfferStatus]} /> : '—',
  },
  { id: 'rating', header: 'Rating', cell: (row) => formatRating(row.averageRating) },
]

/**
 * A candidate's detail: contact and career facts, the CV, notes, and every application they made
 * (each opens in the pipeline). The footer has New Application, Edit and Delete.
 */
export function ApplicantDetailDialog({
  id,
  onClose,
  actionsFor,
}: {
  id: string
  onClose: () => void
  actionsFor: (applicant: ApplicantDetail) => RowAction[]
}) {
  const applicant = useApplicant(id)
  const record = applicant.data
  return (
    <DetailDialog
      title={record?.fullName ?? 'Candidate'}
      description={
        record
          ? [record.currentJobTitle, record.currentEmployer].filter(Boolean).join(' at ') ||
            record.email
          : undefined
      }
      onClose={onClose}
      loading={applicant.isPending}
      error={applicant.error}
      onRetry={() => void applicant.refetch()}
      what="the candidate"
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
            label="Candidate details"
            facts={[
              {
                label: 'Email',
                value: (
                  <a href={`mailto:${record.email}`} className="underline-offset-2 hover:underline">
                    {record.email}
                  </a>
                ),
              },
              {
                label: 'Phone',
                value: record.phone ? (
                  <a href={`tel:${record.phone}`} className="underline-offset-2 hover:underline">
                    {record.phone}
                  </a>
                ) : (
                  '—'
                ),
              },
              { label: 'Gender', value: labelOf(GENDER_LABELS, record.gender) },
              { label: 'Date of Birth', value: formatDay(record.dateOfBirth) },
              {
                label: 'City',
                value:
                  [record.cityName, record.stateName, record.countryName]
                    .filter(Boolean)
                    .join(', ') || '—',
              },
              { label: 'Address', value: record.address ?? '—' },
              {
                label: 'Experience',
                value:
                  record.experienceYears === null ? '—' : `${String(record.experienceYears)} years`,
              },
              {
                label: 'Notice Period',
                value:
                  record.noticePeriodDays === null
                    ? '—'
                    : `${String(record.noticePeriodDays)} days`,
              },
              {
                label: 'Current Salary',
                value:
                  record.currentSalary === null ? '—' : `Rs ${formatAmount(record.currentSalary)}`,
              },
              {
                label: 'Expected Salary',
                value:
                  record.expectedSalary === null
                    ? '—'
                    : `Rs ${formatAmount(record.expectedSalary)}`,
              },
              { label: 'Highest Education', value: record.highestEducation ?? '—' },
              {
                label: 'LinkedIn',
                value: record.linkedinUrl ? (
                  <a
                    href={record.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline-offset-2 hover:underline"
                  >
                    {record.linkedinUrl}
                  </a>
                ) : (
                  '—'
                ),
              },
              {
                label: 'Source',
                value: `${labelOf(SOURCE_LABELS, record.source)}${record.referredByName ? ` (by ${record.referredByName})` : ''}`,
              },
              { label: 'CV', value: <FileLink file={record.cv} /> },
              {
                label: 'Added',
                value: `${formatStamp(record.createdAt)}${record.createdByName ? ` by ${record.createdByName}` : ''}`,
              },
            ]}
          />
          <DetailSection title={`Applications (${String(record.applications.length)})`}>
            <DataTable
              columns={columns}
              data={record.applications}
              getRowId={(row) => row.id}
              caption="The candidate's applications"
              emptyState="No applications yet."
            />
          </DetailSection>
          <DetailSection title="Notes">
            <Prose>{record.notes}</Prose>
          </DetailSection>
        </>
      )}
    </DetailDialog>
  )
}
