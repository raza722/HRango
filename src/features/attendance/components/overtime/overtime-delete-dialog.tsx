import { useState } from 'react'

import { ApiError } from '@/lib/api-error'

import { useDeleteOvertime, useOvertimeDetail } from '../../hooks/use-overtime'
import type { OvertimeApplication } from '../../types/overtime.types'
import { stampLabel } from '../../utils/overtime-format'
import { OvertimeDialog } from './overtime-parts'

/**
 * Delete on My Overtime (`DELETE /requests/overtime/{id}?rowVersion`): a pending request nobody
 * has acted on goes for good (Withdraw keeps it in the list as cancelled). Reads the request
 * first for its rowVersion and whether it may still be deleted.
 */
export function OvertimeDeleteDialog({
  application,
  onClose,
}: {
  application: OvertimeApplication
  onClose: () => void
}) {
  const remove = useDeleteOvertime()
  const detail = useOvertimeDetail(application.id)
  const [error, setError] = useState<string | null>(null)
  const refused = detail.data !== undefined && !detail.data.actions.includes('delete')

  const submit = async () => {
    if (!detail.data) return
    setError(null)
    try {
      await remove.mutateAsync({ id: application.id, rowVersion: detail.data.rowVersion })
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'The request was not deleted.')
      return
    }
    onClose()
  }

  return (
    <OvertimeDialog
      title="Delete Overtime Request"
      description={`${application.code}, ${application.employeeName}`}
      onClose={onClose}
      onSubmit={() => void submit()}
      submitLabel="Delete"
      pending={remove.isPending || !detail.data || refused}
      error={error ?? detail.error?.message}
      className="max-w-xl"
    >
      <div className="grid gap-3 text-sm text-title">
        <p>
          {application.code}: {stampLabel(application.date, application.startTime)} to{' '}
          {stampLabel(application.date, application.endTime)}, {application.appliedMinutes} minutes.
        </p>
        <p>The request is deleted for good. Withdraw instead keeps it in your list as cancelled.</p>
        {refused && (
          <p role="alert" className="text-destructive">
            An approver has already acted on this request, so it can no longer be deleted. Withdraw
            it instead.
          </p>
        )}
      </div>
    </OvertimeDialog>
  )
}
