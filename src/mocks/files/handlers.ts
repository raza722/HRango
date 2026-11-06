import { http, HttpResponse } from 'msw'

import type { UploadedFile } from '@/lib/files'
import type { ApiItem } from '@/types/api'

import { apiPath, createId, errorResponse, latency, requireAuth } from '../utils'

/** Uploads kept in memory, so a mocked record can hand back a link to the file. */
const uploads = new Map<string, { file: UploadedFile; blob: Blob }>()

/** A one-page PDF (ASCII, so its length is its byte count) saying the file is a sample. */
function placeholderPdf(): string {
  const stream = 'BT /F1 14 Tf 72 720 Td (Sample file: the demo keeps no copy of it.) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, index) => {
    const offset = pdf.length
    pdf += `${String(index + 1)} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  const entries = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
  return `${pdf}xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n${entries.join('')}trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
}

/**
 * What a link to a file the mock holds no bytes for opens: the seeded records' files, and
 * uploads made before a reload (records keep their links in sessionStorage, uploads live in memory).
 */
const PLACEHOLDER_PDF = placeholderPdf()

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
    if (!found) {
      return new HttpResponse(PLACEHOLDER_PDF, { headers: { 'Content-Type': 'application/pdf' } })
    }
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

/**
 * An upload as `POST /files` answered it (name, type, size), for a mocked record that takes the
 * file, as the API reads them from its file store. Null for an id the mock was not sent.
 */
export function mockUpload(id: string): UploadedFile | null {
  return uploads.get(id)?.file ?? null
}

/** A signed link the mock serves, for mocked records that hold a file. */
export function mockFileUrl(id: string): string {
  return apiPath(`/files/${id}/download?token=mock`)
}
