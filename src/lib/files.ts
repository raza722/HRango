import { apiClient } from './axios'

/**
 * Uploads (`POST /files`). Upload first, then send the returned `id` with the form that uses the
 * file. Records hand files back as {@link FileRef}: `url` is a signed link that works in a plain
 * `<a href>` or `<img src>` and expires after a while (open the record again for a fresh one).
 */

/** The `module` an upload belongs to: also the folder it is stored in on the server. */
export type UploadModule =
  | 'core'
  | 'organisation'
  | 'employees'
  | 'attendance'
  | 'requests'
  | 'leaves'
  | 'loans'
  | 'payroll'
  | 'assets'
  | 'offboarding'
  | 'manpower'
  | 'recruitment'
  | 'performance'
  | 'training'
  | 'benefits'
  | 'engagement'
  | 'projects'

/** A file as a record shows it. */
export interface FileRef {
  id: string
  name: string | null
  url: string
}

/** What `POST /files` answers. */
export interface UploadedFile extends FileRef {
  name: string
  extension: string
  mimeType: string
  sizeBytes: number
  module: string
  createdAt: string
}

/** Uploads one file; `onProgress` receives 0-100. Rejects with an ApiError (type, size). */
export async function uploadFile(
  file: File,
  module: UploadModule,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  const form = new FormData()
  form.append('file', file)
  form.append('module', module)
  const { data } = await apiClient.post<{ data: UploadedFile }>('/files', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data.data
}

/** Uploads several files one after another; returns them in the same order. */
export async function uploadFiles(files: File[], module: UploadModule): Promise<UploadedFile[]> {
  const out: UploadedFile[] = []
  for (const file of files) out.push(await uploadFile(file, module))
  return out
}

/** Deletes an upload you made that no record uses yet (e.g. removed from a form before saving). */
export async function deleteUpload(id: string): Promise<void> {
  await apiClient.delete(`/files/${id}`)
}

/** Types the server accepts (checked again on the server, by content). */
export const ACCEPTED_FILE_TYPES =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.csv,.txt,.rtf,.zip,.mp4,.mov,.webm'
