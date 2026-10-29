import { Link } from '@tanstack/react-router'
import { Check, Star } from 'lucide-react'

import type { RowAction } from '@/components/layout'
import { FileLink } from '@/features/assets'
import { StatusChip } from '@/features/payroll'

import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_RESULT_META,
  INTERVIEW_STATUS_META,
  RECOMMENDATION_META,
  STAGE_META,
} from '../../constants'
import { useInterview } from '../../hooks/use-recruitment'
import type { InterviewDetail } from '../../types/recruitment.types'
import { formatRating, formatStamp, formatTime, labelOf } from '../../utils/format'
import { ActionButton, DetailDialog, DetailSection, FactList, Prose } from '../shared/dialog-parts'
import { EmptyNote } from '../shared/list-parts'

/**
 * An interview's detail: when, how and where, the candidate and opening, the panel (with who has
 * evaluated) and every evaluation. The footer has Edit, Complete, Cancel and Evaluate as its
 * status allows.
 */
export function InterviewDetailDialog({
  id,
  onClose,
  actionsFor,
}: {
  id: string
  onClose: () => void
  actionsFor: (interview: InterviewDetail) => RowAction[]
}) {
  const query = useInterview(id)
  const record = query.data
  return (
    <DetailDialog
      title={record ? `${record.applicantName} · round ${String(record.roundNo)}` : 'Interview'}
      description={
        record ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{record.title}</span>
            <StatusChip {...INTERVIEW_STATUS_META[record.status]} />
            {record.result && <StatusChip {...INTERVIEW_RESULT_META[record.result]} />}
          </span>
        ) : undefined
      }
      onClose={onClose}
      loading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      what="the interview"
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
            label="Interview details"
            facts={[
              {
                label: 'When',
                value: `${formatStamp(record.scheduledAt)} – ${formatTime(record.endsAt)} (${String(record.durationMinutes)} min)`,
              },
              { label: 'Mode', value: labelOf(INTERVIEW_MODE_LABELS, record.mode) },
              { label: 'Venue or Link', value: record.venue ?? '—' },
              {
                label: 'Candidate',
                value: (
                  <Link
                    to="/recruitment/applications"
                    search={{ view: record.applicationId }}
                    className="underline-offset-2 hover:underline"
                  >
                    {record.applicantName}
                  </Link>
                ),
              },
              { label: 'Opening', value: record.jobOpeningTitle },
              {
                label: 'Application Stage',
                value: <StatusChip {...STAGE_META[record.applicationStage]} />,
              },
              { label: 'Phone', value: record.applicantPhone ?? '—' },
              { label: 'CV', value: <FileLink file={record.cv} /> },
              {
                label: 'Rating',
                value: `${formatRating(record.averageRating)} (${String(record.evaluationCount)} of ${String(record.interviewerCount)})`,
              },
            ]}
          />
          <DetailSection title="Interviewers">
            <ul aria-label="Interviewers" className="grid gap-2 @md:grid-cols-2">
              {record.interviewers.map((row) => (
                <li
                  key={row.employeeId}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-heading">
                      {row.employeeName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.jobTitleName ?? row.employeeCode ?? ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-field-foreground">
                    {row.hasEvaluated ? (
                      <>
                        <Check aria-hidden="true" className="size-3.5 text-success" /> Evaluated
                      </>
                    ) : (
                      'Not evaluated'
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </DetailSection>
          <DetailSection title={`Evaluations (${String(record.evaluations.length)})`}>
            {record.evaluations.length === 0 ? (
              <EmptyNote>No evaluations yet.</EmptyNote>
            ) : (
              <ul aria-label="Evaluations" className="grid gap-3">
                {record.evaluations.map((row) => (
                  <li key={row.id} className="grid gap-1.5 rounded-md border p-3">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-heading">{row.employeeName}</span>
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm text-heading">
                          <Star
                            aria-hidden="true"
                            className="size-4 fill-[#F5A035] text-[#F5A035]"
                          />
                          {row.rating} / 5
                        </span>
                        <StatusChip {...RECOMMENDATION_META[row.recommendation]} />
                      </span>
                    </span>
                    {row.strengths && (
                      <p className="text-sm text-field-foreground">
                        <span className="font-medium text-heading">Strengths: </span>
                        {row.strengths}
                      </p>
                    )}
                    {row.concerns && (
                      <p className="text-sm text-field-foreground">
                        <span className="font-medium text-heading">Concerns: </span>
                        {row.concerns}
                      </p>
                    )}
                    {row.comments && (
                      <p className="text-sm text-field-foreground">{row.comments}</p>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatStamp(row.evaluatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
          {record.remarks && (
            <DetailSection title="Remarks">
              <Prose>{record.remarks}</Prose>
            </DetailSection>
          )}
        </>
      )}
    </DetailDialog>
  )
}
