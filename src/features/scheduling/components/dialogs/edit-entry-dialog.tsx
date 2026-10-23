import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { CheckboxField, FieldLayoutContext } from '@/components/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { useUpdateEntry } from '../../hooks/use-scheduling'
import type { EntryPatch, ScheduleEntry } from '../../types/scheduling.types'
import { toDate } from '../../utils/schedule-dates'
import { GeoFenceSelect } from '../fields/geo-fence-select'
import { RosterSelectField } from '../fields/roster-select-field'
import { schedulingType } from '../type-styles'
import { SchedulingDialog } from './scheduling-dialog'

interface EditValues {
  rosterGroupId: string
  geoFenceIds: string[]
  restDay: boolean
}

/** A read-only date box, as the first row of Edit / View Scheduling. */
export function DateRow({ date }: { date: string }) {
  return (
    <div className="grid gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]">
      <span className={cn('@xl:py-2', schedulingType.label)}>Date</span>
      <span
        className={cn(
          'flex min-h-10 items-center rounded-md bg-muted px-3 sm:px-4',
          schedulingType.value,
        )}
      >
        {format(toDate(date), 'd MMMM, yyyy')}
      </span>
    </div>
  )
}

/** Edit Scheduling (one day): Time Roster, Apply Geo Fence and Rest Days. */
export function EditEntryDialog({ entry, onClose }: { entry: ScheduleEntry; onClose: () => void }) {
  const update = useUpdateEntry()
  const form = useForm<EditValues>({
    defaultValues: {
      rosterGroupId: entry.rosterGroupId ?? '',
      geoFenceIds: entry.geoFenceIds,
      restDay: entry.kind === 'rest',
    },
  })
  const { dirtyFields } = form.formState

  const submit = form.handleSubmit(async (values) => {
    const patch: EntryPatch = {}
    if (dirtyFields.rosterGroupId && values.rosterGroupId)
      patch.rosterGroupId = values.rosterGroupId
    if (dirtyFields.geoFenceIds) patch.geoFenceIds = values.geoFenceIds
    if (dirtyFields.restDay) patch.restDay = values.restDay
    if (Object.keys(patch).length === 0) {
      onClose()
      return
    }
    try {
      await update.mutateAsync({ id: entry.id, patch })
    } catch {
      return
    }
    onClose()
  })

  return (
    <SchedulingDialog
      title="Edit Scheduling"
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <>
          <Button
            type="submit"
            form="edit-entry-form"
            variant="success"
            size="lg"
            disabled={update.isPending}
            className={dialogButtonClass}
          >
            {update.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </>
      }
    >
      <form id="edit-entry-form" noValidate onSubmit={submit} aria-label="Edit Scheduling">
        <FieldLayoutContext value="horizontal">
          <div className="grid gap-5">
            <DateRow date={entry.date} />
            <RosterSelectField control={form.control} name="rosterGroupId" />
            <GeoFenceSelect control={form.control} name="geoFenceIds" />
            <CheckboxField control={form.control} name="restDay" label="Rest Days" />
          </div>
        </FieldLayoutContext>
      </form>
    </SchedulingDialog>
  )
}
