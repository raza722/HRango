import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { FileRef } from '@/lib/files'

import type { RequestAttachment } from '../../../types/requests.types'
import { attachmentRef } from '../../../utils/request-files'
import { standardDetailQueryOptions } from '../../standard.api'
import type { StandardKind, StandardRequest } from '../../standard.types'

/**
 * The form's one "Attachment". Lists carry no files, so an Edit reads the
 * request's detail for them; until the person picks or removes a file the
 * field shows the request's first attachment. `before` is what the request
 * had (for `syncAttachments` after the edit).
 */
export function useRequestAttachment<P>(
  kind: StandardKind,
  request: StandardRequest<P> | undefined,
): {
  attachment: FileRef | null
  setAttachment: (file: FileRef | null) => void
  before: RequestAttachment[]
} {
  const detail = useQuery({
    ...standardDetailQueryOptions<P>(kind, request?.id ?? '', 'request'),
    enabled: Boolean(request),
  })
  const before = detail.data?.request.attachments ?? request?.attachments ?? []
  const [picked, setPicked] = useState<{ file: FileRef | null } | null>(null)
  const first = before[0]
  return {
    attachment: picked ? picked.file : first ? attachmentRef(first) : null,
    setAttachment: (file) => {
      setPicked({ file })
    },
    before,
  }
}
