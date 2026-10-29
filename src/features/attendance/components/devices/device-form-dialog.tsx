import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { AppDialog } from '@/components/feedback/app-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { FieldLayoutContext, SelectField, TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useBranchOptions, useDevice, useSaveDevice } from '../../hooks/use-devices'
import {
  DEFAULT_DEVICE_PORT,
  DEVICE_FIELD_OF,
  deviceFormSchema,
  type DeviceFormValues,
  emptyDeviceValues,
  toDeviceInput,
  toDeviceValues,
} from '../../schemas/device.schema'
import type { BiometricDevice } from '../../types/devices.types'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
} from '../../utils/settings-styles'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

/**
 * Add a device (`id` null) or edit one: Name, Model, Serial No (unique), IP Address (IPv4) and
 * Port, Branch, Address, Status. The form checks what it can before sending; the API's 422
 * field errors (a serial no another device has) land on their fields, all at once.
 */
export function DeviceFormDialog({
  id,
  onClose,
  onSaved,
}: {
  id: string | null
  onClose: () => void
  onSaved: (device: BiometricDevice, created: boolean) => void
}) {
  const record = useDevice(id)
  const branches = useBranchOptions()
  const save = useSaveDevice()
  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: emptyDeviceValues(),
    ...(record.data ? { values: toDeviceValues(record.data) } : {}),
  })
  const loading = id !== null && record.isPending
  const loadError = id !== null && record.isError ? record.error : null
  const rootError = form.formState.errors.root?.message

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: id ?? undefined,
        input: toDeviceInput(values, record.data?.rowVersion),
      })
      onSaved(saved, id === null)
    } catch (error) {
      if (!(error instanceof ApiError)) {
        form.setError('root', { message: 'Could not save the device. Try again.' })
        return
      }
      const placed = Object.entries(error.fieldErrors).filter(([field]) => DEVICE_FIELD_OF[field])
      placed.forEach(([field, message], index) => {
        const name = DEVICE_FIELD_OF[field]
        if (name) form.setError(name, { message }, { shouldFocus: index === 0 })
      })
      if (placed.length === 0) form.setError('root', { message: error.message })
    }
  })

  const title = id === null ? 'Add Biometric Device' : `Edit ${record.data?.name ?? 'Device'}`

  return (
    <AppDialog
      title={title}
      description={
        record.data ? `Code ${record.data.code}, as Attendance Logs shows it.` : undefined
      }
      onRequestClose={onClose}
      className={cn('max-w-2xl', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          {rootError && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {rootError}
              {save.error?.status === 409 && (
                <Button
                  variant="link"
                  className="h-auto px-1.5 py-0 text-sm"
                  onClick={() => {
                    form.clearErrors('root')
                    void record.refetch()
                  }}
                >
                  Reload
                </Button>
              )}
            </p>
          )}
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={settingsDialogButtonClass}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="device-form"
            size="lg"
            disabled={save.isPending || loading || loadError !== null}
            className={cn(settingsDialogButtonClass, navyButtonClass)}
          >
            {save.isPending ? 'Saving…' : id === null ? 'Add Device' : 'Save Changes'}
          </Button>
        </>
      }
    >
      {loadError ? (
        <ErrorState
          title="Could not load the device"
          message={loadError.message}
          onRetry={() => void record.refetch()}
          className="shadow-none"
        />
      ) : loading ? (
        <div aria-busy="true" className="grid gap-4 @lg:grid-cols-2">
          <span className="sr-only">Loading the device…</span>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <FieldLayoutContext value="vertical">
          <form id="device-form" noValidate onSubmit={(event) => void submit(event)}>
            <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 @lg:grid-cols-2">
              <legend className="sr-only">{title}</legend>
              <TextField
                control={form.control}
                name="name"
                label="Name"
                placeholder="Main entrance machine"
                autoComplete="off"
                required
              />
              <TextField
                control={form.control}
                name="model"
                label="Model"
                placeholder="ZKTeco SpeedFace-V5L"
                autoComplete="off"
              />
              <TextField
                control={form.control}
                name="serialNo"
                label="Serial No"
                description="Each device has its own."
                autoComplete="off"
              />
              <SelectField
                control={form.control}
                name="branchId"
                label="Branch"
                placeholder={branches.isPending ? 'Loading…' : 'Select'}
                options={branches.options}
                clearable="No branch"
              />
              <TextField
                control={form.control}
                name="ipAddress"
                label="IP Address"
                placeholder="192.168.1.201"
                inputMode="decimal"
                autoComplete="off"
              />
              <TextField
                control={form.control}
                name="port"
                label="Port"
                placeholder={DEFAULT_DEVICE_PORT}
                inputMode="numeric"
                autoComplete="off"
              />
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={STATUS_OPTIONS}
                description="Inactive devices keep their enrolments and punches."
                required
              />
              <TextareaField
                control={form.control}
                name="address"
                label="Address"
                placeholder="Where the device is mounted"
                rows={2}
                className="@lg:col-span-2"
              />
            </fieldset>
          </form>
        </FieldLayoutContext>
      )}
    </AppDialog>
  )
}
