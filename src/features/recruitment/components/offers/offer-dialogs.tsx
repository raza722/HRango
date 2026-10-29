import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'

import { FormField, TextareaField } from '@/components/form'
import type { RowAction } from '@/components/layout'
import { FileLink } from '@/features/assets'
import { StatusChip } from '@/features/payroll'

import { OFFER_STATUS_META, SALARY_FREQUENCY_LABELS } from '../../constants'
import { useOffer, useRespondOffer } from '../../hooks/use-recruitment'
import { respondFormSchema, type RespondFormValues } from '../../schemas/recruitment-forms.schema'
import type { Offer } from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { blank, formatAmount, formatDay, formatStamp, labelOf } from '../../utils/format'
import {
  ActionButton,
  DetailDialog,
  DetailSection,
  FactList,
  FormDialog,
  Prose,
} from '../shared/dialog-parts'
import { Segmented } from '../shared/segmented'

/** Record Response: the candidate accepted or declined the sent offer, with remarks. */
export function RespondDialog({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const respond = useRespondOffer()
  const form = useForm<RespondFormValues>({
    resolver: zodResolver(respondFormSchema),
    defaultValues: { decision: 'accepted', remarks: '' },
  })
  const decision = useWatch({ control: form.control, name: 'decision' })
  const submit = form.handleSubmit(async (values) => {
    try {
      await respond.mutateAsync({
        record: offer,
        body: { decision: values.decision, remarks: blank(values.remarks) },
      })
      onClose()
    } catch (error) {
      showServerErrors(error, form.setError, ['decision', 'remarks'])
    }
  })
  return (
    <FormDialog
      title="Record Response"
      description={`${offer.applicantName} · Rs ${formatAmount(offer.offeredSalary)}, joining ${formatDay(offer.joiningDate)}`}
      onClose={onClose}
      onSubmit={submit}
      saving={respond.isPending}
      saveLabel="Save Response"
      rootError={form.formState.errors.root?.message}
      className="max-w-xl"
    >
      <FormField label="The candidate">
        {() => (
          <Segmented
            label="The candidate"
            value={decision}
            options={[
              { value: 'accepted', label: 'Accepted' },
              { value: 'declined', label: 'Declined' },
            ]}
            onChange={(next) => {
              form.setValue('decision', next)
            }}
          />
        )}
      </FormField>
      <TextareaField
        control={form.control}
        name="remarks"
        label="Remarks"
        rows={3}
        maxLength={4000}
      />
    </FormDialog>
  )
}

/** An offer's detail: placement, pay, dates, the letter and its answer, with the status's actions. */
export function OfferDetailDialog({
  id,
  onClose,
  actionsFor,
}: {
  id: string
  onClose: () => void
  actionsFor: (offer: Offer) => RowAction[]
}) {
  const query = useOffer(id)
  const record = query.data
  return (
    <DetailDialog
      title={record ? `Offer for ${record.applicantName}` : 'Offer'}
      description={
        record ? (
          <span className="flex flex-wrap items-center gap-2">
            <span>{record.jobOpeningTitle}</span>
            <StatusChip {...OFFER_STATUS_META[record.status]} />
          </span>
        ) : undefined
      }
      onClose={onClose}
      loading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      what="the offer"
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
            label="Offer details"
            facts={[
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
              { label: 'Email', value: record.applicantEmail },
              { label: 'Opening', value: record.jobOpeningTitle },
              {
                label: 'Salary',
                value: `Rs ${formatAmount(record.offeredSalary)} ${labelOf(SALARY_FREQUENCY_LABELS, record.salaryFrequency).toLowerCase()}`,
              },
              { label: 'Joining Date', value: formatDay(record.joiningDate) },
              {
                label: 'Probation',
                value:
                  record.probationMonths === null
                    ? '—'
                    : `${String(record.probationMonths)} months`,
              },
              { label: 'Expires On', value: formatDay(record.expiresOn) },
              { label: 'Job Title', value: record.jobTitleName ?? '—' },
              { label: 'Designation', value: record.designationName ?? '—' },
              { label: 'Department', value: record.departmentName ?? '—' },
              { label: 'Branch', value: record.branchName ?? '—' },
              { label: 'Offer Letter', value: <FileLink file={record.offerLetter} /> },
              { label: 'Sent', value: formatStamp(record.sentAt) },
              { label: 'Answered', value: formatStamp(record.respondedAt) },
              {
                label: 'Created',
                value: `${formatStamp(record.createdAt)}${record.createdByName ? ` by ${record.createdByName}` : ''}`,
              },
            ]}
          />
          {record.responseRemarks && (
            <DetailSection title="Candidate's Answer">
              <Prose>{record.responseRemarks}</Prose>
            </DetailSection>
          )}
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
