import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { CheckboxField, FieldLayoutContext, SelectField, TextField } from '@/components/form'
import { cn } from '@/lib/utils'

import { useOvertimeLeaveTypes } from '../../hooks/use-overtime'
import { SLAB_DEFAULTS, slabSchema, type SlabValues } from '../../schemas/overtime.schema'
import { slabFieldsClass } from '../../utils/overtime-styles'
import { OvertimeDialog } from './overtime-parts'

export type SlabDialogMode = 'create' | 'edit' | 'view'

const TITLES: Record<SlabDialogMode, string> = {
  create: 'Slab Create',
  edit: 'Slab Edit',
  view: 'Slab View',
}

/** Slab View draws every box grey (#D9D9D9) with the value in #707070. */
const viewClass =
  '[&_input:disabled]:border-[#CFCFCF] [&_input:disabled]:bg-chip [&_input:disabled]:text-grey [&_input:disabled]:opacity-100 [&_[data-slot=select-trigger]:disabled]:bg-chip [&_[data-slot=select-trigger]:disabled]:text-grey [&_[data-slot=select-trigger]:disabled]:opacity-100 dark:[&_input:disabled]:bg-input dark:[&_[data-slot=select-trigger]:disabled]:bg-input'

/**
 * "Slab Create" / "Slab Edit" / "Slab View" (frames 4207:75070, 4212:75951, 4212:76217): Full
 * Day, Minimum Minutes *, Maximum Minutes *, Encashment Type *; Cancel and Save at the bottom
 * left (View: Cancel only). Full Day is the API's `full_day` encashment; otherwise Encashment
 * Type picks the leave type the slab encashes into (`leave` + `leaveTypeId`, from
 * `GET /leaves/types`). Saving hands the slab back to the policy form.
 */
export function SlabDialog({
  mode,
  slab,
  onSave,
  onClose,
}: {
  mode: SlabDialogMode
  slab: SlabValues | null
  onSave: (values: SlabValues) => void
  onClose: () => void
}) {
  const formId = useId()
  const readOnly = mode === 'view'
  const leaveTypes = useOvertimeLeaveTypes()
  const form = useForm<SlabValues>({
    resolver: zodResolver(slabSchema),
    defaultValues: slab ?? SLAB_DEFAULTS,
  })
  const fullDay = useWatch({ control: form.control, name: 'fullDay' })
  const types = leaveTypes.data ?? []
  // A saved slab's leave type stays listed even when the type is inactive or not readable.
  const options = [
    ...types
      .filter((type) => type.isActive || type.id === slab?.leaveTypeId)
      .map((type) => ({ value: type.id, label: type.title })),
    ...(slab?.leaveTypeId && !types.some((type) => type.id === slab.leaveTypeId)
      ? [{ value: slab.leaveTypeId, label: slab.leaveTypeName || `Leave type ${slab.leaveTypeId}` }]
      : []),
  ]
  const submit = form.handleSubmit((values) => {
    const chosen = options.find((option) => option.value === values.leaveTypeId)
    onSave(
      values.fullDay
        ? { ...values, leaveTypeId: '', leaveTypeName: '' }
        : { ...values, leaveTypeName: chosen?.label ?? values.leaveTypeName },
    )
    onClose()
  })

  return (
    <OvertimeDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      submitLabel="Save"
      readOnly={readOnly}
      className={cn('max-w-md', slabFieldsClass, readOnly && viewClass)}
    >
      <FieldLayoutContext value="vertical">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-5"
        >
          <CheckboxField
            control={form.control}
            name="fullDay"
            label="Full Day"
            tone="navy"
            disabled={readOnly}
            onCheckedChange={(checked) => {
              if (checked) {
                form.setValue('leaveTypeId', '')
                form.clearErrors('leaveTypeId')
              }
            }}
            className="flex-col items-start gap-y-2.5 [&_label]:order-1 [&_label]:text-sm [&_label]:font-medium [&_label]:text-title [&>div]:order-2"
          />
          <TextField
            control={form.control}
            name="minMinutes"
            label="Minimum Minutes"
            placeholder="Enter"
            inputMode="numeric"
            required
            disabled={readOnly}
          />
          <TextField
            control={form.control}
            name="maxMinutes"
            label="Maximum Minutes"
            placeholder="Enter"
            inputMode="numeric"
            required
            disabled={readOnly}
          />
          <SelectField
            control={form.control}
            name="leaveTypeId"
            label="Encashment Type"
            placeholder={fullDay ? 'Full Day' : 'Select Encashment Type'}
            options={options}
            required={!fullDay}
            disabled={readOnly || fullDay}
            description={
              !fullDay && leaveTypes.isError
                ? 'The leave types could not be read.'
                : !fullDay && leaveTypes.isSuccess && options.length === 0
                  ? 'No active leave type: add one under Leaves → Settings → Leave Types.'
                  : undefined
            }
          />
        </form>
      </FieldLayoutContext>
    </OvertimeDialog>
  )
}
