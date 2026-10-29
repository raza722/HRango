import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { TextareaField } from '@/components/form'

import { remarksFormSchema, type RemarksFormValues } from '../../schemas/recruitment-forms.schema'
import { showServerErrors } from '../../utils/form-errors'
import { blank } from '../../utils/format'
import { FormDialog } from './dialog-parts'

/**
 * A confirmation with remarks: Withdraw Application, Cancel Interview, Send Offer, Withdraw Offer.
 * `onSubmit` runs the call; a failure shows under the box or beside the buttons.
 */
export function RemarksDialog({
  title,
  intro,
  label = 'Remarks',
  requiredMessage,
  saveLabel,
  saving,
  onSubmit,
  onClose,
}: {
  title: string
  intro: ReactNode
  label?: string
  /** Make the remarks required, with this message when empty. */
  requiredMessage?: string
  saveLabel: string
  saving: boolean
  onSubmit: (remarks: string | null) => Promise<unknown>
  onClose: () => void
}) {
  const form = useForm<RemarksFormValues>({
    resolver: zodResolver(remarksFormSchema(requiredMessage)),
    defaultValues: { remarks: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(blank(values.remarks))
      onClose()
    } catch (error) {
      showServerErrors(error, form.setError, ['remarks'])
    }
  })
  return (
    <FormDialog
      title={title}
      onClose={onClose}
      onSubmit={submit}
      saving={saving}
      saveLabel={saveLabel}
      rootError={form.formState.errors.root?.message}
      className="max-w-xl"
    >
      <div className="text-sm text-heading">{intro}</div>
      <TextareaField
        control={form.control}
        name="remarks"
        label={label}
        required={requiredMessage !== undefined}
        maxLength={4000}
      />
    </FormDialog>
  )
}
