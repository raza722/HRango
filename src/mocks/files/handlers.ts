import { http, HttpResponse } from 'msw'

import type { UploadedFile } from '@/lib/files'
import type { ApiItem } from '@/types/api'

import { apiPath, createId, errorResponse, latency, requireAuth } from '../utils'

/** Uploads kept in memory, so a mocked record can hand back a link to the file. */
const uploads = new Map<string, { file: UploadedFile; blob: Blob }>()

interface ReadUpload {
  file: File | null
  module: string
}

/**
 * Reads the multipart body. Under jsdom (tests) `request.formData()` rejects jsdom's File, so the
 * body is parsed by hand there: enough for a mock (name, type, bytes of the "file" part, "module").
 */
async function readUpload(request: Request): Promise<ReadUpload> {
  const copy = request.clone()
  try {
    const form = await request.formData()
    const file = form.get('file')
    const module = form.get('module')
    return {
      file: file instanceof File ? file : null,
      module: typeof module === 'string' ? module : 'core',
    }
  } catch {
    const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(copy.headers.get('Content-Type') ?? '')
    const text = await copy.text()
    if (!boundary) return { file: null, module: 'core' }
    let file: File | null = null
    let module = 'core'
    for (const part of text.split(`--${boundary[1] ?? boundary[2] ?? ''}`)) {
      const split = part.indexOf('\r\n\r\n')
      if (split === -1) continue
      const head = part.slice(0, split)
      const body = part.slice(split + 4).replace(/\r\n$/, '')
      const name = /name="([^"]*)"/.exec(head)?.[1]
      if (name === 'module') module = body.trim() || 'core'
      if (name === 'file') {
        const filename = /filename="([^"]*)"/.exec(head)?.[1] ?? 'file'
        const type = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] ?? 'application/octet-stream'
        file = new File([body], filename, { type })
      }
    }
    return { file, module }
  }
}

/** The mock of the backend's file service (`POST /files`, signed download links). */
export const filesHandlers = [
  http.post(apiPath('/files'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const { file, module } = await readUpload(request)
    if (!file) {
      return errorResponse(422, 'Some fields need your attention.', {
        code: 'VALIDATION_FAILED',
        fieldErrors: { file: 'Choose a file.' },
      })
    }
    const id = createId('file')
    const extension = file.name.includes('.')
      ? (file.name.split('.').pop() ?? '').toLowerCase()
      : ''
    const stored: UploadedFile = {
      id,
      name: file.name,
      extension,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      module,
      url: apiPath(`/files/${id}/download?token=mock`),
      createdAt: new Date().toISOString(),
    }
    uploads.set(id, { file: stored, blob: file })
    return HttpResponse.json<ApiItem<UploadedFile>>({ data: stored }, { status: 201 })
  }),

  http.get(apiPath('/files/:id/download'), ({ params }) => {
    const found = uploads.get(String(params.id))
    if (!found) return errorResponse(404, 'File not found.', { code: 'NOT_FOUND' })
    return new HttpResponse(found.blob, { headers: { 'Content-Type': found.file.mimeType } })
  }),

  http.delete(apiPath('/files/:id'), ({ params }) => {
    uploads.delete(String(params.id))
    return new HttpResponse(null, { status: 204 })
  }),
]

/** The name an upload was made with (mocked records show it beside the file id). */
export function mockUploadName(id: string): string | null {
  return uploads.get(id)?.file.name ?? null
}

/** A signed link the mock serves, for mocked records that hold a file. */
export function mockFileUrl(id: string): string {
  return apiPath(`/files/${id}/download?token=mock`)
}
