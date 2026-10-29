import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import {
  BiometricDevicesPage,
  deviceQueryOptions,
  DEVICES_PAGE_SIZE,
  DEVICES_SEARCH_DEFAULTS,
  devicesListQueryOptions,
  devicesSearchSchema,
} from '@/features/attendance'
import { pageTitle } from '@/lib/constants'

export const Route = createFileRoute('/_app/settings/biometric-devices')({
  validateSearch: devicesSearchSchema,
  search: { middlewares: [stripSearchParams(DEVICES_SEARCH_DEFAULTS)] },
  loaderDeps: ({ search: { q, branchId, status, page, device } }) => ({
    q,
    branchId,
    status,
    page,
    device,
  }),
  // Prefetch the list or the open device without blocking navigation.
  loader: ({ context: { queryClient }, deps: { device, ...filters } }) => {
    const prefetch = device
      ? queryClient.query(deviceQueryOptions(device))
      : queryClient.query(devicesListQueryOptions({ ...filters, pageSize: DEVICES_PAGE_SIZE }))
    prefetch.catch(() => undefined)
  },
  head: () => ({ meta: [{ title: pageTitle('Biometric Devices') }] }),
  component: BiometricDevicesPage,
})
