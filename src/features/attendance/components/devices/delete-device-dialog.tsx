import { useState } from 'react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { DEVICE_CODES, useDeleteDevice, useSaveDevice } from '../../hooks/use-devices'
import { toDeviceInput, toDeviceValues } from '../../schemas/device.schema'
import type { BiometricDevice } from '../../types/devices.types'
import { deviceLabel, plural } from '../../utils/device-format'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  settingsDialogButtonClass,
} from '../../utils/settings-styles'

/**
 * Delete a device, named. A device people are enrolled on, or whose punches Attendance keeps,
 * is not deleted (the API refuses with 409 `DEVICE_IN_USE`): the dialog says why and offers to
 * set it Inactive, which keeps its history.
 */
export function DeleteDeviceDialog({
  device,
  onClose,
  onDeleted,
}: {
  device: BiometricDevice
  onClose: () => void
  onDeleted?: () => void
}) {
  const remove = useDeleteDevice()
  const save = useSaveDevice()
  const canEdit = useCan(DEVICE_CODES.edit)
  // The enrolled count is known here; punches only the API knows.
  const [refusal, setRefusal] = useState<string | null>(() =>
    device.enrolledCount > 0
      ? `${deviceLabel(device)} has ${plural(device.enrolledCount, 'person', 'people')} enrolled, so it cannot be deleted. Set it to Inactive instead: its enrolments and punches stay readable.`
      : null,
  )
  const [error, setError] = useState<string | null>(null)
  const busy = remove.isPending || save.isPending

  const confirm = async () => {
    setError(null)
    try {
      await remove.mutateAsync(device)
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'DEVICE_IN_USE')
        setRefusal(failure.message)
      else setError(failure instanceof ApiError ? failure.message : 'Could not delete the device.')
      return
    }
    onDeleted?.()
    onClose()
  }

  const setInactive = async () => {
    setError(null)
    try {
      await save.mutateAsync({
        id: device.id,
        input: { ...toDeviceInput(toDeviceValues(device), device.rowVersion), status: 'inactive' },
        message: `${deviceLabel(device)} set to Inactive`,
      })
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not change the device.')
      return
    }
    onClose()
  }

  return (
    <AppDialog
      title={refusal ? `${device.name} cannot be deleted` : `Delete ${device.name}?`}
      onRequestClose={onClose}
      className="max-w-lg"
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={busy}
            className={settingsDialogButtonClass}
          >
            Cancel
          </Button>
          {!refusal && (
            <Button
              variant="destructive"
              size="lg"
              onClick={() => void confirm()}
              disabled={busy}
              className={settingsDialogButtonClass}
            >
              {remove.isPending ? 'Deleting…' : `Delete ${device.name}`}
            </Button>
          )}
          {refusal && canEdit && device.status === 'active' && (
            <Button
              size="lg"
              onClick={() => void setInactive()}
              disabled={busy}
              className={cn(settingsDialogButtonClass, navyButtonClass)}
            >
              {save.isPending ? 'Saving…' : 'Set Inactive'}
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-3 text-sm text-title">
        {refusal ? (
          <p role="status">{refusal}</p>
        ) : (
          <p>{deviceLabel(device)} will be removed from the device list. This cannot be undone.</p>
        )}
        {refusal && device.status === 'inactive' && (
          <p className="text-muted-foreground">It is already Inactive.</p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}
