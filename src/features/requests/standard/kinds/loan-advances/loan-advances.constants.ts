import { format, parse, parseISO } from 'date-fns'

import type {
  LoanCategory,
  LoanCategoryInput,
  LoanPaymentMethod,
  LoanSettingsSection,
  LoanType,
  LoanTypeInput,
} from './loan-advances.types'

/** A type's fields for PUT, e.g. to make it inactive from the list. */
export const typeInput = (type: LoanType): LoanTypeInput => ({
  name: type.name,
  isActive: type.isActive,
  guarantorRequired: type.guarantorRequired,
  nonPayable: type.nonPayable,
  minExperienceMonths: type.minExperienceMonths,
  gapBetweenRequestsMonths: type.gapBetweenRequestsMonths,
  installments: type.installments,
  gapBetweenInstallmentsMonths: type.gapBetweenInstallmentsMonths,
  formulaId: type.formulaId,
  deductionPayItemId: type.deductionPayItemId,
  employmentTypeIds: type.employmentTypes.map((item) => item.id),
  description: type.description,
  rowVersion: type.rowVersion,
})

export const categoryInput = (category: LoanCategory): LoanCategoryInput => ({
  name: category.name,
  isActive: category.isActive,
  description: category.description,
  rowVersion: category.rowVersion,
})

/** "Payment Method *" on the Approve popup, as drawn (the API's values). */
export const PAYMENT_METHOD_LABELS: Record<LoanPaymentMethod, string> = {
  bank: 'Bank',
  cash: 'Cash',
  pay_order: 'Pay Order/Demand Draft',
  cheque: 'Cheque',
}

/** "Relationship *" on Guarantor Create ("Friends" is the drawn sample). */
export const RELATIONSHIPS = ['Family', 'Friends', 'Colleague', 'Relative', 'Neighbour'] as const

export const SETTINGS_SECTIONS: readonly { value: LoanSettingsSection; label: string }[] = [
  { value: 'types', label: 'Types' },
  { value: 'categories', label: 'Categories' },
  { value: 'repayment', label: 'Repayment' },
]

/** A real CNIC: 5 digits, 7 digits, 1 digit (the API takes digits and dashes, 5 to 15). */
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

const day = (date: string) => parse(date.slice(0, 10), 'yyyy-MM-dd', new Date())

/** "Thu, 29 Aug 2024", as the lists write dates. */
export const listDay = (date: string | null | undefined) =>
  date ? format(day(date), 'EEE, d MMM yyyy') : '—'
export const listStamp = (iso: string) => format(parseISO(iso), 'EEE, d MMM yyyy')

/** "September 24, 2024", as the popups write dates. */
export const viewDay = (date: string | null | undefined) =>
  date ? format(day(date), 'MMMM d, yyyy') : '—'

/** "December 2026", for an installment's month. */
export const monthOf = (date: string) => format(day(date), 'MMMM yyyy')
