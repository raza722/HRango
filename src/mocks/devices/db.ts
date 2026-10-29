import { format, subDays } from 'date-fns'

import { type DeviceStatus, formatLocal } from '@/features/attendance'

import { MACHINE_IDS, machineBranch, machineName, machineSync } from '../attendance/settings-db'
import { createMockCollection } from '../collection'
import { DIRECTORY } from '../employees/seed'

/** A device row (`DeviceOut` without the names and counts worked out per request). */
export interface StoredDevice {
  /** The machine code (`MCH-00001`), so Attendance Logs' device ids open the same record. */
  id: string
  code: string
  name: string
  model: string | null
  serialNo: string | null
  ipAddress: string | null
  port: number | null
  branchId: string | null
  address: string | null
  status: DeviceStatus
  /** UTC, `yyyy-MM-ddTHH:mm:ss` without a zone, as the API writes instants. */
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** One person on one device (`deviceId:employeeId`). */
export interface StoredEnrolment {
  id: string
  deviceId: string
  employeeId: string
  deviceUserNo: string
  createdAt: string
}

/** A wall-clock `yyyy-MM-ddTHH:mm` → the API's UTC instant (`yyyy-MM-ddTHH:mm:ss`, no zone). */
export const utcOf = (local: string) => new Date(`${local}:00`).toISOString().slice(0, 19)

/** Now, as the API writes instants. */
export const utcNow = () => new Date().toISOString().slice(0, 19)

export const enrolmentId = (deviceId: string, employeeId: string) => `${deviceId}:${employeeId}`

/** Each branch's network; its check-in machine is .201 and its check-out machine .202. */
const BRANCH_NETWORK: Record<string, string> = {
  br_lhr_ho: '192.168.10',
  br_lhr_jt: '192.168.20',
  br_isb: '10.20.1',
  br_khi: '10.30.1',
  br_rwp: '192.168.40',
  br_dxb: '10.50.1',
}

const daysAgo = (days: number, time: string) =>
  utcOf(`${format(subDays(new Date(), days), 'yyyy-MM-dd')}T${time}`)

/**
 * The 13 machines Attendance already punches on (`MACHINE_IDS`): two per branch (check in at
 * the main entrance, check out at the staff exit) and the spare, which sits unused and
 * inactive in the IT store room. Names, branches and the last sync come from Attendance's
 * machines; the spare's last sync is 12 days old.
 */
function seedDevices(): StoredDevice[] {
  const now = formatLocal(new Date())
  return MACHINE_IDS.map((code, index) => {
    const number = index + 1
    const branchId = machineBranch(code)
    const spare = branchId === null
    const entry = number % 2 === 1
    const synced = machineSync.find(code)?.lastSyncedAt
    return {
      id: code,
      code,
      name: machineName(code),
      model: spare ? 'ZKTeco MB20' : entry ? 'ZKTeco SpeedFace-V5L' : 'ZKTeco K40 Pro',
      serialNo: `ZK${String(2_404_100 + number * 37)}`,
      ipAddress:
        branchId === null
          ? null
          : `${BRANCH_NETWORK[branchId] ?? '192.168.99'}.${entry ? 201 : 202}`,
      port: spare ? null : 4370,
      branchId,
      address: spare ? 'IT store room, Lahore Head Office' : entry ? 'Main entrance' : 'Staff exit',
      status: spare ? 'inactive' : 'active',
      lastSyncedAt: spare
        ? daysAgo(12, '17:40')
        : synced
          ? utcOf(synced < now ? synced : now)
          : null,
      createdAt: daysAgo(400 - number, '10:00'),
      updatedAt: null,
      rowVersion: `0x${String(number).padStart(16, '0')}`,
    }
  })
}

/**
 * Everyone is enrolled on their branch's two machines, with the same user number on both
 * (1001 for the first person in the directory, 1002 for the next…).
 */
function seedEnrolments(): StoredEnrolment[] {
  return MACHINE_IDS.flatMap((code, index) => {
    const branchId = machineBranch(code)
    return DIRECTORY.flatMap((employee, position) =>
      employee.branchId === branchId
        ? [
            {
              id: enrolmentId(code, employee.id),
              deviceId: code,
              employeeId: employee.id,
              deviceUserNo: String(1001 + position),
              createdAt: daysAgo(398 - index, '11:00'),
            },
          ]
        : [],
    )
  })
}

export const devices = createMockCollection<StoredDevice>({
  storageKey: 'hrms-mock-devices',
  seed: seedDevices,
})

export const deviceEnrolments = createMockCollection<StoredEnrolment>({
  storageKey: 'hrms-mock-device-enrolments',
  seed: seedEnrolments,
})
