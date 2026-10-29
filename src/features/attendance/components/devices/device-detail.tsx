import { type ReactNode, useId, useState } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { DEVICE_TABS, type DevicesSearch, type DeviceTab } from '../../devices-routing'
import { DEVICE_CODES, useDevice, useOpenedAt } from '../../hooks/use-devices'
import { deviceAddress, formatStamp, plural } from '../../utils/device-format'
import { outlineButtonClass, pageTitleClass } from '../../utils/settings-styles'
import { ActiveChip } from '../settings/settings-list'
import { DeleteDeviceDialog } from './delete-device-dialog'
import { LastSynced } from './device-parts'
import { EnrolmentsTab } from './enrolments-tab'
import { ImportPunchesTab } from './import-punches-tab'

const cardClass = 'grid min-w-0 gap-5 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6'

function Fact({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={cn('grid min-w-0 content-start gap-1', wide && '@3xl:col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-title">{children}</dd>
    </div>
  )
}

/**
 * One device (`?device=<id>`): its facts and last sync, Edit and Delete, then the Enrolments
 * and Import Punches tabs (`?tab=`). The way back to the list is the arrow by the title.
 */
export function DeviceDetail({
  id,
  tab,
  onSearchChange,
}: {
  id: string
  tab: DeviceTab
  onSearchChange: (patch: Partial<DevicesSearch>) => void
}) {
  const titleId = useId()
  const now = useOpenedAt()
  const query = useDevice(id)
  const can = {
    edit: useCan(DEVICE_CODES.edit),
    delete: useCan(DEVICE_CODES.delete),
    enrol: useCan(DEVICE_CODES.enrol),
    import: useCan(DEVICE_CODES.import),
  }
  const [deleting, setDeleting] = useState(false)
  const back = () => {
    onSearchChange({ device: undefined, tab: undefined })
  }
  const backButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Back to the devices"
      onClick={back}
      className="-ml-1.5 shrink-0 text-field-foreground"
    >
      <ArrowLeft className="size-5" />
    </Button>
  )

  if (query.isPending) {
    return (
      <section aria-busy="true" className={cardClass}>
        <span className="sr-only">Loading the device…</span>
        <Skeleton className="h-7 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </section>
    )
  }

  if (query.isError) {
    const missing = query.error.isNotFound
    return (
      <section className={cardClass}>
        <div className="flex items-center gap-2">
          {backButton}
          <h1 className={pageTitleClass}>Biometric Devices</h1>
        </div>
        <ErrorState
          title={missing ? 'Device not found' : 'Could not load the device'}
          message={
            missing ? 'It may have been deleted. Go back to the device list.' : query.error.message
          }
          {...(missing ? {} : { onRetry: () => void query.refetch() })}
          action={
            <Button variant="outline" onClick={back}>
              Back to the devices
            </Button>
          }
          className="shadow-none"
        />
      </section>
    )
  }

  const device = query.data
  const current: DeviceTab = tab === 'import' && can.import ? 'import' : 'enrolments'

  return (
    <>
      <section aria-labelledby={titleId} className={cn(cardClass, '@container')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {backButton}
            <div className="min-w-0">
              <h1 id={titleId} className={cn(pageTitleClass, 'break-words')}>
                {device.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{device.code}</span>
                <ActiveChip active={device.status === 'active'} />
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {can.edit && (
              <Button
                variant="outline"
                onClick={() => {
                  onSearchChange({ edit: device.id })
                }}
                className={outlineButtonClass}
              >
                <Pencil /> Edit
              </Button>
            )}
            {can.delete && (
              <Button
                variant="outline"
                onClick={() => {
                  setDeleting(true)
                }}
                className={cn(outlineButtonClass, 'text-destructive dark:text-destructive')}
              >
                <Trash2 /> Delete
              </Button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 @3xl:grid-cols-4 @3xl:gap-x-6">
          <Fact label="Model">{device.model ?? '—'}</Fact>
          <Fact label="Serial No">{device.serialNo ?? '—'}</Fact>
          <Fact label="IP Address : Port">{deviceAddress(device)}</Fact>
          <Fact label="Branch">{device.branchName ?? '—'}</Fact>
          <Fact label="Last Synced">
            <LastSynced lastSyncedAt={device.lastSyncedAt} now={now} />
          </Fact>
          <Fact label="Enrolled">{plural(device.enrolledCount, 'person', 'people')}</Fact>
          <Fact label="Address" wide>
            {device.address ?? '—'}
          </Fact>
          <Fact label="Added">{formatStamp(device.createdAt)}</Fact>
          <Fact label="Last Changed">{device.updatedAt ? formatStamp(device.updatedAt) : '—'}</Fact>
        </dl>
      </section>

      <section aria-label={`${device.name}: enrolments and punches`} className={cardClass}>
        <Tabs
          value={current}
          // A tab opens on click or Enter, not on focus: focus coming back from the "Discard
          // your changes?" dialog must not try to leave again.
          activationMode="manual"
          onValueChange={(next) => {
            const picked = DEVICE_TABS.find((item) => item === next)
            if (picked) onSearchChange({ tab: picked })
          }}
        >
          <TabsList aria-label="Device sections" className="max-w-full">
            <TabsTrigger value="enrolments">Enrolments ({device.enrolledCount})</TabsTrigger>
            {can.import && <TabsTrigger value="import">Import Punches</TabsTrigger>}
          </TabsList>
          <TabsContent value="enrolments">
            <EnrolmentsTab device={device} canEdit={can.enrol} />
          </TabsContent>
          {can.import && (
            <TabsContent value="import">
              <ImportPunchesTab device={device} />
            </TabsContent>
          )}
        </Tabs>
      </section>

      {deleting && (
        <DeleteDeviceDialog
          device={device}
          onClose={() => {
            setDeleting(false)
          }}
          onDeleted={back}
        />
      )}
    </>
  )
}
