import { useState } from 'react'
import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { Eye } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { SelectField } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { RosterGroupDetails, useRosterGroup } from '@/features/roster'

import { useRosterTones } from '../../hooks/use-roster-tones'

interface RosterSelectFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  required?: boolean
  onValueChange?: (value: string) => void
}

/** "Time Roster View": the roster group read-only, as on the Roster screen. */
function RosterViewDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const group = useRosterGroup(groupId)
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-5xl font-inter">
        <DialogHeader className="border-b pb-4">
          {/* Figma "Time Roster View": the title Inter Medium 20 #303030. */}
          <DialogTitle className="text-lg font-medium text-title sm:text-xl">View</DialogTitle>
          <DialogDescription className="sr-only">Time roster {group.data?.title}</DialogDescription>
        </DialogHeader>
        <div className="@container min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
          {group.data ? (
            <RosterGroupDetails group={group.data} />
          ) : (
            <Skeleton className="h-80 w-full" />
          )}
        </div>
        <div className="flex justify-end px-5 pb-5 sm:px-8">
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Time Roster": pick a roster group (Roster module) for the shift times,
 * with the red eye that opens its weekly pattern.
 */
export function RosterSelectField<
  TFieldValues extends FieldValues,
  TName extends FieldPathByValue<TFieldValues, string>,
>({
  control,
  name,
  label = 'Time Roster',
  required,
  onValueChange,
}: RosterSelectFieldProps<TFieldValues, TName>) {
  const tones = useRosterTones()
  const value = useWatch({ control, name }) as string
  const [viewing, setViewing] = useState(false)

  return (
    <div className="flex items-end gap-2">
      <SelectField
        control={control}
        name={name}
        label={label}
        required={required}
        placeholder="Select Time Roster"
        options={tones.groups.map((group) => ({ value: group.id, label: group.title }))}
        onValueChange={onValueChange}
        className="min-w-0 flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="View time roster"
        disabled={!value}
        onClick={() => {
          setViewing(true)
        }}
        className="mb-0.5 text-destructive"
      >
        <Eye className="size-5" />
      </Button>
      {viewing && value && (
        <RosterViewDialog
          groupId={value}
          onClose={() => {
            setViewing(false)
          }}
        />
      )}
    </div>
  )
}
