import { getRouteApi } from '@tanstack/react-router'
import { Lock } from 'lucide-react'

import { PageContainer } from '@/components/layout'
import { useCan } from '@/lib/permissions'

import type { DevicesSearch } from '../../devices-routing'
import { DEVICE_CODES } from '../../hooks/use-devices'
import { pageTitleClass } from '../../utils/settings-styles'
import { DeviceDetail } from './device-detail'
import { DeviceFormDialog } from './device-form-dialog'
import { DevicesList } from './devices-list'

const routeApi = getRouteApi('/_app/settings/biometric-devices')

/**
 * Settings → Biometric Devices: the device list, or one device (`?device=`) with its
 * enrolments and punch import; Add / Edit opens over either (`?edit=new|<id>`). Filters, page,
 * the open device, its tab and the form live in the URL.
 */
export function BiometricDevicesPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const can = {
    view: useCan(DEVICE_CODES.view),
    create: useCan(DEVICE_CODES.create),
    edit: useCan(DEVICE_CODES.edit),
  }
  const update = (patch: Partial<DevicesSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  if (!can.view) {
    return (
      <PageContainer>
        <section className="grid justify-items-center gap-3 rounded-xl bg-card px-6 py-12 text-center shadow-xs">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock aria-hidden="true" className="size-6" />
          </span>
          <h1 className={pageTitleClass}>Biometric Devices</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            You do not have permission to see the biometric devices. Ask an administrator for
            “attendance.settings.devices.view”.
          </p>
        </section>
      </PageContainer>
    )
  }

  const editing = search.edit === 'new' ? can.create : Boolean(search.edit) && can.edit
  const closeForm = () => {
    update({ edit: undefined })
  }

  return (
    <PageContainer>
      {search.device ? (
        <DeviceDetail id={search.device} tab={search.tab} onSearchChange={update} />
      ) : (
        <DevicesList search={search} onSearchChange={update} />
      )}
      {editing && search.edit && (
        <DeviceFormDialog
          key={search.edit}
          id={search.edit === 'new' ? null : search.edit}
          onClose={closeForm}
          onSaved={(device, created) => {
            // A new device opens, ready for its enrolments.
            update(
              created
                ? { edit: undefined, device: device.id, tab: undefined }
                : { edit: undefined },
            )
          }}
        />
      )}
    </PageContainer>
  )
}
