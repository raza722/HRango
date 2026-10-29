import { useId, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { uploadFile } from '@/lib/files'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  useAllOvertimePolicies,
  useOvertimeAttachment,
  useOvertimeDetail,
} from '../../hooks/use-overtime'
import type { OvertimeApplicationDetail } from '../../types/overtime.types'
import {
  dayLabel,
  durationLabel,
  OVERTIME_STATUS_LABELS,
  slabEncashmentLabel,
  stampLabel,
  stepStampLabel,
} from '../../utils/overtime-format'
import { policyOfPeriod, slabFor } from '../../utils/overtime-policy'
import { overtimeOutlineButtonClass } from '../../utils/overtime-styles'
import { OvertimeDialog, OvertimePersonCell, OvertimeReadOnly } from './overtime-parts'

const STEP_WORDS: Record<string, string> = {
  submitted: 'Requested',
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
  informed: 'Informed',
  forwarded: 'Forwarded',
  consented: 'Consented',
  disagreed: 'Disagreed',
  withdrawn: 'Withdrawn',
  cancel_requested: 'Cancellation requested',
}

/** The request's steps, oldest first: who acted (or is awaited), what they did, remarks. */
function Steps({ request }: { request: OvertimeApplicationDetail }) {
  return (
    <ol className="grid gap-2 text-sm text-title">
      {request.steps.map((step) => (
        <li key={step.id} className="grid gap-x-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="text-grey">{step.at ? stepStampLabel(step.at) : 'Waiting'}</span>
          <span>
            <span className="font-medium">{STEP_WORDS[step.action] ?? step.action}</span>
            {' — '}
            {step.label}
            {step.personName && <span className="text-grey"> ({step.personName})</span>}
            {step.remarks && <span className="text-grey">: {step.remarks}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** What the viewer may do with the images: add while the request is live, remove while pending. */
interface ImageRights {
  add: boolean
  remove: boolean
}

/**
 * The request's images as links; on your own live request, "Add Images" uploads one (`POST
 * /files`) and adds it (`POST /requests/overtime/{id}/attachments`), and × takes one off while
 * the request is pending (`DELETE …/attachments/{attachmentId}`).
 */
function Images({
  request,
  editable,
}: {
  request: OvertimeApplicationDetail
  editable: ImageRights
}) {
  const inputId = useId()
  const change = useOvertimeAttachment()
  const [uploading, setUploading] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const busy = uploading || change.isPending

  const add = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
    if (list.length === 0) return
    setFailure(null)
    setUploading(true)
    try {
      for (const file of list) {
        const uploaded = await uploadFile(file, 'requests')
        await change.mutateAsync({ id: request.id, addFileId: uploaded.id })
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The image was not added.')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (attachmentId: string) => {
    setFailure(null)
    try {
      await change.mutateAsync({ id: request.id, removeId: attachmentId })
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The image was not removed.')
    }
  }

  return (
    <div className="grid gap-2 @lg:col-span-2">
      <span className="text-sm leading-none text-title">Images</span>
      {request.attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Images of the request">
          {request.attachments.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
            >
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="max-w-48 truncate text-primary underline-offset-2 hover:underline"
              >
                {file.name}
              </a>
              {editable.remove && (
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={busy}
                  onClick={() => void remove(file.id)}
                  className="rounded-full p-0.5 text-grey hover:text-destructive disabled:opacity-50"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-grey">No images yet.</p>
      )}
      {editable.add && (
        <div>
          <label
            htmlFor={inputId}
            aria-disabled={busy}
            className={cn(
              overtimeOutlineButtonClass,
              'inline-flex cursor-pointer items-center gap-2',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            {uploading ? 'Adding…' : 'Add Images'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(event) => {
              void add(event.target.files)
              event.target.value = ''
            }}
          />
        </div>
      )}
      {failure && (
        <p role="alert" className="text-xs text-destructive">
          {failure}
        </p>
      )}
    </div>
  )
}

function Body({
  request,
  editable,
}: {
  request: OvertimeApplicationDetail
  editable: ImageRights
}) {
  const policies = useAllOvertimePolicies()
  const minutes = request.approvedMinutes
  const slab =
    minutes === null
      ? undefined
      : slabFor(policyOfPeriod(policies.data?.data ?? [], 'daily')?.slabs ?? [], minutes)
  return (
    <div className="grid gap-4 @lg:grid-cols-2">
      <div className="@lg:col-span-2">
        <OvertimePersonCell name={request.employeeName} code={request.employeeCode} />
      </div>
      <OvertimeReadOnly label="Code" value={request.code} />
      <OvertimeReadOnly label="Status" value={OVERTIME_STATUS_LABELS[request.status]} />
      <OvertimeReadOnly label="Department" value={request.departmentName ?? '—'} />
      <OvertimeReadOnly
        label="Location / Branch"
        value={[request.locationName, request.branchName].filter(Boolean).join(' · ') || '—'}
      />
      <OvertimeReadOnly label="Date" value={dayLabel(request.date)} />
      <OvertimeReadOnly
        label="Next Approver"
        value={request.status === 'pending' ? (request.nextApproverName ?? '—') : '—'}
      />
      <OvertimeReadOnly label="From" value={stampLabel(request.date, request.startTime)} />
      <OvertimeReadOnly label="To" value={stampLabel(request.date, request.endTime)} />
      <OvertimeReadOnly
        label="Applied Minutes"
        value={`${String(request.appliedMinutes)} (${durationLabel(request.appliedMinutes)})`}
      />
      <OvertimeReadOnly
        label="Approved Minutes"
        value={minutes === null ? '—' : `${String(minutes)} (${durationLabel(minutes)})`}
      />
      <OvertimeReadOnly
        label="Reason for Overtime"
        value={request.reason ?? '—'}
        className="@lg:col-span-2"
      />
      {slab && request.status === 'approved' && (
        <OvertimeReadOnly label="Daily Policy Slab" value={slabEncashmentLabel(slab)} />
      )}
      {request.cancelReason && (
        <OvertimeReadOnly label="Cancellation Reason" value={request.cancelReason} />
      )}
      {(request.attachments.length > 0 || editable.add) && (
        <Images request={request} editable={editable} />
      )}
      <section className="grid gap-3 @lg:col-span-2">
        <h3 className="text-base font-medium text-title">History</h3>
        <Steps request={request} />
      </section>
    </div>
  )
}

/**
 * View: one overtime request (`GET /requests/overtime/{id}`, or `/requests/approvals/{id}` from
 * Applications), read-only, with its steps and images. On your own request (My Overtime) you
 * may still add images while it is pending or approved, and take them off while pending.
 */
export function OvertimeViewDialog({
  id,
  via = 'request',
  onClose,
}: {
  id: string
  via?: 'request' | 'approvals'
  onClose: () => void
}) {
  const detail = useOvertimeDetail(id, via)
  const myEmployeeId = useAuthStore((state) => state.user?.employeeId ?? null)
  const canFile = useCan('requests.overtime.create')
  // Your own request, read from its own endpoint (My Overtime), while you may file overtime.
  const status =
    via === 'request' && canFile && detail.data?.employeeId === myEmployeeId
      ? detail.data.status
      : undefined
  const editable: ImageRights = {
    add: status === 'pending' || status === 'approved',
    remove: status === 'pending',
  }
  return (
    <OvertimeDialog
      title="Overtime Request"
      description={detail.data ? `${detail.data.code}, ${detail.data.employeeName}` : undefined}
      onClose={onClose}
      readOnly
      cancelLabel="Close"
      className="max-w-[53.5rem]"
    >
      {detail.isError ? (
        <ErrorState
          message={detail.error.message}
          onRetry={() => void detail.refetch()}
          className="shadow-none"
        />
      ) : detail.data ? (
        <Body request={detail.data} editable={editable} />
      ) : (
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
    </OvertimeDialog>
  )
}
