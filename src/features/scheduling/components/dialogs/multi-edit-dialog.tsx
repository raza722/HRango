import { useForm } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { CheckboxField, FieldLayoutContext, SelectField } from '@/components/form'
import { Button } from '@/components/ui/button'

import { useBulkEdit } from '../../hooks/use-scheduling'
import type { BulkEditInput } from '../../types/scheduling.types'
import { GeoFenceSelect } from '../fields/geo-fence-select'
import { TimeSlotSelectField } from '../fields/time-slot-select-field'
import { SchedulingDialog } from './scheduling-dialog'

interface MultiEditValues {
  /** '' = keep each shift's slot. */
  timeSlotId: string
  /** '' = keep each shift's fence (unless "Remove geo fence"). */
  geoFenceId: string
  clearGeoFence: boolean
  /** '' = keep, 'yes' / 'no' = set. */
  isWfh: '' | 'yes' | 'no'
}

const WFH_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

/**
 * "Scheduling Edit" for the shifts picked in multiselect mode
 * (`POST /scheduling/schedules/bulk-edit`): time slot, geo fence and work from home. Only
 * the fields you set are applied to every selected shift.
 */
export function MultiEditDialog({
  shiftIds,
  onClose,
  onDone,
}: {
  shiftIds: string[]
  onClose: () => void
  onDone: () => void
}) {
  const bulk = useBulkEdit()
  const form = useForm<MultiEditValues>({
    defaultValues: { timeSlotId: '', geoFenceId: '', clearGeoFence: false, isWfh: '' },
  })
  const { control } = form

  const submit = form.handleSubmit(async (values) => {
    const input: BulkEditInput = { ids: shiftIds }
    if (values.timeSlotId) input.timeSlotId = values.timeSlotId
    if (values.clearGeoFence) input.clearGeoFence = true
    else if (values.geoFenceId) input.geoFenceId = values.geoFenceId
    if (values.isWfh) input.isWfh = values.isWfh === 'yes'
    if (Object.keys(input).length === 1) {
      form.setError('root', {
        message: 'Change at least one field to apply it to the selected shifts.',
      })
      return
    }
    try {
      await bulk.mutateAsync(input)
    } catch {
      return
    }
    onDone()
    onClose()
  })

  const rootError = form.formState.errors.root?.message

  return (
    <SchedulingDialog
      title="Scheduling Edit"
      description={`${shiftIds.length} selected shift${shiftIds.length === 1 ? '' : 's'}. Only the fields you set are applied.`}
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          <Button
            type="submit"
            form="multi-edit-form"
            variant="success"
            size="lg"
            disabled={bulk.isPending}
            className={dialogButtonClass}
          >
            {bulk.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="multi-edit-form" noValidate onSubmit={submit} aria-label="Scheduling Edit">
        <FieldLayoutContext value="horizontal">
          <div className="grid gap-5">
            <TimeSlotSelectField
              control={control}
              name="timeSlotId"
              placeholder="Keep each shift's time slot"
              clearable="Keep each shift's time slot"
            />
            <GeoFenceSelect
              control={control}
              name="geoFenceId"
              label="Geo Fence"
              noneLabel="Keep each shift's geo fence"
            />
            <CheckboxField control={control} name="clearGeoFence" label="Remove geo fence" />
            <SelectField
              control={control}
              name="isWfh"
              label="Work From Home"
              placeholder="Keep as it is"
              options={WFH_OPTIONS}
              clearable="Keep as it is"
            />
            {rootError && (
              <p role="alert" className="text-sm text-destructive">
                {rootError}
              </p>
            )}
          </div>
        </FieldLayoutContext>
      </form>
    </SchedulingDialog>
  )
}
