import { differenceInCalendarDays, format } from 'date-fns'

import type { BiometricDevice } from '../types/devices.types'

/** A device not heard from for this many days is flagged. */
export const STALE_SYNC_DAYS = 2

/** `1 person`, `3 people`. */
export const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`

/** `29 Oct 2026, 9:30 AM`. */
export const formatStamp = (iso: string) => format(new Date(iso), 'd MMM yyyy, h:mm a')

/** Whole days since the last sync, or null when it never synced. */
export function daysSinceSync(lastSyncedAt: string | null, now: number): number | null {
  return lastSyncedAt ? Math.max(0, differenceInCalendarDays(now, new Date(lastSyncedAt))) : null
}

/** `Machine 1 (MCH-00001)`, the way a device is named in confirms and toasts. */
export const deviceLabel = (device: Pick<BiometricDevice, 'code' | 'name'>) =>
  `${device.name} (${device.code})`

/** `192.168.10.201:4370`, or the part that is known. */
export function deviceAddress(device: Pick<BiometricDevice, 'ipAddress' | 'port'>): string {
  if (!device.ipAddress) return device.port ? `Port ${String(device.port)}` : '—'
  return device.port ? `${device.ipAddress}:${String(device.port)}` : device.ipAddress
}
