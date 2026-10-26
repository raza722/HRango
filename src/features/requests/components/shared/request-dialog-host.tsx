import type { AnyRequest, RequestAction } from '../../types/requests.types'
import {
  CancelRequestDialog,
  DeleteRequestDialog,
  ForwardRequestDialog,
  RequestFlowDialog,
  RequestHistoryDialog,
  RequestViewDialog,
} from '../dialogs/request-dialogs'
import { PunchRequestDialog } from '../punch/punch-request-dialog'
import { ShiftRequestDialog } from '../shift/shift-request-form'

export type RequestDialogState = { action: RequestAction | 'create'; request?: AnyRequest } | null

/** Opens the popup a row action or Create asks for. */
export function RequestDialogHost({
  kind,
  dialog,
  forOthers,
  fromApprovals = false,
  onClose,
}: {
  kind: AnyRequest['kind']
  dialog: RequestDialogState
  /** All tab: forms pick the employee. */
  forOthers: boolean
  /** Opened from Approvals: read the request as an approver. */
  fromApprovals?: boolean
  onClose: () => void
}) {
  if (!dialog) return null
  const { action, request } = dialog
  const via = fromApprovals ? 'approvals' : 'request'

  if (action === 'create' || action === 'edit') {
    if (kind === 'punch') {
      return (
        <PunchRequestDialog
          forOthers={forOthers}
          request={request?.kind === 'punch' ? request : undefined}
          onClose={onClose}
        />
      )
    }
    return request?.kind === 'shift' ? (
      <ShiftRequestDialog request={request} onClose={onClose} />
    ) : null
  }
  if (!request) return null
  switch (action) {
    case 'view':
      return (
        <RequestViewDialog kind={kind} id={request.id} mode="view" via={via} onClose={onClose} />
      )
    case 'decide':
    case 'consent':
      return <RequestViewDialog kind={kind} id={request.id} mode={action} onClose={onClose} />
    case 'flow':
      return <RequestFlowDialog kind={kind} id={request.id} via={via} onClose={onClose} />
    case 'history':
      return <RequestHistoryDialog kind={kind} id={request.id} via={via} onClose={onClose} />
    case 'cancel':
      return <CancelRequestDialog request={request} onClose={onClose} />
    case 'delete':
      return <DeleteRequestDialog request={request} onClose={onClose} />
    case 'forward':
      return <ForwardRequestDialog request={request} onClose={onClose} />
  }
}
