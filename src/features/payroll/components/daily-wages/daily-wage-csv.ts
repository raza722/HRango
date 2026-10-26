import type { DailyWageDetail, TimeSlotOption } from '../../types/payroll.types'
import { downloadText, toCsv } from '../../utils/csv'
import { clock, hours } from '../../utils/format'

/** "TS-0001-Morning (09:00 AM to 05:00 PM)" from the scheduling picker's slot. */
export function timeSlotLabel(slot: TimeSlotOption) {
  const name = slot.code ? `${slot.code}-${slot.name}` : slot.name
  return slot.startTime && slot.endTime
    ? `${name} (${clock(slot.startTime.slice(0, 5))} to ${clock(slot.endTime.slice(0, 5))})`
    : name
}

/** "Download Excel": the run's people as a CSV file (opens in Excel). */
export function downloadDailyWage(detail: DailyWageDetail) {
  const text = toCsv(
    [
      'Employee',
      'Employee Code',
      'Check In',
      'Check Out',
      'Wage',
      'Worked Hours',
      'Expected Hours',
      'Total Earnings',
      'Total Deductions',
      'Net Payable',
      'Voucher',
    ],
    detail.rows.map((row) => [
      row.employeeName,
      row.employeeCode,
      row.checkIn ? clock(row.checkIn) : '',
      row.checkOut ? clock(row.checkOut) : '',
      row.wage ?? '',
      row.workedMinutes === null ? '' : hours(row.workedMinutes),
      hours(row.expectedMinutes),
      row.totalEarnings ?? '',
      row.totalDeductions ?? '',
      row.netPayable ?? '',
      row.voucherNo ?? '',
    ]),
  )
  const day = detail.workDate ?? ''
  const header = `${detail.name} — ${detail.timeSlotName ?? ''} — ${day}\n`
  downloadText(header + text, `daily-wages-${detail.code}-${day}.csv`)
}
