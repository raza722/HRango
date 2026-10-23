import { format, parse, parseISO } from 'date-fns'

import type {
  LoanCategory,
  LoanCategoryInput,
  LoanContractType,
  LoanPaymentMethod,
  LoanSettingsSection,
  LoanType,
  LoanTypeInput,
} from './loan-advances.types'

/** A type's fields for PUT, e.g. to make it inactive from the list. */
export const typeInput = ({ id: _id, createdAt: _createdAt, ...input }: LoanType): LoanTypeInput =>
  input

export const categoryInput = ({
  id: _id,
  createdAt: _createdAt,
  ...input
}: LoanCategory): LoanCategoryInput => input

/** "Payment Method *" on the Approve popup, as drawn. */
export const PAYMENT_METHOD_LABELS: Record<LoanPaymentMethod, string> = {
  bank: 'Bank',
  cash: 'Cash',
  'pay-order': 'Pay Order/Demand Draft',
  cheque: 'Cheque',
}

/** "Employment Contract Type *" on Type Create, as drawn. */
export const CONTRACT_TYPE_LABELS: Record<LoanContractType, string> = {
  'management-trainee': 'Management Trainee',
  'daily-wager': 'Daily Wager',
  permanent: 'Permanent',
  contractual: 'Contractual',
}

/** "Deduction Payitem" on Type Create, as drawn. */
export const DEDUCTION_PAYITEMS = [
  'Medical',
  'Overtime',
  'Salary Per Month',
  'Earned Salary',
  'EOBI',
  'Yearly Tax',
] as const

/** "Formula *" on Type Create: the payroll variables, as drawn. */
export const FORMULA_VARIABLES = [
  'Gross Salary',
  'Job Title',
  'Gender',
  'Previous Earning Fiscal Year',
  'Monthly Taxable Earning',
  'Experience From Confirmation Days',
  'Paid Tax',
  'Short Leave Count',
  'Per Minute Salary',
  'Joining to Payroll End Days',
  'Payroll End Days',
  'Joining to Year End Days',
  'Worked Days',
  'Off Days',
  'Payroll Month',
  'Per Day Salary',
  'Confirmation to Year End Days',
  'Workable Hours',
  'Monthly Proration',
  'Age',
  'Fiscal Year Paid Tax',
  'Salary Forecasting',
  'Paid Leave Count',
  'Unpaid Leave Count',
  'Paid Tax Final Year',
  'Shift Days',
] as const

/** "Relationship *" on Guarantor Create ("Friends" is the drawn sample). */
export const RELATIONSHIPS = ['Family', 'Friends', 'Colleague', 'Relative', 'Neighbour'] as const

export const SETTINGS_SECTIONS: readonly { value: LoanSettingsSection; label: string }[] = [
  { value: 'types', label: 'Types' },
  { value: 'categories', label: 'Categories' },
  { value: 'repayment', label: 'Repayment' },
]

/** A real CNIC: 5 digits, 7 digits, 1 digit. */
export const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** "PKR 123K", as the lists write amounts. */
export const pkrShort = (amount: number | null | undefined) =>
  amount === null || amount === undefined ? '' : `PKR ${compact.format(amount)}`

/** "PKR 123,000": the popups' exact amounts. */
export const pkr = (amount: number) => `PKR ${whole.format(amount)}`

/** "123,000", for an amount box with the "RS" prefix. */
export const amountText = (amount: number) => whole.format(amount)

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())

/** "Thu, 29 Aug 2024", as the lists write dates. */
export const listDay = (date: string) => format(day(date), 'EEE, d MMM yyyy')
export const listStamp = (iso: string) => format(parseISO(iso), 'EEE, d MMM yyyy')

/** "September 24, 2024", as the popups write dates. */
export const viewDay = (date: string) => format(day(date), 'MMMM d, yyyy')
