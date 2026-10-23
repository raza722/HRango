import { format, subMonths } from 'date-fns'

import type { BalanceImportRow } from '../../api/payroll.api'
import { downloadText, parseCsv, toBoolean, toCsv, toNumber } from '../../utils/csv'

/** A number for the API: an unreadable amount becomes 0, which the import reports by line. */
const amountOf = (cell: string | undefined) => {
  const value = toNumber(cell)
  return Number.isFinite(value) ? value : 0
}

export type BalanceKind = 'opening-balance' | 'provident-fund'

export const BALANCE_KINDS = [
  { key: 'opening-balance', label: 'Opening Balance' },
  { key: 'provident-fund', label: 'Provident Fund' },
] as const satisfies readonly { key: BalanceKind; label: string }[]

const sampleMonth = () => format(subMonths(new Date(), 1), 'yyyy-MM')

/** "Sample Import": the columns each import expects, with a sample line. */
export function downloadBalanceTemplate(kind: BalanceKind, sampleCode: string) {
  if (kind === 'opening-balance') {
    downloadText(
      toCsv(
        ['Employee Code', 'Pay Item', 'Month', 'Amount', 'Taxable', 'Description'],
        [
          [
            sampleCode,
            'Travel Self Allowance',
            sampleMonth(),
            5000,
            'No',
            'Detail Data about allowance',
          ],
        ],
      ),
      'opening-balance-sample.csv',
    )
  } else {
    downloadText(
      toCsv(
        ['Employee Code', 'Month', 'Amount', 'Description'],
        [[sampleCode, sampleMonth(), 12500, 'Opening provident fund']],
      ),
      'provident-fund-sample.csv',
    )
  }
}

/** Reads an Opening Balance or Provident Fund file into import rows. */
export function parseBalanceFile(kind: BalanceKind, text: string): BalanceImportRow[] {
  return parseCsv(text, 'employee').map((cells) =>
    kind === 'opening-balance'
      ? {
          employeeCode: cells[0] ?? '',
          payItem: cells[1] ?? '',
          month: cells[2] ?? '',
          amount: amountOf(cells[3]),
          taxable: toBoolean(cells[4]),
          description: cells[5] ?? '',
        }
      : {
          employeeCode: cells[0] ?? '',
          payItem: 'Provident Fund Deduction',
          month: cells[1] ?? '',
          amount: amountOf(cells[2]),
          taxable: false,
          description: cells[3] ?? '',
        },
  )
}

/**
 * Employee Accounts import: Opening Balance files name the account and carry
 * a signed amount (credit +, debit −); Provident Fund files credit the fund.
 */
export function parseAccountFile(kind: BalanceKind, text: string): BalanceImportRow[] {
  return parseCsv(text, 'employee').map((cells) =>
    kind === 'opening-balance'
      ? {
          employeeCode: cells[0] ?? '',
          payItem: cells[1] ?? '',
          month: cells[2] ?? '',
          amount: amountOf(cells[3]),
          taxable: false,
          description: '',
        }
      : {
          employeeCode: cells[0] ?? '',
          payItem: 'Provident Fund',
          month: cells[1] ?? '',
          amount: amountOf(cells[2]),
          taxable: false,
          description: '',
        },
  )
}
