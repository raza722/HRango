import type { FileRef } from '@/lib/files'

import type { RequestPageSlug } from '../api/backend'
import { engineApi } from '../api/engine.api'
import type { RequestAttachment } from '../types/requests.types'

/** A request's attachment as a form keeps it. */
export const attachmentRef = (file: RequestAttachment): FileRef => ({
  id: file.fileId,
  name: file.name,
  url: file.url,
})

/** A detail's `fileId` / `fileName` / `fileUrl` as a form keeps it. */
export function detailFileRef(details: {
  fileId?: string | null
  fileName?: string | null
  fileUrl?: string | null
}): FileRef | null {
  return details.fileId
    ? { id: details.fileId, name: details.fileName ?? 'File', url: details.fileUrl ?? '' }
    : null
}

/**
 * After an edit (PUT does not touch files): adds the newly picked files and
 * removes the ones taken off the form.
 */
export async function syncAttachments(
  kind: RequestPageSlug,
  requestId: string,
  before: readonly RequestAttachment[],
  after: readonly (FileRef | null)[],
): Promise<void> {
  const wanted = new Set(after.flatMap((file) => (file ? [file.id] : [])))
  const had = new Set(before.map((file) => file.fileId))
  for (const file of before) {
    if (!wanted.has(file.fileId)) await engineApi.removeAttachment(kind, requestId, file.id)
  }
  for (const id of wanted) {
    if (!had.has(id)) await engineApi.addAttachment(kind, requestId, id)
  }
}
