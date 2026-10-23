import { useController, useForm, useWatch } from 'react-hook-form'
import { Loader2 } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import {
  CheckboxField,
  FieldLayoutContext,
  SelectField,
  TextField,
  TimePickerField,
} from '@/components/form'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { BREAK_TYPE_LABELS } from '../../constants'
import { useBulkUpdateEntries } from '../../hooks/use-scheduling'
import {
  BREAK_TYPES,
  type BreakType,
  type EntryPatch,
  type TimeSlotRules,
} from '../../types/scheduling.types'
import { GeoFenceSelect } from '../fields/geo-fence-select'
import { RosterSelectField } from '../fields/roster-select-field'
import { schedulingType } from '../type-styles'
import { SchedulingDialog } from './scheduling-dialog'

interface MultiEditValues {
  rosterGroupId: string
  geoFenceIds: string[]
  workFromHome: boolean
  restDay: boolean
  name: string
  isOvernight: boolean
  reverseDecision: boolean
  durationRules: boolean
  mode: 'flexible' | 'total'
  workableHours: string
  totalHours: string
  shortOvertime: boolean
  fullOvertime: boolean
  breakType: BreakType | ''
  breakOut: string
  breakIn: string
  breakDescription: string
}

const BREAK_OPTIONS = BREAK_TYPES.map((type) => ({ value: type, label: BREAK_TYPE_LABELS[type] }))

/**
 * "Scheduling Edit" for the shifts picked in multiselect mode. Only the
 * fields you change are applied to every selected day.
 */
export function MultiEditDialog({
  entryIds,
  onClose,
  onDone,
}: {
  entryIds: string[]
  onClose: () => void
  onDone: () => void
}) {
  const bulk = useBulkUpdateEntries()
  const form = useForm<MultiEditValues>({
    defaultValues: {
      rosterGroupId: '',
      geoFenceIds: [],
      workFromHome: false,
      restDay: false,
      name: '',
      isOvernight: false,
      reverseDecision: false,
      durationRules: false,
      mode: 'flexible',
      workableHours: '8',
      totalHours: '48',
      shortOvertime: false,
      fullOvertime: false,
      breakType: '',
      breakOut: '',
      breakIn: '',
      breakDescription: '',
    },
  })
  const { control } = form
  const { dirtyFields } = form.formState
  const durationRules = useWatch({ control, name: 'durationRules' })
  const { field: modeField } = useController({ control, name: 'mode' })

  const submit = form.handleSubmit(async (values) => {
    const patch: EntryPatch = {}
    const slot: Partial<TimeSlotRules> = {}
    if (dirtyFields.rosterGroupId && values.rosterGroupId)
      patch.rosterGroupId = values.rosterGroupId
    if (dirtyFields.geoFenceIds) patch.geoFenceIds = values.geoFenceIds
    if (dirtyFields.workFromHome) patch.workFromHome = values.workFromHome
    if (dirtyFields.restDay) patch.restDay = values.restDay
    if (dirtyFields.name && values.name.trim()) slot.name = values.name.trim()
    if (dirtyFields.isOvernight) slot.isOvernight = values.isOvernight
    if (dirtyFields.reverseDecision) slot.reverseDecision = values.reverseDecision
    if (dirtyFields.shortOvertime) slot.shortOvertime = values.shortOvertime
    if (dirtyFields.fullOvertime) slot.fullOvertime = values.fullOvertime
    if (
      dirtyFields.durationRules ||
      dirtyFields.mode ||
      dirtyFields.workableHours ||
      dirtyFields.totalHours
    ) {
      slot.mode = values.durationRules ? values.mode : 'fixed'
      slot.workableMinutes =
        values.durationRules && values.mode === 'flexible'
          ? Math.round(Number(values.workableHours) * 60)
          : null
      slot.totalMinutes =
        values.durationRules && values.mode === 'total'
          ? Math.round(Number(values.totalHours) * 60)
          : null
    }
    if (Object.keys(slot).length > 0) patch.slot = slot
    if (values.breakType && values.breakOut && values.breakIn) {
      patch.breaks = [
        {
          type: values.breakType,
          startDate: '0001-01-01',
          endDate: '9999-12-31',
          startTime: values.breakOut,
          endTime: values.breakIn,
          description: values.breakDescription.trim(),
          inclusive: false,
        },
      ]
    }
    if (Object.keys(patch).length === 0) {
      form.setError('root', {
        message: 'Change at least one field to apply it to the selected days.',
      })
      return
    }
    try {
      await bulk.mutateAsync({ ids: entryIds, patch })
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
      description={`${entryIds.length} selected day${entryIds.length === 1 ? '' : 's'}. Only the fields you change are applied.`}
      onRequestClose={onClose}
      className="max-w-4xl"
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
            <RosterSelectField control={control} name="rosterGroupId" />
            <GeoFenceSelect control={control} name="geoFenceIds" label="Geo Fence" />
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <CheckboxField control={control} name="workFromHome" label="Work From Home" />
              <CheckboxField control={control} name="restDay" label="Rest Days" />
            </div>
            <TextField
              control={control}
              name="name"
              label="Name"
              placeholder="Time slot name"
              maxLength={60}
            />
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <CheckboxField control={control} name="isOvernight" label="Is Overnight" />
              <CheckboxField control={control} name="reverseDecision" label="Reverse Decision" />
              <CheckboxField control={control} name="durationRules" label="Total Duration" />
            </div>
            <fieldset
              disabled={!durationRules}
              className={cn('grid gap-4', !durationRules && 'opacity-60')}
            >
              <legend className="sr-only">How the hours are counted</legend>
              {(
                [
                  ['flexible', 'Is Flexible', 'workableHours', 'Workable Hours'],
                  ['total', 'Total Duration', 'totalHours', 'Total Duration hours'],
                ] as const
              ).map(([value, label, name, caption]) => (
                <div
                  key={value}
                  className="grid items-center gap-x-6 gap-y-2 @xl:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <label className={cn('flex items-center gap-2.5', schedulingType.label)}>
                    <input
                      type="radio"
                      name={modeField.name}
                      checked={modeField.value === value}
                      onChange={() => {
                        modeField.onChange(value)
                      }}
                      className="size-4 accent-[var(--primary)]"
                    />
                    {label}
                  </label>
                  <TextField
                    control={control}
                    name={name}
                    label={caption}
                    inputMode="decimal"
                    disabled={!durationRules || modeField.value !== value}
                    className="[&>label]:sr-only"
                  />
                </div>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <CheckboxField control={control} name="shortOvertime" label="Short Overtime" />
              <CheckboxField control={control} name="fullOvertime" label="Full Overtime" />
            </div>

            <h3 className={cn('pt-2', schedulingType.section)}>Breaks</h3>
            <FieldLayoutContext value="vertical">
              <div className="grid gap-3 @2xl:grid-cols-4">
                <SelectField
                  control={control}
                  name="breakType"
                  label="Break Type"
                  placeholder="Personal"
                  options={BREAK_OPTIONS}
                />
                <TimePickerField control={control} name="breakOut" label="Mark Break Out" />
                <TimePickerField control={control} name="breakIn" label="Mark Break In" />
                <TextField
                  control={control}
                  name="breakDescription"
                  label="Description"
                  placeholder="New One"
                  maxLength={200}
                />
              </div>
            </FieldLayoutContext>
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
