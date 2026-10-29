import { Link } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'

import type { RowAction } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileLink } from '@/features/assets'
import { StatusChip } from '@/features/payroll'

import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_RESULT_META,
  INTERVIEW_STATUS_META,
  OFFER_STATUS_META,
  SALARY_FREQUENCY_LABELS,
  SOURCE_LABELS,
  STAGE_META,
} from '../../constants'
import { useApplication } from '../../hooks/use-recruitment'
import { APPLICATION_TABS, type ApplicationTab } from '../../routing'
import type { ApplicationDetail } from '../../types/recruitment.types'
import { formatAmount, formatDay, formatRating, formatStamp, labelOf } from '../../utils/format'
import { ActionButton, DetailDialog, DetailSection, FactList, Prose } from '../shared/dialog-parts'
import { EmptyNote } from '../shared/list-parts'

const TAB_LABELS: Record<ApplicationTab, string> = {
  overview: 'Overview',
  timeline: 'Timeline',
  interviews: 'Interviews',
  offers: 'Offers',
}

function Timeline({ application }: { application: ApplicationDetail }) {
  if (application.history.length === 0) return <EmptyNote>No stage changes yet.</EmptyNote>
  return (
    <ol aria-label="Stage history" className="relative grid gap-4 border-l pl-5">
      {application.history.map((row) => (
        <li key={row.id} className="relative grid gap-1">
          <span
            aria-hidden="true"
            className="absolute top-1 -left-[1.6rem] size-3 rounded-full border-2 border-card bg-sidebar dark:bg-primary"
          />
          <span className="flex flex-wrap items-center gap-2 text-sm text-heading">
            {row.fromStage ? (
              <>
                <StatusChip {...STAGE_META[row.fromStage]} />
                <span aria-hidden="true">→</span>
                <span className="sr-only">to</span>
              </>
            ) : (
              <span>Applied as</span>
            )}
            <StatusChip {...STAGE_META[row.toStage]} />
          </span>
          <span className="text-xs text-muted-foreground">
            {formatStamp(row.changedAt)}
            {row.changedByName ? ` · ${row.changedByName}` : ''}
          </span>
          {row.remarks && <span className="text-sm text-field-foreground">{row.remarks}</span>}
        </li>
      ))}
    </ol>
  )
}

function Interviews({ application }: { application: ApplicationDetail }) {
  if (application.interviews.length === 0) return <EmptyNote>No interviews yet.</EmptyNote>
  return (
    <ul aria-label="Interviews" className="grid gap-3">
      {application.interviews.map((row) => (
        <li key={row.id} className="grid gap-1.5 rounded-md border p-3">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/recruitment/interviews"
              search={{ view: row.id }}
              className="text-sm font-medium text-heading underline-offset-2 hover:underline"
            >
              Round {row.roundNo}: {row.title}
            </Link>
            <span className="flex flex-wrap gap-1.5">
              <StatusChip {...INTERVIEW_STATUS_META[row.status]} />
              {row.result && <StatusChip {...INTERVIEW_RESULT_META[row.result]} />}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {formatStamp(row.scheduledAt)} · {row.durationMinutes} min ·{' '}
            {labelOf(INTERVIEW_MODE_LABELS, row.mode)}
            {row.venue ? ` · ${row.venue}` : ''}
          </span>
          <span className="text-xs text-field-foreground">
            {row.interviewerNames ?? 'No interviewers'} · rating {formatRating(row.averageRating)} (
            {row.evaluationCount} evaluation{row.evaluationCount === 1 ? '' : 's'})
          </span>
        </li>
      ))}
    </ul>
  )
}

function Offers({ application }: { application: ApplicationDetail }) {
  if (application.offers.length === 0) return <EmptyNote>No offers yet.</EmptyNote>
  return (
    <ul aria-label="Offers" className="grid gap-3">
      {application.offers.map((row) => (
        <li key={row.id} className="grid gap-1.5 rounded-md border p-3">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/recruitment/offers"
              search={{ view: row.id }}
              className="text-sm font-medium text-heading underline-offset-2 hover:underline"
            >
              Rs {formatAmount(row.offeredSalary)}{' '}
              {labelOf(SALARY_FREQUENCY_LABELS, row.salaryFrequency).toLowerCase()}
            </Link>
            <StatusChip {...OFFER_STATUS_META[row.status]} />
          </span>
          <span className="text-xs text-muted-foreground">
            Joining {formatDay(row.joiningDate)}
            {row.expiresOn ? ` · expires ${formatDay(row.expiresOn)}` : ''}
            {row.sentAt ? ` · sent ${formatDay(row.sentAt)}` : ''}
            {row.respondedAt ? ` · answered ${formatDay(row.respondedAt)}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * An application's detail: the stage, the candidate and opening, and four tabs (Overview with the
 * CV and cover letter, Timeline of stage changes, Interviews, Offers). After a hire it links to the
 * new employee's profile. The footer has the actions its stage allows.
 */
export function ApplicationDetailDialog({
  id,
  tab,
  onTabChange,
  onClose,
  actionsFor,
}: {
  id: string
  tab: ApplicationTab
  onTabChange: (tab: ApplicationTab) => void
  onClose: () => void
  actionsFor: (application: ApplicationDetail) => RowAction[]
}) {
  const query = useApplication(id)
  const record = query.data
  return (
    <DetailDialog
      title={record ? `${record.applicantName} · ${record.jobOpeningTitle}` : 'Application'}
      description={
        record ? (
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip {...STAGE_META[record.stage]} />
            <span>Applied {formatDay(record.appliedOn)}</span>
          </span>
        ) : undefined
      }
      onClose={onClose}
      loading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      what="the application"
      actions={
        record
          ? actionsFor(record).map((action) => (
              <ActionButton
                key={action.label}
                tone={
                  action.variant === 'destructive'
                    ? 'red'
                    : action.label === 'Hire'
                      ? 'green'
                      : 'navy'
                }
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
          {record.stage === 'hired' && record.employeeId && (
            <p
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-heading"
            >
              <CircleCheck aria-hidden="true" className="size-4 text-success" />
              Hired {formatDay(record.hiredAt)}
              {record.employeeCode ? ` as ${record.employeeCode}` : ''}.
              <Link
                to="/talent-management/employees/$employeeId"
                params={{ employeeId: record.employeeId }}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                View employee profile
              </Link>
            </p>
          )}
          {record.stage === 'rejected' && (
            <p
              role="status"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-heading"
            >
              Rejected at{' '}
              {record.rejectedStage ? STAGE_META[record.rejectedStage].label : 'an earlier stage'}
              {record.rejectionReasonName ? `: ${record.rejectionReasonName}` : ''}.
            </p>
          )}
          <Tabs
            value={tab}
            onValueChange={(value) => {
              onTabChange(value as ApplicationTab)
            }}
          >
            <TabsList aria-label="Application sections">
              {APPLICATION_TABS.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {TAB_LABELS[value]}
                  {value === 'interviews' && ` (${String(record.interviews.length)})`}
                  {value === 'offers' && ` (${String(record.offers.length)})`}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview" className="grid gap-6">
              <FactList
                label="Application details"
                facts={[
                  {
                    label: 'Candidate',
                    value: (
                      <Link
                        to="/recruitment/candidates"
                        search={{ view: record.applicantId }}
                        className="underline-offset-2 hover:underline"
                      >
                        {record.applicantName}
                      </Link>
                    ),
                  },
                  { label: 'Email', value: record.applicantEmail },
                  { label: 'Phone', value: record.applicantPhone ?? '—' },
                  { label: 'Current Role', value: record.applicantCurrentJobTitle ?? '—' },
                  { label: 'City', value: record.applicantCityName ?? '—' },
                  {
                    label: 'Opening',
                    value: (
                      <Link
                        to="/recruitment/openings"
                        search={{ view: record.jobOpeningId }}
                        className="underline-offset-2 hover:underline"
                      >
                        {record.jobOpeningCode} · {record.jobOpeningTitle}
                      </Link>
                    ),
                  },
                  {
                    label: 'Department / Branch',
                    value:
                      [record.departmentName, record.branchName].filter(Boolean).join(' · ') || '—',
                  },
                  { label: 'Source', value: labelOf(SOURCE_LABELS, record.source) },
                  { label: 'CV', value: <FileLink file={record.cv} /> },
                  { label: 'Next Interview', value: formatStamp(record.nextInterviewAt) },
                  {
                    label: 'Rating',
                    value: `${formatRating(record.averageRating)} (${String(record.evaluationCount)} ${record.evaluationCount === 1 ? 'evaluation' : 'evaluations'})`,
                  },
                  { label: 'Stage Since', value: formatStamp(record.stageChangedAt) },
                ]}
              />
              <DetailSection title="Cover Letter">
                <Prose>{record.coverLetter}</Prose>
              </DetailSection>
              {record.remarks && (
                <DetailSection title="Remarks">
                  <Prose>{record.remarks}</Prose>
                </DetailSection>
              )}
            </TabsContent>
            <TabsContent value="timeline">
              <Timeline application={record} />
            </TabsContent>
            <TabsContent value="interviews">
              <Interviews application={record} />
            </TabsContent>
            <TabsContent value="offers">
              <Offers application={record} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </DetailDialog>
  )
}
