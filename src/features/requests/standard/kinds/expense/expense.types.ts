/*
 * Expense claims (`/requests/expense`): one request carries the claims sent
 * together ("Generate Claim" prepares several, "Submit All" sends them), each
 * with its own receipt. Shapes as the API sends them (backend/app/schemas/requests.py,
 * req.fn_request_details); amounts arrive as numbers in the details and as
 * decimal strings on the settings.
 */

/** One claim of a request (`details.lines[]`). */
export interface ExpenseLine {
  id: string
  lineNo: number
  title: string
  claimDate: string
  expenseCategoryId: string
  expenseCategoryName: string | null
  amount: number
  /** Set by an approver (0 = not reimbursed); all claims get one on final approval. */
  approvedAmount: number | null
  description: string
  /** The receipt: an upload, with a signed link. */
  fileId: string | null
  fileName: string | null
  fileUrl?: string | null
  /** The payroll opening balance the approval added (paid in that month). */
  openingBalanceId: string | null
  paidInMonth: string | null
}

/** An expense request's `details`. */
export interface ExpensePayload {
  currency: string | null
  totalAmount: number
  approvedAmount: number | null
  lines: ExpenseLine[]
}

/** A claim as the form sends it (`ExpenseLineIn`). */
export interface ExpenseLineInput {
  title: string
  /** Today when empty; never in the future. */
  claimDate: string | null
  expenseCategoryId: string
  amount: number
  description: string
  fileId: string | null
}

export interface ExpenseDetailsInput {
  lines: ExpenseLineInput[]
}

/** Request Settings → Expense Categories (`ExpenseCategoryOut`). */
export interface ExpenseCategory {
  id: string
  name: string
  payItemId: string | null
  payItemName: string | null
  /** Decimal string, e.g. "50000.00". */
  maxAmount: string | number | null
  receiptRequired: boolean
  isActive: boolean
  description: string | null
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

export interface ExpenseCategoryInput {
  name: string
  payItemId: string | null
  maxAmount: number | null
  receiptRequired: boolean
  isActive: boolean
  description: string | null
  rowVersion?: string
}

/** Request Settings → Reimbursement: the pay items approved claims are paid under. */
export interface ReimbursementSetting {
  expensePayItemId: string | null
  expensePayItemName: string | null
  airTicketPayItemId: string | null
  airTicketPayItemName: string | null
  updatedAt: string | null
}

export interface ReimbursementSettingInput {
  expensePayItemId: string | null
  airTicketPayItemId: string | null
}

/** A reimbursement pay item (`GET /payroll/pay-items?itemType=reimbursement`). */
export interface PayItemOption {
  id: string
  name: string
}

/** The form's own look-ups: the active categories (`GET /requests/expense/categories`). */
export interface ExpenseLookups {
  categories: ExpenseCategory[]
}

export type ExpenseSettingsSection = 'categories' | 'reimbursement'
