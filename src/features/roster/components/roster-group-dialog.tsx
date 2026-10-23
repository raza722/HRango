import { useState } from 'react'
import { FormProvider } from 'react-hook-form'
import { Loader2, Pencil } from 'lucide-react'

import { dialogButtonClass } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { CheckboxField, SwitchField, TextField, TimePickerField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { ROSTER_TITLE_MAX_LENGTH } from '../constants'
import { useRosterGroupForm } from '../hooks/use-roster-group-form'
import { useRosterGroup } from '../hooks/use-roster-groups'
import type { RosterGroup } from '../types/roster.types'
import { RosterDialogShell } from './roster-dialog-shell'
import { RosterGroupDetails } from './roster-group-details'
import { RosterScheduleFields } from './roster-schedule-fields'
import { ShiftMinutes } from './shift-minutes'

export type RosterGroupDialogMode = 'add' | 'edit' | 'view'

interface RosterGroupDialogProps {
  mode: RosterGroupDialogMode
  /** Group to edit or view (ignored when adding). */
  groupId: string | undefined
  onClose: () => void
  /** "Edit" in the View dialog. */
  onEdit: (groupId: string) => void
}

function RosterGroupForm({
  group,
  onClose,
}: {
  group: RosterGroup | undefined
  onClose: () => void
}) {
  const { form, submit, isSaving, applyToAll, clockIn, clockOut } = useRosterGroupForm({
    group,
    onSaved: onClose,
  })
  const { control } = form
  const { isDirty } = form.formState
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const formId = group ? `roster-form-${group.id}` : 'roster-form-new'

  const requestClose = () => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  return (
    <RosterDialogShell
      title={group ? 'Edit Roster Group' : 'Add Roster Group'}
      onRequestClose={requestClose}
      footer={
        <>
          <Button
            type="submit"
            form={formId}
            variant="success"
            size="lg"
            disabled={isSaving}
            className={dialogButtonClass}
          >
            {isSaving && <Loader2 className="animate-spin" />}
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={isSaving}
            onClick={requestClose}
            className={dialogButtonClass}
          >
            Cancel
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form id={formId} noValidate onSubmit={submit} aria-label="Roster group">
          <fieldset disabled={isSaving} className="grid min-w-0 gap-6">
            <div className="grid gap-5 @2xl:grid-cols-4 @2xl:gap-x-6">
              <TextField
                control={control}
                name="title"
                label="Group Title"
                required
                placeholder="Group Title"
                autoComplete="off"
                maxLength={ROSTER_TITLE_MAX_LENGTH}
                className="@2xl:col-span-2"
              />
              <SwitchField
                control={control}
                name="isActive"
                label="Status"
                stateLabel={(checked) => (checked ? 'Active' : 'Inactive')}
                className="@2xl:col-span-2"
              />
              <TimePickerField control={control} name="clockIn" label="Clock In" />
              <TimePickerField control={control} name="clockOut" label="Clock Out" />
              <div className="grid content-start gap-3">
                <span className="text-sm leading-none text-label">Defined Minutes</span>
                <ShiftMinutes label="Defined minutes" clockIn={clockIn} clockOut={clockOut} />
              </div>
              <CheckboxField
                control={control}
                name="applyToAll"
                label="Apply For All"
                description={applyToAll ? 'Every working day uses these times.' : undefined}
                className="@2xl:self-end @2xl:pb-2.5"
              />
            </div>
            <RosterScheduleFields />
          </fieldset>
        </form>
      </FormProvider>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your changes?"
        description="This roster group has changes that are not saved. They will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
        onConfirm={onClose}
      />
    </RosterDialogShell>
  )
}

/** Shell with a loading or error body while the group is fetched. */
function LoadingDialog({
  title,
  error,
  onRetry,
  onClose,
}: {
  title: string
  error: Error | null
  onRetry: () => void
  onClose: () => void
}) {
  return (
    <RosterDialogShell title={title} onRequestClose={onClose}>
      {error ? (
        <ErrorState message={error.message} onRetry={onRetry} className="shadow-none" />
      ) : (
        <div aria-busy="true" className="grid gap-4">
          <span className="sr-only">Loading roster group…</span>
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </RosterDialogShell>
  )
}

/**
 * Add Roster Group, Edit Roster Group and View, as modals over the roster
 * list. Closing a form with unsaved changes asks first.
 */
export function RosterGroupDialog({ mode, groupId, onClose, onEdit }: RosterGroupDialogProps) {
  const query = useRosterGroup(mode === 'add' ? undefined : groupId)
  const retry = () => {
    void query.refetch()
  }

  if (mode === 'add') return <RosterGroupForm group={undefined} onClose={onClose} />

  const title = mode === 'edit' ? 'Edit Roster Group' : 'View'
  if (!query.data) {
    return <LoadingDialog title={title} error={query.error} onRetry={retry} onClose={onClose} />
  }

  if (mode === 'edit') {
    return <RosterGroupForm key={query.data.id} group={query.data} onClose={onClose} />
  }

  const group = query.data
  return (
    <RosterDialogShell
      title="View"
      description={group.title}
      onRequestClose={onClose}
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              onEdit(group.id)
            }}
            className={dialogButtonClass}
          >
            <Pencil /> Edit
          </Button>
          <Button variant="destructive" size="lg" onClick={onClose} className={dialogButtonClass}>
            Close
          </Button>
        </>
      }
    >
      <RosterGroupDetails group={group} />
    </RosterDialogShell>
  )
}
