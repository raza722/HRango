import { type Dispatch, type SetStateAction, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'

import uploadFolder from '@/assets/attendance/upload-folder.svg'
import {
  DatePickerField,
  FieldLayoutContext,
  SelectField,
  TextareaField,
  TextField,
  TimePickerField,
} from '@/components/form'
import { ApiError } from '@/lib/api-error'
import { uploadFile } from '@/lib/files'
import { cn } from '@/lib/utils'

import { useOrgLookup } from '../../hooks/use-attendance-settings'
import { useApplyOvertime, useOvertimeDetail, useUpdateOvertime } from '../../hooks/use-overtime'
import {
  APPLY_OVERTIME_DEFAULTS,
  applyOvertimeSchema,
  type ApplyOvertimeValues,
  toOvertimeBody,
} from '../../schemas/overtime.schema'
import type { OvertimeApplication } from '../../types/overtime.types'
import { apiField, minutesToHours } from '../../utils/overtime-format'
import { OvertimeDialog } from './overtime-parts'

/** The server's field names (with or without `details.`) → this form's. */
const FIELD_OF: Record<string, keyof ApplyOvertimeValues> = {
  departmentId: 'departmentId',
  locationId: 'locationId',
  branchId: 'branchId',
  overtimeDate: 'date',
  fromDate: 'date',
  toDate: 'date',
  startTime: 'startTime',
  endTime: 'endTime',
  appliedMinutes: 'overtimeHours',
  reason: 'reason',
}

interface Picture {
  /** The uploaded file's id. */
  id: string
  name: string
  preview: string | null
  /** Edit: an image the request already has (its attachment id, to take it off). */
  attachmentId?: string
}

/**
 * "Add Images": the drag-and-drop box of the frame (the folder, "Drag & Drop files Here or
 * Browse"). Each image is uploaded at once (`POST /files`, module `requests`) and its id
 * sent with the request (`attachments`); a thumbnail with × takes it off again.
 */
function ImageDropzone({
  pictures,
  onChange,
  onBusy,
}: {
  pictures: Picture[]
  onChange: Dispatch<SetStateAction<Picture[]>>
  onBusy: (busy: boolean) => void
}) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const add = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
    if (list.length === 0) return
    setFailure(null)
    onBusy(true)
    try {
      for (const file of list) {
        const uploaded = await uploadFile(file, 'requests')
        const preview = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null
        onChange((prev) => [...prev, { id: uploaded.id, name: uploaded.name, preview }])
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The image was not uploaded.')
    } finally {
      onBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm leading-none text-title">Add Images</span>
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => {
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void add(event.dataTransfer.files)
        }}
        className={cn(
          'flex min-h-[13.75rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-[#CFCFCF] px-4 py-6 text-center text-sm leading-[1.8] text-[#A4A4A4] transition-colors dark:border-input dark:text-label',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <img src={uploadFolder} alt="" aria-hidden="true" className="size-10" />
        <span>
          Drag &amp; Drop files Here
          <br />
          or <span className="font-medium text-title">Browse</span>
        </span>
      </label>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          void add(event.target.files)
          event.target.value = ''
        }}
      />
      {pictures.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Images added">
          {pictures.map((picture) => (
            <li
              key={picture.id}
              className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs text-title"
            >
              {picture.preview ? (
                <img src={picture.preview} alt="" className="size-8 rounded object-cover" />
              ) : null}
              <span className="max-w-32 truncate">{picture.name}</span>
              <button
                type="button"
                aria-label={`Remove ${picture.name}`}
                onClick={() => {
                  onChange(pictures.filter((item) => item.id !== picture.id))
                }}
                className="rounded-full p-0.5 text-grey hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {failure && (
        <p role="alert" className="text-xs text-destructive">
          {failure}
        </p>
      )}
    </div>
  )
}

/** A filed request's fields, as the form holds them. */
const valuesOf = (application: OvertimeApplication): ApplyOvertimeValues => ({
  departmentId: application.departmentId ?? '',
  locationId: application.locationId ?? '',
  branchId: application.branchId ?? '',
  date: application.date,
  startTime: application.startTime,
  endTime: application.endTime,
  overtimeHours: minutesToHours(application.appliedMinutes),
  reason: application.reason ?? '',
})

/**
 * "Apply for Overtime" (frame 2800:15314): Department *, Location, Branch, Date *, Start
 * Time *, End Time *, Overtime Hours *, Reason for Overtime and Add Images, with Apply and
 * Cancel at the bottom left. The end comes after the start, the hours fit between them, and
 * the API keeps one application per day.
 *
 * With `application`, the same popup edits a pending request nobody has acted on (`PUT`, then
 * the images taken off or added through the request's attachments); it reads the request
 * first for its rowVersion, its images and whether it may still be edited.
 */
export function ApplyOvertimeDialog({
  application,
  onClose,
}: {
  application?: OvertimeApplication
  onClose: () => void
}) {
  const formId = useId()
  const editing = application !== undefined
  const apply = useApplyOvertime()
  const edit = useUpdateOvertime()
  const detail = useOvertimeDetail(application?.id ?? '', 'request', editing)
  const departments = useOrgLookup('departments')
  const locations = useOrgLookup('locations')
  const branches = useOrgLookup('branches')
  const [pictures, setPictures] = useState<Picture[]>([])
  const [seeded, setSeeded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const form = useForm<ApplyOvertimeValues>({
    resolver: zodResolver(applyOvertimeSchema),
    defaultValues: application ? valuesOf(application) : APPLY_OVERTIME_DEFAULTS,
  })
  const options = (rows: { id: string; name: string }[] | undefined) =>
    (rows ?? []).map((row) => ({ value: row.id, label: row.name }))
  // Edit: the request's own images, once it is read.
  if (editing && detail.data && !seeded) {
    setSeeded(true)
    setPictures(
      detail.data.attachments.map((file) => ({
        id: file.fileId,
        name: file.name,
        preview: null,
        attachmentId: file.id,
      })),
    )
  }
  const refused = editing && detail.data !== undefined && !detail.data.actions.includes('edit')

  const save = async (values: ApplyOvertimeValues) => {
    if (!application) {
      await apply.mutateAsync(
        toOvertimeBody(
          values,
          pictures.map((picture) => picture.id),
        ),
      )
      return
    }
    const current = detail.data
    if (!current) return
    await edit.mutateAsync({
      id: application.id,
      body: { ...toOvertimeBody(values, []), rowVersion: current.rowVersion },
      addFileIds: pictures.filter((picture) => !picture.attachmentId).map((picture) => picture.id),
      removeAttachmentIds: current.attachments
        .filter((file) => !pictures.some((picture) => picture.attachmentId === file.id))
        .map((file) => file.id),
    })
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      await save(values)
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          const target = FIELD_OF[apiField(field)]
          if (target) {
            form.setError(target, { message })
            placed = true
          }
        }
        if (!placed) form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  return (
    <OvertimeDialog
      title={editing ? 'Edit Overtime Request' : 'Apply for Overtime'}
      description={application ? `${application.code}, ${application.employeeName}` : undefined}
      onClose={onClose}
      formId={formId}
      submitLabel={editing ? 'Save' : 'Apply'}
      pending={
        apply.isPending || edit.isPending || uploading || (editing && !detail.data) || refused
      }
      error={form.formState.errors.root?.message ?? detail.error?.message}
      className="max-w-[53.5rem]"
    >
      {refused && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          An approver has already acted on this request, so it can no longer be edited.
        </p>
      )}
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-4 @lg:grid-cols-2"
        >
          <SelectField
            control={form.control}
            name="departmentId"
            label="Department"
            placeholder="Select Department"
            options={options(departments.data)}
            required
          />
          <SelectField
            control={form.control}
            name="locationId"
            label="Location"
            placeholder="Select Location"
            options={options(locations.data)}
            clearable="No location"
          />
          <SelectField
            control={form.control}
            name="branchId"
            label="Branch"
            placeholder="Select Branch"
            options={options(branches.data)}
            clearable="No branch"
          />
          <DatePickerField
            control={form.control}
            name="date"
            label="Date"
            placeholder="Select Date"
            maxDate={new Date()}
            required
          />
          <TimePickerField control={form.control} name="startTime" label="Start Time" required />
          <TimePickerField control={form.control} name="endTime" label="End Time" required />
          <TextField
            control={form.control}
            name="overtimeHours"
            label="Overtime Hours"
            placeholder="Enter hours, e.g. 1.5"
            inputMode="decimal"
            required
          />
          <TextareaField
            control={form.control}
            name="reason"
            label="Reason for Overtime"
            placeholder="Write here"
            textareaClassName="min-h-[13.75rem]"
            className="@lg:col-start-1"
          />
          <ImageDropzone pictures={pictures} onChange={setPictures} onBusy={setUploading} />
        </form>
      </FieldLayoutContext>
    </OvertimeDialog>
  )
}
