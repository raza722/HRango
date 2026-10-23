/** How the approved money is paid out ("Payment Method *" on the Approve popup). */
export type LoanPaymentMethod = 'bank' | 'cash' | 'pay-order' | 'cheque'

/** The contract types a Loan & Advances type is offered on. */
export type LoanContractType = 'management-trainee' | 'daily-wager' | 'permanent' | 'contractual'

/** "Guarantor Create": a person who vouches for the loan. */
export interface LoanGuarantor {
  name: string
  /** "12345-1234567-1". */
  cnic: string
  attachment: string | null
  /** yyyy-MM-dd. */
  knownSince: string
  relationship: string
  extensionNo: string
  description: string
}

/** A Loan & Advances request as the client sees it. */
export interface LoanAdvancePayload {
  typeId: string
  typeName: string
  categoryId: string
  categoryName: string
  requiredAmount: number
  /** yyyy-MM-dd. */
  requiredDate: string
  extensionNo: string
  attachment: string | null
  reason: string
  guarantors: LoanGuarantor[]
  /** The approver's fields; null until an approver fills them in. */
  currency: 'PKR'
  approvedAmount: number | null
  paymentMethod: LoanPaymentMethod | null
  repaymentDate: string | null
  /** The type's terms when it was approved (they feed Settings → Repayment). */
  installments: number | null
  installmentGapMonths: number | null
  nonPayable: boolean
  deductionPayitem: string | null
  /** The employee's approved loans so far: the Approve popup's three totals. */
  totals: { approved: number; repaid: number; remaining: number }
}

export interface LoanAdvanceInput {
  employeeId?: string
  typeId: string
  categoryId: string
  requiredAmount: number
  requiredDate: string
  extensionNo: string
  attachment: string | null
  reason: string
  guarantors: LoanGuarantor[]
}

/** An active type as the Create form needs it. */
export interface LoanTypeOption {
  id: string
  name: string
  guarantorRequired: boolean
  nonPayable: boolean
  experienceMonths: number
  requestGapMonths: number | null
  installments: number
  installmentGapMonths: number
}

export interface LoanAdvanceLookups {
  types: LoanTypeOption[]
  categories: { id: string; name: string }[]
  locations: string[]
  branches: string[]
}

// --- Settings ---------------------------------------------------------------------------------------

/** Settings → Types: "Loan & Advance Type Create". */
export interface LoanType {
  id: string
  name: string
  active: boolean
  guarantorRequired: boolean
  nonPayable: boolean
  experienceMonths: number
  requestGapMonths: number | null
  installments: number
  installmentGapMonths: number
  /** A payroll variable ("Gross Salary"). */
  formula: string
  contractTypes: LoanContractType[]
  deductionPayitem: string | null
  description: string
  createdAt: string
}

export type LoanTypeInput = Omit<LoanType, 'id' | 'createdAt'>

/** Settings → Categories. */
export interface LoanCategory {
  id: string
  name: string
  active: boolean
  description: string
  createdAt: string
}

export type LoanCategoryInput = Omit<LoanCategory, 'id' | 'createdAt'>

/** Settings → Repayment: one installment of an approved loan. */
export interface LoanRepayment {
  /** `<request id>-<installment>`. */
  id: string
  requestId: string
  code: string
  employee: { id: string; name: string; code: string; department: string; photoUrl: string | null }
  typeName: string
  approvedAmount: number
  installment: number
  installments: number
  /** yyyy-MM-dd. */
  date: string
  amount: number
  deductionPayitem: string | null
  /** Deducted (on or before today) or still to come. */
  status: 'repaid' | 'due'
}

export type LoanSettingsSection = 'types' | 'categories' | 'repayment'
