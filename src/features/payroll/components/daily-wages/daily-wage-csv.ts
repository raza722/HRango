import type { DailyWageDetail } from '../../types/payroll.types'
import { downloadText, toCsv } from '../../utils/csv'
import { clock, hours, slotLabel } from '../../utils/format'

/** "Download Excel": the batch's people as a CSV file (opens in Excel). */
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
    ],
    detail.rows.map((row) => [
      row.employee.name,
      row.employee.code,
      row.checkIn ? clock(row.checkIn) : '',
      row.checkOut ? clock(row.checkOut) : '',
      row.wage,
      row.workedMinutes === null ? '' : hours(row.workedMinutes),
      hours(row.expectedMinutes),
      row.totalEarnings,
      row.totalDeductions,
      row.netPayable,
    ]),
  )
  const header = `${detail.name} — ${slotLabel(detail.timeSlot)} — ${detail.date}\n`
  downloadText(header + text, `daily-wages-${detail.code}-${detail.date}.csv`)
}
