import { COMPANY_NAME } from '../../constants'
import type { PayslipDetail, PayslipItem } from '../../types/payroll.types'
import { amountInWords, formatAmount, formatLong, formatMonth, formatRs } from '../../utils/format'

/** The lines of a pay slip document, shared by the dialog, Print and Download. */
export function payslipLines(slip: PayslipDetail) {
  const shown = (item: PayslipItem) => item.value > 0
  const gross = slip.items.filter((item) => item.payItemId === 'pi_gross_salary')
  const otherEarnings = slip.items.filter(
    (item) =>
      shown(item) &&
      item.payItemId !== 'pi_gross_salary' &&
      (item.type === 'earning' || item.type === 'reimbursement'),
  )
  const deductions = slip.items.filter((item) => item.type === 'deduction' && shown(item))
  const grossTotal = gross.reduce((sum, item) => sum + item.value, 0)
  const earningsTotal = slip.earnings + slip.reimbursements
  const info: [string, string][] = [
    ['Code', slip.employee.code],
    ['Name', slip.employee.name],
    ['DOJ', slip.employee.joiningDate ? formatLong(slip.employee.joiningDate) : '—'],
    ['Job Title', slip.employee.designation],
    ['Department', slip.employee.department],
    ['Branch', slip.employee.branch ?? '—'],
    ['Location', slip.employee.location ?? '—'],
    ['Month', formatMonth(slip.month)],
    ['Salary', `PKR ${formatAmount(slip.salary)}`],
  ]
  return {
    info,
    gross,
    grossTotal,
    otherEarnings,
    earningsTotal,
    deductions,
    deductionsTotal: slip.deductions,
    netPayable: slip.netPayable,
    inWords: `Rs ${amountInWords(slip.netPayable)}`,
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
<html lang="en"><head><meta charset="utf-8"><title>Payslip ${escape(slip.employee.code)} ${escape(formatMonth(slip.month))}</title>
<style>
  body { font: 13px/1.4 Poppins, Arial, sans-serif; color: #303030; margin: 24px; }
  .slip { border: 1px solid #b9bdc4; padding: 16px; max-width: 820px; margin: auto; }
  h1 { text-align: center; font-size: 16px; margin: 0; } h2 { text-align: center; font-size: 13px; font-weight: 400; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1px solid #b9bdc4; }
  th { background: #17263a; color: #fff; text-align: left; padding: 4px 10px; }
  td { padding: 3px 10px; } tr:nth-child(even) td { background: #f3f4f6; }
  .total td { font-weight: 700; } .cols { display: flex; gap: 14px; } .cols > div { flex: 1; }
  .note { font-size: 11px; font-weight: 700; font-style: italic; }
</style></head><body><div class="slip">
<h1>${escape(COMPANY_NAME)}</h1><h2>Payslip</h2>
<table><tr><th colspan="2" style="text-align:center">Employee Info</th></tr>${lines.info.map(([label, value]) => row(label, value)).join('')}</table>
<div class="cols"><div><table><tr><th>Earnings</th><th>Amount</th></tr>
<tr><td colspan="2"><table><tr><th>Gross Salary Division</th><th>Amount</th></tr>${lines.gross.map((item) => row(item.name, formatRs(item.value))).join('')}${row('Gross Salary', formatRs(lines.grossTotal), true)}</table></td></tr>
${lines.otherEarnings.map((item) => row(item.name, formatRs(item.value))).join('')}${row('Earnings', formatRs(lines.earningsTotal), true)}</table></div>
<div><table><tr><th>Deductions</th><th>Amount</th></tr>${lines.deductions.map((item) => row(item.name, formatRs(item.value))).join('')}${row('Deductions', formatRs(lines.deductionsTotal), true)}</table></div></div>
<table><tr><th colspan="2">Net Transfer</th></tr>${row('Net Payable', formatRs(lines.netPayable), true)}${row('In Words', lines.inWords, true)}</table>
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
) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>body{font:12px/1.4 Poppins,Arial,sans-serif;color:#303030;margin:24px}h1{font-size:16px}table{width:100%;border-collapse:collapse}th{background:#17263a0f;text-align:left;padding:6px 8px}td{padding:6px 8px;border-bottom:1px solid #e5e7eb}</style>
</head><body><h1>${escape(title)}</h1><table><thead><tr>${header.map((cell) => `<th>${escape(cell)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></body></html>`
}
