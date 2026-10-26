import type { OrgOption } from '../../../api/lookups.api'
import type { NamedRef } from '../../../types/requests.types'

/*
 * Loan & Advances as the API speaks it: the request type `loan`
 * (`/requests/loan`, `details` = LoanDetails) and the Loans module
 * (`/loans/types`, `/loans/categories`, `/loans/installments`, `/loans/summary`).
 */

/** How the approved money is paid out ("Payment Method *" on the Approve popup). */
export type LoanPaymentMethod = 'bank' | 'cash' | 'pay_order' | 'cheque'

/** A guarantor as the request's details give it (`fileUrl` is a signed link). */
export interface LoanGuarantor {
  id?: string
  name: string
  /** "12345-1234567-1". */
  cnic: string
  /** yyyy-MM-dd. */
  knownSince: string
  relationship: string
  extensionNo?: string | null
  description?: string | null
  /** An uploaded file (POST /files): the guarantor's CNIC copy or similar. */
  fileId?: string | null
  fileName?: string | null
  fileUrl?: string | null
}

/** `details` of a loan request, as the API sends them. */
export interface LoanAdvancePayload {
  loanTypeId: string
  loanTypeName: string | null
  loanCategoryId: string | null
  loanCategoryName: string | null
  amountRequested: number
  /** yyyy-MM-dd. */
  requiredDate: string | null
  extensionNo: string | null
  /** The approver's fields; null until an approver fills them in. */
  approvedAmount: number | null
  currency: string | null
  paymentMethod: LoanPaymentMethod | null
  repaymentDate: string | null
  guarantors: LoanGuarantor[]
}

/** `details` of POST / PUT /requests/loan. */
export interface LoanAdvanceDetailsIn {
  loanTypeId: string
  loanCategoryId: string | null
  amountRequested: number
  requiredDate: string
  extensionNo: string | null
  guarantors: {
    name: string
    cnic: string
    knownSince: string
    relationship: string
    extensionNo: string | null
    description: string | null
    fileId: string | null
  }[]
}

/** The Create form's and filters' own look-ups. */
/**
 * A loan type the form offers (`GET /requests/options/loan-types?employeeId=`, held with
 * `requests.loan.create`): active types with their terms.
 */
export interface LoanTypeOption {
  id: string
  name: string
  guarantorRequired: boolean
  nonPayable: boolean
  minExperienceMonths: number
  gapBetweenRequestsMonths: number | null
  installments: number
  gapBetweenInstallmentsMonths: number | null
  description: string | null
  /** The employee's contract type may apply (null: not known, e.g. no employee). */
  eligible: boolean | null
}

export interface LoanAdvanceLookups {
  /** The signed-in person's types (`GET /requests/options/loan-types`). */
  types: LoanTypeOption[]
  /** Categories (`GET /requests/options/loan-categories`). */
  categories: NamedRef[]
  locations: OrgOption[]
  branches: OrgOption[]
}

// --- Settings ---------------------------------------------------------------------------------------

/** Settings → Types (`LoanTypeOut`). */
export interface LoanType {
  id: string
  name: string
  isActive: boolean
  guarantorRequired: boolean
  nonPayable: boolean
  minExperienceMonths: number
  gapBetweenRequestsMonths: number | null
  installments: number
  gapBetweenInstallmentsMonths: number | null
  formulaId: string | null
  formulaName: string | null
  deductionPayItemId: string | null
  deductionPayItemName: string | null
  description: string | null
  /** Employment Contract Type*: who may apply. */
  employmentTypes: NamedRef[]
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

/** `LoanTypeIn`. */
export interface LoanTypeInput {
  name: string
  isActive: boolean
  guarantorRequired: boolean
  nonPayable: boolean
  minExperienceMonths: number
  gapBetweenRequestsMonths: number | null
  installments: number
  gapBetweenInstallmentsMonths: number | null
  formulaId: string | null
  deductionPayItemId: string | null
  employmentTypeIds: string[]
  description: string | null
  rowVersion?: string
}

/** Settings → Categories (`LoanCategoryOut`). */
export interface LoanCategory {
  id: string
  name: string
  isActive: boolean
  description: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface LoanCategoryInput {
  name: string
  isActive: boolean
  description: string | null
  rowVersion?: string
}

/** Settings → Repayment: one installment of an approved loan (`InstallmentOut`). */
export interface LoanInstallment {
  id: string
  loanId: string
  installmentNo: number
  /** yyyy-MM-dd, the 1st of the month payroll deducts it in. */
  dueMonth: string
  /** Decimals arrive as text ("16666.66"). */
  amount: number | string
  paidAmount: number | string | null
  payslipId: string | null
  paidAt: string | null
  /** due, paid … */
  status: string | null
  employeeId: string | null
  employeeCode: string | null
  employeeName: string | null
  loanTypeName: string | null
}

/** `GET /loans/summary?employeeId=`: the Approve popup's three totals (decimals as text). */
export interface LoanSummary {
  employeeId: string
  totalApproved: number | string
  totalRepaid: number | string
  totalRemaining: number | string
}

/** The Type dialog's pickers. */
export interface LoanSettingsLookups {
  employmentTypes: NamedRef[]
  formulas: NamedRef[]
  deductionPayItems: NamedRef[]
}

export type LoanSettingsSection = 'types' | 'categories' | 'repayment'
