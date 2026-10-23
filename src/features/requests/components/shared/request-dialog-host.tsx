import type { AnyRequest, RequestAction } from '../../types/requests.types'
import {
  CancelRequestDialog,
  DeleteRequestDialog,
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
  onClose,
}: {
  kind: AnyRequest['kind']
  dialog: RequestDialogState
  /** All tab: forms pick the employee. */
  forOthers: boolean
  onClose: () => void
}) {
  if (!dialog) return null
  const { action, request } = dialog

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
    case 'decide':
    case 'consent':
      return <RequestViewDialog kind={kind} id={request.id} mode={action} onClose={onClose} />
    case 'flow':
      return <RequestFlowDialog request={request} onClose={onClose} />
    case 'history':
      return <RequestHistoryDialog kind={kind} id={request.id} onClose={onClose} />
    case 'cancel':
      return <CancelRequestDialog request={request} onClose={onClose} />
    case 'delete':
      return <DeleteRequestDialog request={request} onClose={onClose} />
  }
}
