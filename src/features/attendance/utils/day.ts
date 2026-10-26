import type { AttendanceProfile, PunchLog, TimeSheetDay } from '../types/attendance.types'

/** What a time-sheet day says about its person (the API sends name, code and department). */
export function profileOfDay(day: TimeSheetDay): AttendanceProfile {
  return {
    id: day.employeeId,
    code: day.employeeCode,
    name: day.employeeName,
    department: day.departmentName,
    designation: null,
    status: null,
    location: null,
    branch: null,
    company: null,
    joiningDate: null,
    photoUrl: null,
  }
}

/** What the Description column says: the remarks, else the device or the break type. */
export function punchDescription(log: PunchLog): string {
  if (log.remarks) return log.remarks
  if (log.breakTypeName) return log.breakTypeName
  if (log.deviceName) return log.deviceName
  return '—'
}
