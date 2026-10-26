import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api-error'
import { type FileRef, uploadFile } from '@/lib/files'
import { cn } from '@/lib/utils'

import { useUpdateOpenPosition } from '../../hooks/use-manpower'
import {
  openPositionFormSchema,
  type OpenPositionFormValues,
} from '../../schemas/dialog-forms.schema'
import type { OpenPosition } from '../../types/manpower.types'
import { showSaveError } from '../../utils/errors'
import { toAmount } from '../../utils/plan-math'
import { DateBox, MpField } from '../shared/controls'
import { accent, dialogBoxClass, dialogButton } from '../shared/mp-styles'
import { MpDialog } from '../shared/popups'

/** Job descriptions: PDF or Word. */
const JD_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt'

/**
 * Edit Open Position (not drawn; laid out as Add Budget Duration): how many, until when,
 * and its job description (uploaded, then saved by its file id).
 */
export function OpenPositionDialog({
  position,
  onClose,
}: {
  position: OpenPosition
  onClose: () => void
}) {
  const save = useUpdateOpenPosition()
  const input = useRef<HTMLInputElement>(null)
  const [jd, setJd] = useState<FileRef | null>(position.jdFile)
  const [uploading, setUploading] = useState(false)
  const form = useForm<OpenPositionFormValues>({
    resolver: zodResolver(openPositionFormSchema),
    defaultValues: {
      totalPositions: String(position.totalPositions),
      endDate: position.endDate ?? '',
    },
  })
  const { control, register, handleSubmit, formState, setError } = form
  const submit = handleSubmit((values) => {
    save.mutate(
      {
        id: position.id,
        input: {
          totalPositions: toAmount(values.totalPositions),
          endDate: values.endDate || null,
          jdFileId: jd?.id ?? null,
          rowVersion: position.rowVersion,
        },
      },
      {
        onSuccess: onClose,
        onError: (error) => {
          showSaveError(
            error,
            setError,
            ['totalPositions', 'endDate'],
            'The open position could not be saved.',
          )
        },
      },
    )
  })
  return (
    <MpDialog title={`Edit ${position.title}`} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
        <MpField
          label="Total Positions"
          required
          layout="inline"
          error={formState.errors.totalPositions?.message}
        >
          {(a11y) => (
            <input
              {...a11y}
              {...register('totalPositions')}
              inputMode="numeric"
              className={cn(dialogBoxClass, 'w-full')}
            />
          )}
        </MpField>
        <Controller
          control={control}
          name="endDate"
          render={({ field, fieldState }) => (
            <MpField label="End Date" layout="inline" error={fieldState.error?.message}>
              {(a11y) => (
                <DateBox
                  {...a11y}
                  value={field.value}
                  onChange={field.onChange}
                  className={dialogBoxClass}
                />
              )}
            </MpField>
          )}
        />
        <MpField label="Job Description" layout="inline">
          {(a11y) => (
            <div className="flex min-w-0 items-center gap-2">
              <span
                id={a11y.id}
                className={cn(
                  dialogBoxClass,
                  'flex min-w-0 flex-1 items-center truncate',
                  !jd && 'text-[#818CA3]',
                )}
              >
                {uploading ? 'Uploading…' : (jd?.name ?? 'No file chosen')}
              </span>
              <button
                type="button"
                disabled={uploading}
                onClick={() => input.current?.click()}
                className={cn(dialogButton, accent.outline, 'w-auto shrink-0 px-3')}
              >
                {jd ? 'Replace' : 'Choose File'}
              </button>
              {jd && (
                <button
                  type="button"
                  onClick={() => {
                    setJd(null)
                  }}
                  className={cn(dialogButton, accent.outline, 'w-auto shrink-0 px-3')}
                >
                  Remove
                </button>
              )}
              <input
                ref={input}
                type="file"
                accept={JD_ACCEPT}
                aria-label="Upload the job description"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  setUploading(true)
                  uploadFile(file, 'manpower')
                    .then((uploaded) => {
                      setJd({ id: uploaded.id, name: uploaded.name, url: uploaded.url })
                    })
                    .catch((error: unknown) => {
                      toast.error(
                        error instanceof ApiError
                          ? error.message
                          : 'The file could not be uploaded.',
                      )
                    })
                    .finally(() => {
                      setUploading(false)
                    })
                }}
              />
            </div>
          )}
        </MpField>
        <button
          type="submit"
          disabled={save.isPending || uploading}
          className={cn(dialogButton, accent.bg, 'mt-2 w-[11.5625rem] justify-self-center')}
        >
          Save Position
        </button>
      </form>
    </MpDialog>
  )
}
