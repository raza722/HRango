/**
 * Settings → Biometric Devices (`/api/attendance/settings/devices`): the machines people punch
 * on, who is enrolled on each (with the user number the machine knows them by), and the punch
 * lines a device connector hands over.
 */

export const DEVICE_STATUSES = ['active', 'inactive'] as const
export type DeviceStatus = (typeof DEVICE_STATUSES)[number]

/** A device as the API lists it (`DeviceOut`). Ids are strings here; they go out as numbers. */
export interface BiometricDevice {
  id: string
  /** `MCH-00001`: the code Attendance Logs shows beside the machine's name. */
  code: string
  name: string
  model: string | null
  serialNo: string | null
  ipAddress: string | null
  port: number | null
  branchId: string | null
  branchName: string | null
  address: string | null
  status: DeviceStatus
  /** When the device last handed over its punches (an instant, marked as UTC), if ever. */
  lastSyncedAt: string | null
  enrolledCount: number
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `GET /attendance/settings/devices` filters. */
export interface DeviceListParams {
  page: number
  pageSize: number
  q?: string | undefined
  branchId?: string | undefined
  status?: DeviceStatus | undefined
}

/** Body of `POST` / `PUT …/devices/{id}` (`DeviceIn`). */
export interface DeviceInput {
  name: string
  model: string | null
  serialNo: string | null
  ipAddress: string | null
  port: number | null
  branchId: string | null
  address: string | null
  status: DeviceStatus
  /** The version last read (edits only). */
  rowVersion?: string | null | undefined
}

/** One person on a device (`EnrolmentOut`). */
export interface DeviceEnrolment {
  employeeId: string
  employeeCode: string
  employeeName: string
  /** The number the device knows the person by (digits, unique on the device). */
  deviceUserNo: string
  createdAt: string
}

/** One person in `PUT …/devices/{id}/enrolments` (`EnrolmentIn`). */
export interface EnrolmentInput {
  employeeId: string
  deviceUserNo: string
}

/** One punch line of `POST …/devices/{id}/punches` (`DevicePunchLine`). */
export interface DevicePunchLine {
  /** Line number in the file, for the error list. */
  line: number
  deviceUserNo: string
  /** `yyyy-MM-ddTHH:mm:ss` when it could be read, otherwise the text as it was. */
  punchedAt: string
  /** `check_in` …, the text as it was when it could not be read, or null (none given). */
  punchType: string | null
}

/** What the import did (`ImportResultOut`): failed lines with their reasons. */
export interface DeviceImportResult {
  created: number
  skipped: number
  failed: number
  errors: { line: number; message: string }[]
}
