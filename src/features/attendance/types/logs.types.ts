import type { LocalDateTime, PunchLog, PunchSource, PunchType } from './attendance.types'

/** A row of Attendance Logs: one punch as `GET /attendance/logs` returns it. */
export type AttendanceLogRow = PunchLog

/** `GET /attendance/logs` filters (at most 31 days). */
export interface AttendanceLogParams {
  from: string
  to: string
  page: number
  pageSize: number
  employeeId?: string
  punchType?: PunchType
  source?: PunchSource
  q?: string
}

/** Body of `POST /attendance/logs` and `PUT /attendance/logs/{id}` (`PunchIn`). */
export interface AttendanceLogInput {
  employeeId: string
  punchedAt: LocalDateTime
  punchType: PunchType
  breakTypeId: string | null
  remarks: string | null
  rowVersion?: string | null
}

/** One line of an imported file (`POST /attendance/logs/import`). */
export interface FileImportRow {
  /** Line number in the file, for the error list. */
  line: number
  employeeCode: string
  punchedAt: LocalDateTime
  punchType: PunchType
}

export interface FileImportResult {
  created: number
  skipped: number
  failed: number
  errors: { line: number; message: string }[]
}

/**
 * Legacy: HRango cannot read a biometric device yet: a device connector posts its punches
 * (`POST /attendance/settings/devices/{id}/punches`). Kept so the public names stay.
 */
export interface MachineInfo {
  id: string
  label: string
  branch: string | null
  lastSyncedAt: LocalDateTime | null
}

/** Legacy: See {@link MachineInfo}. */
export interface MachineImportResult {
  machines: (MachineInfo & { checkIns: number; checkOuts: number })[]
  imported: number
}
