import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

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

/** Edit Open Position (not drawn; laid out as Add Budget Duration): how many, and until when. */
export function OpenPositionDialog({
  position,
  onClose,
}: {
  position: OpenPosition
  onClose: () => void
}) {
  const save = useUpdateOpenPosition()
  const form = useForm<OpenPositionFormValues>({
    resolver: zodResolver(openPositionFormSchema),
    defaultValues: { totalPositions: String(position.totalPositions), endDate: position.endDate },
  })
  const { control, register, handleSubmit, formState, setError } = form
  const submit = handleSubmit((values) => {
    save.mutate(
      {
        id: position.id,
        input: { totalPositions: toAmount(values.totalPositions), endDate: values.endDate },
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
            <MpField label="End Date" required layout="inline" error={fieldState.error?.message}>
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
        <button
          type="submit"
          disabled={save.isPending}
          className={cn(dialogButton, accent.bg, 'mt-2 w-[11.5625rem] justify-self-center')}
        >
          Save Position
        </button>
      </form>
    </MpDialog>
  )
}
