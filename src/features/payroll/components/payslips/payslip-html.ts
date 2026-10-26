import { companyName } from '../../constants'
import type { PayslipDetail, PayslipLine } from '../../types/payroll.types'
import { amountInWords, formatAmount, formatLong, formatMonth, formatRs } from '../../utils/format'

const nameOf = (line: PayslipLine) => line.payItemLabel ?? line.payItemName

/**
 * The lines of a pay slip document, shared by the dialog, Print and Download. Drawn from
 * `GET /payslips/{id}`: the lines (calculate-only and display-only ones are left out of the
 * totals) and the display settings (salary breakdown, attendance summary, tax only when
 * positive, notes).
 */
export function payslipLines(slip: PayslipDetail) {
  const { display } = slip
  const shown = (line: PayslipLine) =>
    !line.calculateOnly &&
    (line.amount !== 0 || line.isDisplayOnly) &&
    !(display.taxPositiveOnly && line.systemCode === 'tax' && line.amount <= 0)
  const gross = slip.lines.filter((line) => line.systemCode === 'salary' && !line.calculateOnly)
  const otherEarnings = slip.lines.filter(
    (line) =>
      shown(line) &&
      line.systemCode !== 'salary' &&
      (line.itemType === 'earning' || line.itemType === 'reimbursement'),
  )
  const deductions = slip.lines.filter((line) => line.itemType === 'deduction' && shown(line))
  const extras = display.showEmployeePayItems
    ? slip.lines.filter(
        (line) => shown(line) && (line.itemType === 'employee_data' || line.itemType === 'other'),
      )
    : []
  const grossTotal = gross.reduce((sum, line) => sum + line.amount, 0)
  const earningsTotal = (slip.totalEarnings ?? 0) + (slip.totalReimbursements ?? 0)
  const netPayable = slip.netPayable ?? 0
  const info: [string, string][] = [
    ['Code', slip.employeeCode],
    ['Name', slip.employeeName],
    ['DOJ', slip.joiningDate ? formatLong(slip.joiningDate) : '—'],
    ['Job Title', slip.jobTitleName ?? slip.designationName ?? '—'],
    ['Department', slip.departmentName ?? '—'],
    ['Branch', slip.branchName ?? '—'],
    ['Location', slip.locationName ?? '—'],
    ['Month', formatMonth(slip.payslipMonth)],
    ['Salary', `${slip.currency ?? 'PKR'} ${formatAmount(slip.gross ?? 0)}`],
  ]
  if (slip.bankName) info.push(['Bank', `${slip.bankName} ${slip.accountNumber ?? ''}`.trim()])
  const attendance: [string, string][] = display.hideAttendanceSummary
    ? []
    : [
        ['Applicable Days', String(slip.applicableDays ?? '—')],
        ['Worked Days', String(slip.workedDays ?? '—')],
        ['Leave Days', String(slip.leaveDays ?? 0)],
        ['Absent Days', String(slip.absentDays ?? 0)],
        ['Overtime (min)', String(slip.overtimeMinutes ?? 0)],
      ]
  const notes = [display.notesEnglish, display.notesOtherLanguage].filter((note): note is string =>
    Boolean(note),
  )
  return {
    info,
    attendance,
    gross: display.showSalaryBreakdown ? gross : [],
    grossTotal,
    otherEarnings,
    earningsTotal,
    deductions,
    deductionsTotal: slip.totalDeductions ?? 0,
    extras,
    netPayable,
    inWords: `Rs ${amountInWords(netPayable)}`,
    notes,
    color: display.color,
    nameOf,
  }
}

export const PAYSLIP_NOTE =
  'This document is system generated and does not require any signatures or the company’s stamp to be considered valid.'

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A stand-alone HTML page of the pay slip, for printing and for Download. */
export function payslipHtml(slip: PayslipDetail): string {
  const lines = payslipLines(slip)
  const row = (label: string, value: string, bold = false) =>
    `<tr${bold ? ' class="total"' : ''}><td>${escape(label)}</td><td>${escape(value)}</td></tr>`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Payslip ${escape(slip.employeeCode)} ${escape(formatMonth(slip.payslipMonth))}</title>
<style>
  body { font: 13px/1.4 Poppins, Arial, sans-serif; color: #303030; margin: 24px; }
  .slip { border: 1px solid #b9bdc4; padding: 16px; max-width: 820px; margin: auto; }
  h1 { text-align: center; font-size: 16px; margin: 0; } h2 { text-align: center; font-size: 13px; font-weight: 400; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #b9bdc4; }
  th { background: ${lines.color ? escape(lines.color) : '#17263a'}; color: #fff; text-align: left; padding: 4px 10px; }
  td { padding: 3px 10px; } tr:nth-child(even) td { background: #f3f4f6; }
  .total td { font-weight: 700; } .cols { display: flex; gap: 14px; } .cols > div { flex: 1; }
  .note { font-size: 11px; font-weight: 700; font-style: italic; }
</style></head><body><div class="slip">
<h1>${escape(companyName())}</h1><h2>Payslip</h2>
<table><tr><th colspan="2" style="text-align:center">Employee Info</th></tr>${lines.info.map(([label, value]) => row(label, value)).join('')}</table>
<div class="cols"><div><table><tr><th>Earnings</th><th>Amount</th></tr>
<tr><td colspan="2"><table><tr><th>Gross Salary Division</th><th>Amount</th></tr>${lines.gross.map((item) => row(nameOf(item), formatRs(item.amount))).join('')}${row('Gross Salary', formatRs(lines.grossTotal), true)}</table></td></tr>
${lines.otherEarnings.map((item) => row(nameOf(item), formatRs(item.amount))).join('')}${row('Earnings', formatRs(lines.earningsTotal), true)}</table></div>
<div><table><tr><th>Deductions</th><th>Amount</th></tr>${lines.deductions.map((item) => row(nameOf(item), formatRs(item.amount))).join('')}${row('Deductions', formatRs(lines.deductionsTotal), true)}</table></div></div>
${lines.attendance.length ? `<table><tr><th colspan="2">Attendance</th></tr>${lines.attendance.map(([label, value]) => row(label, value)).join('')}</table>` : ''}
${lines.extras.length ? `<table><tr><th colspan="2">Other</th></tr>${lines.extras.map((item) => row(nameOf(item), formatRs(item.amount))).join('')}</table>` : ''}
<table><tr><th colspan="2">Net Transfer</th></tr>${row('Net Payable', formatRs(lines.netPayable), true)}${row('In Words', lines.inWords, true)}</table>
${lines.notes.map((note) => `<p>${escape(note)}</p>`).join('')}
<p class="note">${escape(PAYSLIP_NOTE)}</p></div></body></html>`
}

/** Prints an HTML page from a hidden frame (the page around it is not printed). */
export function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.addEventListener('load', () => {
    const view = frame.contentWindow
    if (view) {
      view.focus()
      view.print()
    }
    window.setTimeout(() => {
      frame.remove()
    }, 1000)
  })
  frame.srcdoc = html
  document.body.appendChild(frame)
}

/** A list as a printable table page (Print on the lists). */
export function tableHtml(
  title: string,
  header: readonly string[],
  rows: readonly (readonly string[])[],
  signature = false,
) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>body{font:12px/1.4 Poppins,Arial,sans-serif;color:#303030;margin:24px}h1{font-size:16px}table{width:100%;border-collapse:collapse}th{background:#17263a0f;text-align:left;padding:6px 8px}td{padding:6px 8px;border-bottom:1px solid #e5e7eb}</style>
</head><body><h1>${escape(title)}</h1><table><thead><tr>${header.map((cell) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>${
    signature
      ? '<table style="margin-top:64px"><tr><td>Prepared by ____________</td><td>Checked by ____________</td><td>Approved by ____________</td></tr></table>'
      : ''
  }</body></html>`
}
