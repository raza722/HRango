import { z } from 'zod'

import { DEVICE_STATUSES } from './types/devices.types'

const optionalText = z.string().trim().min(1).max(80).optional().catch(undefined)

/** The tabs of a device's page. */
export const DEVICE_TABS = ['enrolments', 'import'] as const
export type DeviceTab = (typeof DEVICE_TABS)[number]

/** Devices per page of the list. */
export const DEVICES_PAGE_SIZE = 10

/** Defaults left out of the Biometric Devices URL. */
export const DEVICES_SEARCH_DEFAULTS = { page: 1, tab: 'enrolments' } as const

/**
 * `/settings/biometric-devices?q=…&branchId=…&status=active&page=2` for the list;
 * `?device=<id>&tab=import` opens a device; `?edit=new` or `?edit=<id>` opens the form.
 */
export const devicesSearchSchema = z.object({
  q: optionalText,
  branchId: optionalText,
  status: z.enum(DEVICE_STATUSES).optional().catch(undefined),
  page: z.number().int().min(1).default(1).catch(1),
  device: optionalText,
  tab: z.enum(DEVICE_TABS).default('enrolments').catch('enrolments'),
  edit: optionalText,
})
export type DevicesSearch = z.infer<typeof devicesSearchSchema>
