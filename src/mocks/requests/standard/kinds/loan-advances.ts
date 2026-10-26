import { addDays, addMonths, differenceInMonths, format, parse, startOfMonth } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  LoanInstallment,
  LoanSummary,
} from '@/features/requests/standard/kinds/loan-advances/loan-advances.types'
import type { ApiItem, Paginated } from '@/types/api'

import { toProfile } from '../../../attendance/seed'
import type { MockCollection } from '../../../collection'
import { findEmployee } from '../../../employees/seed'
import { mockFileUrl } from '../../../files/handlers'
import { profileOf } from '../../../scheduling/seed'
import { apiPath, latency, paginate, readPageParams, requireAuth } from '../../../utils'
import type { RequestBodyIn } from '../../backend'
import { invalid, today } from '../../http'
import { ME, mustFind } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindModule,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import {
  loanCategories,
  type LoanEmploymentTypeId,
  loanSettingsHandlers,
  loanTypes,
  resetLoanSettings,
  type StoredLoanType,
} from './loan-advances-settings'

/*
 * Loan & Advances (`/requests/loan`, details = LoanDetails): the person asks
 * for an amount of a type (Settings → Types) and a category, by a date, with
 * guarantors when the type needs them. The type's terms are checked: months
 * of service, the contract types it is offered on, one waiting request per
 * type and the gap since the last request of that type. Approvers may fill in
 * the approved amount (never more than asked), the payment method and the
 * repayment date (`details` of the approval); the final approval needs the
 * amount and the date. The approved loan is repaid in the type's installments
 * (`/loans/installments`), one every Gap Between Installments months from the
 * repayment date; a Non Payable type is not repaid.
 */

const ymd = /^\d{4}-\d{2}-\d{2}$/
const id = z.union([z.string(), z.number()]).transform(String)

const guarantorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  cnic: z
    .string()
    .trim()
    .min(5)
    .max(15)
    .regex(/^[0-9-]+$/),
  knownSince: z.string().regex(ymd),
  relationship: z.string().trim().min(1).max(200),
  extensionNo: z.string().max(20).nullish(),
  description: z.string().nullish(),
  fileId: id.nullish(),
})

/** `details` of RequestIn, with the header's reason and description. */
const schema = z.object({
  loanTypeId: id,
  loanCategoryId: id.nullish(),
  amountRequested: z.number().positive(),
  requiredDate: z.string().regex(ymd).nullish(),
  extensionNo: z.string().max(20).nullish(),
  guarantors: z.array(guarantorSchema).max(10).default([]),
  reason: z.string(),
  description: z.string().nullish(),
})
type Input = z.infer<typeof schema>

export const PAYMENT_METHODS = ['bank', 'cash', 'pay_order', 'cheque'] as const
type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface StoredGuarantor {
  name: string
  cnic: string
  knownSince: string
  relationship: string
  extensionNo: string | null
  description: string | null
  fileId: string | null
}

/** The stored request: LoanDetails, the header's text, and the type's terms once approved. */
export interface LoanStored {
  loanTypeId: string
  loanCategoryId: string | null
  amountRequested: number
  requiredDate: string
  extensionNo: string | null
  reason: string
  description: string | null
  guarantors: StoredGuarantor[]
  currency: string | null
  approvedAmount: number | null
  paymentMethod: PaymentMethod | null
  repaymentDate: string | null
  installments: number | null
  gapBetweenInstallmentsMonths: number | null
  nonPayable: boolean
  deductionPayItemId: string | null
}

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')

const stored = (record: StoredStandardRequest) => record.payload as unknown as LoanStored

/** The standard requests table, kept when the handlers are made (for totals and Repayment). */
let table: MockCollection<StoredStandardRequest> | null = null
const loans = () => (table?.all() ?? []).filter((record) => record.kind === 'loan-advances')

/** The person's contract, as the types name them (probation is a permanent contract). */
function contractOf(employeeId: string): LoanEmploymentTypeId {
  const employee = findEmployee(employeeId)
  const type = employee ? profileOf(employee).employmentType : 'permanent'
  if (type === 'contract') return 'et_contractual'
  if (type === 'intern') return 'et_trainee'
  return 'et_permanent'
}

const monthsOfService = (employeeId: string) =>
  differenceInMonths(new Date(), day(toProfile(mustFind(employeeId)).joiningDate))

const APPROVED = new Set<StoredStandardRequest['status']>(['completed', 'cancelling'])

interface Installment {
  number: number
  date: string
  amount: number
}

/** An approved, payable loan's installments; nothing for others. */
function scheduleOf(record: StoredStandardRequest): Installment[] {
  const payload = stored(record)
  const { approvedAmount, repaymentDate, installments } = payload
  if (!APPROVED.has(record.status) || payload.nonPayable) return []
  if (!approvedAmount || !repaymentDate || !installments) return []
  const gap = payload.gapBetweenInstallmentsMonths ?? 1
  const each = Math.floor((approvedAmount / installments) * 100) / 100
  const start = startOfMonth(day(repaymentDate))
  return Array.from({ length: installments }, (_, index) => ({
    number: index + 1,
    date: iso(addMonths(start, index * (gap || 1))),
    // The last installment takes the rounding, so they add up to the approved amount.
    amount:
      index === installments - 1
        ? Math.round((approvedAmount - each * (installments - 1)) * 100) / 100
        : each,
  }))
}

/** The person's approved loans: approved, repaid (deducted by today) and still to repay. */
function totalsOf(employeeId: string) {
  const totals = { approved: 0, repaid: 0, remaining: 0 }
  const now = today()
  for (const record of loans()) {
    if (record.employeeId !== employeeId || !APPROVED.has(record.status)) continue
    totals.approved += stored(record).approvedAmount ?? 0
    for (const installment of scheduleOf(record)) {
      if (installment.date <= now) totals.repaid += installment.amount
      else totals.remaining += installment.amount
    }
  }
  return totals
}

function checkGuarantors(guarantors: readonly Input['guarantors'][number][]): string | null {
  for (const [index, guarantor] of guarantors.entries()) {
    const which = guarantors.length > 1 ? `Guarantor ${String(index + 1)}` : 'The guarantor'
    if (guarantor.knownSince > today()) return `${which}: choose when you met, today or earlier.`
  }
  return null
}

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  const employee = mustFind(context.employeeId)
  const type = loanTypes.find(input.loanTypeId)
  if (!type?.isActive) {
    return invalid('Choose an active loan type.', { loanTypeId: 'Choose an active loan type' })
  }
  const category = input.loanCategoryId ? loanCategories.find(input.loanCategoryId) : undefined
  if (input.loanCategoryId && !category?.isActive) {
    return invalid('Choose an active loan category.', {
      loanCategoryId: 'Choose an active loan category',
    })
  }
  const requiredDate = input.requiredDate ?? today()
  if (requiredDate < today()) {
    return invalid('Choose today or a later day.', { requiredDate: 'Choose today or a later day' })
  }
  if (!input.reason.trim()) return invalid('Reason is required.', { reason: 'Reason is required.' })

  // The type's terms: months of service, contract type, one waiting request, gap between requests.
  const months = monthsOfService(employee.id)
  if (months < type.minExperienceMonths) {
    return invalid(
      `${type.name} needs ${String(type.minExperienceMonths)} months of service; ${employee.name} has ${String(months)}.`,
      { loanTypeId: `Needs ${String(type.minExperienceMonths)} months of service` },
    )
  }
  if (!type.employmentTypeIds.includes(contractOf(employee.id))) {
    return invalid(`${type.name} is not offered on this employee's contract type.`, {
      loanTypeId: 'Not offered on this contract type',
    })
  }
  const sameType = context.records
    .filter(
      (record) =>
        record.id !== context.ignoreId &&
        record.employeeId === employee.id &&
        stored(record).loanTypeId === type.id &&
        record.status !== 'rejected' &&
        record.status !== 'cancelled',
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const waiting = sameType.find((record) => record.status === 'pending')
  if (waiting) {
    return invalid(`${waiting.code} asks for a ${type.name} and is still waiting.`, {
      loanTypeId: `${waiting.code} is still waiting`,
    })
  }
  const last = sameType[0]
  if (last && type.gapBetweenRequestsMonths) {
    const next = addMonths(new Date(last.createdAt), type.gapBetweenRequestsMonths)
    if (next > new Date()) {
      return invalid(
        `${type.name} allows one request every ${String(type.gapBetweenRequestsMonths)} months.`,
        { loanTypeId: `Next ${type.name} from ${format(next, 'd MMM yyyy')}` },
      )
    }
  }
  if (type.guarantorRequired && input.guarantors.length === 0) {
    return invalid(`${type.name} needs a guarantor.`, { guarantors: 'Add a guarantor' })
  }
  const guarantorError = checkGuarantors(input.guarantors)
  if (guarantorError) return invalid(guarantorError, { guarantors: guarantorError })

  return {
    loanTypeId: type.id,
    loanCategoryId: category?.id ?? null,
    amountRequested: input.amountRequested,
    requiredDate,
    extensionNo: input.extensionNo?.trim() ?? null,
    reason: input.reason.trim(),
    description: input.description?.trim() ?? null,
    guarantors: input.guarantors.map((guarantor) => ({
      name: guarantor.name,
      cnic: guarantor.cnic,
      knownSince: guarantor.knownSince,
      relationship: guarantor.relationship,
      extensionNo: guarantor.extensionNo?.trim() ?? null,
      description: guarantor.description?.trim() ?? null,
      fileId: guarantor.fileId ?? null,
    })),
    currency: null,
    approvedAmount: null,
    paymentMethod: null,
    repaymentDate: null,
    installments: null,
    gapBetweenInstallmentsMonths: null,
    nonPayable: type.nonPayable,
    deductionPayItemId: type.deductionPayItemId,
  } satisfies LoanStored
}

/** The type's terms, kept on the request when it is approved (the loan the backend makes). */
const termsOf = (type: StoredLoanType | undefined) => ({
  installments: type?.installments ?? 1,
  gapBetweenInstallmentsMonths: type?.gapBetweenInstallmentsMonths ?? 1,
  nonPayable: type?.nonPayable ?? false,
  deductionPayItemId: type?.deductionPayItemId ?? null,
})

/** `details` of the approval (ApprovalDetailsIn): what an approver of a loan enters. */
const decisionSchema = z.object({
  approvedAmount: z.number().positive().nullish(),
  paymentMethod: z.string().nullish(),
  repaymentDate: z.string().nullish(),
  currency: z.string().length(3).nullish(),
})

/**
 * As `req.usp_request_decide` and `loan.usp_request_apply_loan`: each value is
 * kept when given (amount above 0 and at most the amount asked, a known
 * payment method); the final approval needs the amount and the repayment date.
 */
function applyLoanDecision(
  record: StoredStandardRequest,
  extras: Record<string, unknown>,
): Response | Record<string, unknown> {
  const payload = stored(record)
  const parsed = decisionSchema.safeParse(extras)
  if (!parsed.success) return invalid('The approval details are not valid.')
  const { approvedAmount, paymentMethod, repaymentDate, currency } = parsed.data
  if (approvedAmount !== null && approvedAmount !== undefined) {
    if (approvedAmount > payload.amountRequested) {
      const message =
        'The approved amount must be more than zero and no more than the amount asked.'
      return invalid(message, { approvedAmount: message })
    }
  }
  const method = paymentMethod ? PAYMENT_METHODS.find((value) => value === paymentMethod) : null
  if (paymentMethod && !method) {
    return invalid('Payment method is not valid.', {
      paymentMethod: 'Payment method is not valid.',
    })
  }
  if (repaymentDate && !ymd.test(repaymentDate)) {
    return invalid('Choose the repayment date.', { repaymentDate: 'Choose the repayment date.' })
  }
  const next: LoanStored = {
    ...payload,
    approvedAmount: approvedAmount ?? payload.approvedAmount,
    paymentMethod: method ?? payload.paymentMethod,
    repaymentDate: repaymentDate ?? payload.repaymentDate,
    currency: currency ?? payload.currency ?? 'PKR',
  }
  // Bulk approve (no form): the amount asked, cash, and the first of the next month.
  if (extras.prefill === true) {
    const now = new Date().toISOString().slice(0, 10)
    const from = payload.requiredDate > now ? payload.requiredDate : now
    const [year = 0, month = 1] = from.split('-').map(Number)
    next.approvedAmount ??= payload.amountRequested
    next.paymentMethod ??= 'cash'
    next.repaymentDate ??= `${String(month === 12 ? year + 1 : year)}-${String((month % 12) + 1).padStart(2, '0')}-01`
  }
  const index = record.flow.findIndex((step) => step.status === 'pending')
  const final = index === record.flow.length - 1
  if (final) {
    if (!next.approvedAmount || !next.repaymentDate) {
      const message = 'Approved amount and repayment date are required to approve a loan.'
      return invalid(message, { approvedAmount: message })
    }
    const done: LoanStored = { ...next, ...termsOf(loanTypes.find(payload.loanTypeId)) }
    return { ...done }
  }
  return { ...next }
}

// --- the Loans module's read endpoints ------------------------------------------------------------

/** `GET /loans/installments?monthFrom&monthTo&status&employeeId`: every installment of the approved loans. */
/**
 * The Create form's options (`requests.loan.create`): `GET /requests/options/loan-types
 * ?employeeId=` (active types with their terms; `eligible` = the person's contract type may
 * apply) and `GET /requests/options/loan-categories` (active categories).
 */
const loanOptionHandlers = [
  http.get(apiPath('/requests/options/loan-types'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const employeeId = new URL(request.url).searchParams.get('employeeId') ?? ME
    const known = Boolean(findEmployee(employeeId))
    const rows = loanTypes
      .all()
      .filter((type) => type.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((type) => ({
        id: type.id,
        name: type.name,
        guarantorRequired: type.guarantorRequired,
        nonPayable: type.nonPayable,
        minExperienceMonths: type.minExperienceMonths,
        gapBetweenRequestsMonths: type.gapBetweenRequestsMonths,
        installments: type.installments,
        gapBetweenInstallmentsMonths: type.gapBetweenInstallmentsMonths,
        description: type.description,
        eligible: known ? type.employmentTypeIds.includes(contractOf(employeeId)) : null,
      }))
    return HttpResponse.json({ data: rows })
  }),
  http.get(apiPath('/requests/options/loan-categories'), async ({ request }) => {
    await latency()
    const denied = requireAuth(request)
    if (denied) return denied
    const rows = loanCategories
      .all()
      .filter((category) => category.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
      }))
    return HttpResponse.json({ data: rows })
  }),
]

const installmentsHandler = http.get(apiPath('/loans/installments'), async ({ request }) => {
  await latency()
  const unauthorized = requireAuth(request)
  if (unauthorized) return unauthorized
  const url = new URL(request.url)
  const get = (name: string) => url.searchParams.get(name) ?? ''
  const now = today()
  const rows: LoanInstallment[] = loans().flatMap((record) => {
    const payload = stored(record)
    const employee = findEmployee(record.employeeId)
    const profile = employee ? toProfile(employee) : null
    return scheduleOf(record).map((installment) => {
      const paid = installment.date <= now
      return {
        id: `${record.id}-${String(installment.number)}`,
        loanId: record.id,
        installmentNo: installment.number,
        dueMonth: installment.date,
        amount: installment.amount.toFixed(2),
        paidAmount: (paid ? installment.amount : 0).toFixed(2),
        payslipId: null,
        paidAt: paid ? `${installment.date}T00:00:00` : null,
        status: paid ? 'paid' : 'due',
        employeeId: record.employeeId,
        employeeCode: profile?.code ?? null,
        employeeName: employee?.name ?? null,
        loanTypeName: loanTypes.find(payload.loanTypeId)?.name ?? null,
      }
    })
  })
  const filtered = rows
    .filter((row) => !get('employeeId') || row.employeeId === get('employeeId'))
    .filter((row) => !get('status') || row.status === get('status'))
    .filter((row) => !get('monthFrom') || row.dueMonth >= get('monthFrom'))
    .filter((row) => !get('monthTo') || row.dueMonth <= get('monthTo'))
    .sort((a, b) => a.dueMonth.localeCompare(b.dueMonth) || a.loanId.localeCompare(b.loanId))
  const { page, pageSize } = readPageParams(url)
  return HttpResponse.json<Paginated<LoanInstallment>>(paginate(filtered, page, pageSize))
})

/** `GET /loans/summary?employeeId`: the Approve popup's three totals. */
const summaryHandler = http.get(apiPath('/loans/summary'), async ({ request }) => {
  await latency()
  const unauthorized = requireAuth(request)
  if (unauthorized) return unauthorized
  const employeeId = new URL(request.url).searchParams.get('employeeId') ?? ''
  if (!findEmployee(employeeId)) return invalid('Employee not found')
  const totals = totalsOf(employeeId)
  return HttpResponse.json<ApiItem<LoanSummary>>({
    data: {
      employeeId,
      totalApproved: totals.approved.toFixed(2),
      totalRepaid: totals.repaid.toFixed(2),
      totalRemaining: totals.remaining.toFixed(2),
    },
  })
})

const usedBy = (field: 'loanTypeId' | 'loanCategoryId', value: string) =>
  loans().find((record) => stored(record)[field] === value)?.code ?? null

const def: StandardKindServer<Input> = {
  kind: 'loan-advances',
  typeCode: 'loan',
  typeName: 'Loan & Advances',
  settingsType: 'loan',
  codePrefix: 'RQ-LA-',
  codeDigits: 4,
  fromBody: (body: RequestBodyIn) => ({
    ...body.details,
    reason: body.reason ?? '',
    description: body.description ?? null,
  }),
  schema,
  toPayload,
  // Request Restriction reads the day the money is needed.
  dateOf: (payload) => String(payload.requiredDate),
  header: (payload) => {
    const value = payload as unknown as LoanStored
    return {
      fromDate: value.requiredDate,
      toDate: value.requiredDate,
      days: null,
      reason: value.reason,
      description: value.description,
      application: null,
    }
  },
  toDetails: (payload) => {
    const value = payload as unknown as LoanStored
    return {
      loanTypeId: value.loanTypeId,
      loanTypeName: loanTypes.find(value.loanTypeId)?.name ?? null,
      loanCategoryId: value.loanCategoryId,
      loanCategoryName: value.loanCategoryId
        ? (loanCategories.find(value.loanCategoryId)?.name ?? null)
        : null,
      amountRequested: value.amountRequested,
      requiredDate: value.requiredDate,
      extensionNo: value.extensionNo,
      approvedAmount: value.approvedAmount,
      currency: value.currency,
      paymentMethod: value.paymentMethod,
      repaymentDate: value.repaymentDate,
      guarantors: value.guarantors.map((guarantor, index) => ({
        id: `g${String(index + 1)}`,
        ...guarantor,
        fileName: guarantor.fileId ? 'Guarantor file' : null,
        ...(guarantor.fileId ? { fileUrl: mockFileUrl(guarantor.fileId) } : {}),
      })),
    }
  },
  decision: {
    schema: z.record(z.string(), z.unknown()),
    apply: applyLoanDecision,
  },
  extraHandlers: [
    ...loanOptionHandlers,
    installmentsHandler,
    summaryHandler,
    ...loanSettingsHandlers(usedBy),
  ],
  seed: () => {
    // The settings start again with the requests (tests reset the requests table).
    resetLoanSettings()
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const inDays = (offset: number) => iso(addDays(new Date(), offset))
    const firstOfMonth = (offsetMonths: number) =>
      iso(startOfMonth(addMonths(new Date(), offsetMonths)))
    const guarantor = (
      name: string,
      cnic: string,
      relationship: string,
      years: number,
    ): StoredGuarantor => ({
      name,
      cnic,
      knownSince: iso(addMonths(new Date(), -12 * years)),
      relationship,
      extensionNo: null,
      description: null,
      fileId: null,
    })
    const make = (
      key: string,
      employeeId: string,
      typeId: string,
      categoryId: string,
      amountRequested: number,
      status: StoredStandardRequest['status'],
      options: {
        daysAgo: number
        requiredDate: string
        reason: string
        guarantors?: StoredGuarantor[]
        approvedSteps?: number
        approved?: { amount: number; method: PaymentMethod; repaymentDate: string }
        remarks?: string
        cancelReason?: string
      },
    ) => {
      const type = loanTypes.find(typeId)
      const approved = options.approved
      const done = status !== 'pending' && status !== 'rejected'
      return seedRequest(def, {
        id: `la_${key}`,
        code: `RQ-LA-${key}`,
        employeeId,
        payload: {
          loanTypeId: typeId,
          loanCategoryId: categoryId,
          amountRequested,
          requiredDate: options.requiredDate,
          extensionNo: null,
          reason: options.reason,
          description: null,
          guarantors: options.guarantors ?? [],
          currency: approved ? 'PKR' : null,
          approvedAmount: approved?.amount ?? null,
          paymentMethod: approved?.method ?? null,
          repaymentDate: approved?.repaymentDate ?? null,
          ...(done
            ? termsOf(type)
            : {
                installments: null,
                gapBetweenInstallmentsMonths: null,
                nonPayable: type?.nonPayable ?? false,
                deductionPayItemId: type?.deductionPayItemId ?? null,
              }),
        } satisfies LoanStored,
        at: at(options.daysAgo),
        status,
        ...(options.approvedSteps !== undefined ? { approvedSteps: options.approvedSteps } : {}),
        ...(options.remarks ? { remarks: options.remarks } : {}),
        ...(options.cancelReason ? { cancelReason: options.cancelReason } : {}),
      })
    }
    return [
      // HR staff reach the HR manager directly (Approvals → Requested).
      make('0001', 'em_sadia', 'lt_bike', 'lc_personal', 180_000, 'pending', {
        daysAgo: 1,
        requiredDate: inDays(20),
        reason: 'A bike to commute to the office.',
        guarantors: [guarantor('Nadia Rehman', '35202-1234567-1', 'Friends', 6)],
      }),
      // Bilal Ahmed's team: his approvals are delegated to the HR manager (Delegates).
      make('0002', 'em_haroon', 'lt_laptop', 'lc_education', 150_000, 'pending', {
        daysAgo: 2,
        requiredDate: inDays(14),
        reason: 'A laptop for the evening course.',
      }),
      make('0003', 'em_zainab', 'lt_laptop', 'lc_education', 120_000, 'pending', {
        daysAgo: 3,
        requiredDate: inDays(10),
        reason: 'A MacBook for iOS builds at home.',
        approvedSteps: 1,
        approved: { amount: 110_000, method: 'bank', repaymentDate: firstOfMonth(1) },
      }),
      make('0004', 'em_omer', 'lt_bike', 'lc_personal', 240_000, 'completed', {
        daysAgo: 110,
        requiredDate: iso(addDays(new Date(), -100)),
        reason: 'A bike for the family.',
        guarantors: [guarantor('Kamran Farooq', '35201-7654321-3', 'Family', 20)],
        approved: { amount: 240_000, method: 'bank', repaymentDate: firstOfMonth(-2) },
      }),
      make('0005', 'em_laiba', 'lt_salary', 'lc_emergency', 60_000, 'cancelling', {
        daysAgo: 8,
        requiredDate: inDays(5),
        reason: 'Hospital bills.',
        approved: { amount: 60_000, method: 'cash', repaymentDate: firstOfMonth(1) },
        cancelReason: 'The insurance paid the bills.',
      }),
      // The HR manager's own.
      make('0006', 'em_shelley', 'lt_car', 'lc_personal', 1_500_000, 'pending', {
        daysAgo: 2,
        requiredDate: inDays(30),
        reason: 'A car for client visits.',
        guarantors: [guarantor('Ahmed Kannes', '35202-2345678-5', 'Family', 30)],
      }),
      make('0007', 'em_shelley', 'lt_salary', 'lc_emergency', 80_000, 'completed', {
        daysAgo: 150,
        requiredDate: iso(addDays(new Date(), -140)),
        reason: 'House repairs after the rain.',
        approved: { amount: 80_000, method: 'bank', repaymentDate: firstOfMonth(-3) },
      }),
      make('0008', 'em_mahnoor', 'lt_car', 'lc_personal', 2_000_000, 'rejected', {
        daysAgo: 5,
        requiredDate: inDays(25),
        reason: 'A car for the family.',
        guarantors: [guarantor('Ali Raza', '35202-3456789-7', 'Colleague', 4)],
        remarks: 'Please wait until the next review.',
      }),
      make('0009', 'em_rehan', 'lt_bike', 'lc_personal', 150_000, 'cancelled', {
        daysAgo: 40,
        requiredDate: iso(addDays(new Date(), -25)),
        reason: 'A bike to commute.',
        guarantors: [guarantor('Usman Ahmad', '35202-4567890-9', 'Relative', 10)],
        approved: { amount: 150_000, method: 'cheque', repaymentDate: firstOfMonth(1) },
        cancelReason: 'Bought one with my savings.',
      }),
      make('0012', 'em_saad', 'lt_salary', 'lc_emergency', 70_000, 'completed', {
        daysAgo: 30,
        requiredDate: iso(addDays(new Date(), -20)),
        reason: 'Father’s surgery.',
        approved: { amount: 70_000, method: 'bank', repaymentDate: firstOfMonth(1) },
      }),
      make('0010', 'em_laiba', 'lt_laptop', 'lc_education', 200_000, 'rejected', {
        daysAgo: 12,
        requiredDate: inDays(3),
        reason: 'A laptop for recruitment drives.',
        remarks: 'IT will issue a company laptop instead.',
      }),
      make('0011', 'em_shelley', 'lt_medical', 'lc_emergency', 50_000, 'rejected', {
        daysAgo: 20,
        requiredDate: iso(addDays(new Date(), -10)),
        reason: 'Physiotherapy sessions.',
        remarks: 'Covered by the health insurance.',
      }),
    ]
  },
}

const standard = defineStandardKind(def)

/** Keeps the table it is given, for the totals and Repayment, then makes the usual endpoints. */
export const loanAdvancesServer: StandardKindModule = {
  ...standard,
  handlers: (collection) => {
    table = collection
    return standard.handlers(collection)
  },
}
