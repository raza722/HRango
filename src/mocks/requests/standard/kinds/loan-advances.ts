import {
  addDays,
  addMonths,
  differenceInMonths,
  format,
  parse,
  parseISO,
  startOfMonth,
} from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type { Paginated } from '@/types/api'

import { toProfile } from '../../../attendance/seed'
import type { MockCollection } from '../../../collection'
import { DIRECTORY, findEmployee } from '../../../employees/seed'
import { profileOf } from '../../../scheduling/seed'
import { latency, paginate, readPageParams, requireAuth } from '../../../utils'
import { base, invalid, today } from '../../http'
import { mustFind, requestEmployee } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindModule,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'
import {
  loanCategories,
  type LoanContractType,
  loanSettingsHandlers,
  loanTypes,
  resetLoanSettings,
  type StoredLoanType,
} from './loan-advances-settings'

/*
 * Loan & Advances: the person asks for an amount of a type (Settings → Types)
 * and a category, by a date, with guarantors when the type needs them. The
 * type's terms are checked: months of service, the contract types it is
 * offered on, and the gap since the last request of that type. Each approver
 * fills in the approved amount (at most the amount asked), the payment method
 * and the first repayment date; on approval the type's installments are kept
 * on the request, and Settings → Repayment lists them: the approved amount
 * split over No of Installments, one every Gap Between Installments months
 * from the repayment date. A Non Payable type is not repaid.
 */

const ymd = /^\d{4}-\d{2}-\d{2}$/

const guarantorSchema = z.object({
  name: z.string().max(200),
  cnic: z.string().max(40),
  attachment: z.string().max(200).nullable(),
  knownSince: z.string().max(20),
  relationship: z.string().max(60),
  extensionNo: z.string().max(20),
  description: z.string().max(1000),
})

const schema = z.object({
  typeId: z.string().min(1),
  categoryId: z.string().min(1),
  requiredAmount: z.number(),
  requiredDate: z.string().regex(ymd),
  extensionNo: z.string().max(20),
  attachment: z.string().max(200).nullable(),
  reason: z.string().max(1000),
  guarantors: z.array(guarantorSchema).max(10),
})
type Input = z.infer<typeof schema>
type Guarantor = z.infer<typeof guarantorSchema>

export const PAYMENT_METHODS = ['bank', 'cash', 'pay-order', 'cheque'] as const
type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const RELATIONSHIPS = ['Family', 'Friends', 'Colleague', 'Relative', 'Neighbour']

export interface LoanStored {
  typeId: string
  categoryId: string
  requiredAmount: number
  requiredDate: string
  extensionNo: string
  attachment: string | null
  reason: string
  guarantors: Guarantor[]
  currency: 'PKR'
  approvedAmount: number | null
  paymentMethod: PaymentMethod | null
  repaymentDate: string | null
  installments: number | null
  installmentGapMonths: number | null
  nonPayable: boolean
  deductionPayitem: string | null
}

const day = (date: string) => parse(date, 'yyyy-MM-dd', new Date())
const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const long = (date: Date) => format(date, 'd MMM yyyy')
const money = (amount: number) =>
  `PKR ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)}`

const stored = (record: StoredStandardRequest) => record.payload as unknown as LoanStored

/** The standard requests table, kept when the handlers are made (for totals and Repayment). */
let table: MockCollection<StoredStandardRequest> | null = null
const loans = () => (table?.all() ?? []).filter((record) => record.kind === 'loan-advances')

const CONTRACT_LABELS: Record<LoanContractType, string> = {
  'management-trainee': 'Management Trainee',
  'daily-wager': 'Daily Wager',
  permanent: 'Permanent',
  contractual: 'Contractual',
}

/** The person's contract, as the types name them (probation is a permanent contract). */
function contractOf(employeeId: string): LoanContractType {
  const employee = findEmployee(employeeId)
  const type = employee ? profileOf(employee).employmentType : 'permanent'
  if (type === 'contract') return 'contractual'
  if (type === 'intern') return 'management-trainee'
  return 'permanent'
}

const monthsOfService = (employeeId: string) =>
  differenceInMonths(new Date(), day(toProfile(mustFind(employeeId)).joiningDate))

/** The default first repayment: the 1st of the month after the money is needed. */
function defaultRepaymentDate(requiredDate: string): string {
  const from = requiredDate > today() ? requiredDate : today()
  return iso(startOfMonth(addMonths(day(from), 1)))
}

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
  const gap = payload.installmentGapMonths ?? 1
  const each = Math.round(approvedAmount / installments)
  return Array.from({ length: installments }, (_, index) => ({
    number: index + 1,
    date: iso(addMonths(day(repaymentDate), index * gap)),
    // The last installment takes the rounding, so they add up to the approved amount.
    amount: index === installments - 1 ? approvedAmount - each * (installments - 1) : each,
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

const LIVE = new Set<StoredStandardRequest['status']>(['pending', 'completed', 'cancelling'])

function checkGuarantors(guarantors: readonly Guarantor[]): string | null {
  for (const [index, guarantor] of guarantors.entries()) {
    const which = guarantors.length > 1 ? `Guarantor ${String(index + 1)}` : 'The guarantor'
    if (!guarantor.name.trim()) return `${which} needs a name.`
    if (!/^\d{5}-\d{7}-\d$/.test(guarantor.cnic.trim())) {
      return `${which}: write the CNIC as 12345-1234567-1.`
    }
    if (!ymd.test(guarantor.knownSince) || guarantor.knownSince > today()) {
      return `${which}: choose when you met, today or earlier.`
    }
    if (!RELATIONSHIPS.includes(guarantor.relationship)) return `${which}: choose the relationship.`
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
  const type = loanTypes.find(input.typeId)
  if (!type?.active) {
    return invalid('Choose a loan & advances type.', { typeId: 'Choose a loan & advances type' })
  }
  const category = loanCategories.find(input.categoryId)
  if (!category?.active) {
    return invalid('Choose a loan & advances category.', {
      categoryId: 'Choose a loan & advances category',
    })
  }
  if (!Number.isFinite(input.requiredAmount) || input.requiredAmount <= 0) {
    return invalid('Enter the amount you need.', { requiredAmount: 'Enter the amount' })
  }
  if (input.requiredAmount > 100_000_000) {
    return invalid('Ask for PKR 100,000,000 at most.', { requiredAmount: 'Too large an amount' })
  }
  if (input.requiredDate < today()) {
    return invalid('Choose today or a later day.', { requiredDate: 'Choose today or a later day' })
  }
  if (!input.reason.trim()) return invalid('Give a reason.', { reason: 'Give a reason' })

  // The type's terms: months of service, contract type, gap between requests.
  const months = monthsOfService(employee.id)
  if (months < type.experienceMonths) {
    return invalid(
      `${type.name} needs ${String(type.experienceMonths)} months of service; ${employee.name} has ${String(months)}.`,
      { typeId: `Needs ${String(type.experienceMonths)} months of service` },
    )
  }
  const contract = contractOf(employee.id)
  if (!type.contractTypes.includes(contract)) {
    return invalid(`${type.name} is not offered on a ${CONTRACT_LABELS[contract]} contract.`, {
      typeId: `Not offered on a ${CONTRACT_LABELS[contract]} contract`,
    })
  }
  const sameType = context.records
    .filter(
      (record) =>
        record.id !== context.ignoreId &&
        record.employeeId === employee.id &&
        LIVE.has(record.status) &&
        stored(record).typeId === type.id,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const waiting = sameType.find((record) => record.status === 'pending')
  if (waiting) {
    return invalid(`${waiting.code} asks for a ${type.name} and is still pending.`, {
      typeId: `${waiting.code} is still pending`,
    })
  }
  const last = sameType[0]
  if (last && type.requestGapMonths) {
    const next = addMonths(parseISO(last.createdAt), type.requestGapMonths)
    if (next > new Date()) {
      return invalid(
        `${type.name} allows one request every ${String(type.requestGapMonths)} months; after ${last.code} the next can be made from ${long(next)}.`,
        { typeId: `Next ${type.name} from ${long(next)}` },
      )
    }
  }

  if (type.guarantorRequired && input.guarantors.length === 0) {
    return invalid(`${type.name} needs a guarantor.`, { guarantors: 'Add a guarantor' })
  }
  const guarantorError = checkGuarantors(input.guarantors)
  if (guarantorError) return invalid(guarantorError, { guarantors: guarantorError })

  return {
    typeId: type.id,
    categoryId: category.id,
    requiredAmount: Math.round(input.requiredAmount),
    requiredDate: input.requiredDate,
    extensionNo: input.extensionNo.trim(),
    attachment: input.attachment,
    reason: input.reason.trim(),
    guarantors: input.guarantors.map((guarantor) => ({
      ...guarantor,
      name: guarantor.name.trim(),
      cnic: guarantor.cnic.trim(),
      extensionNo: guarantor.extensionNo.trim(),
      description: guarantor.description.trim(),
    })),
    currency: 'PKR',
    approvedAmount: null,
    paymentMethod: null,
    repaymentDate: null,
    installments: null,
    installmentGapMonths: null,
    nonPayable: type.nonPayable,
    deductionPayitem: type.deductionPayitem,
  } satisfies LoanStored
}

/** The type's terms, kept on the request when it is approved. */
const termsOf = (type: StoredLoanType | undefined) => ({
  installments: type?.installments ?? 1,
  installmentGapMonths: type?.installmentGapMonths ?? 1,
  nonPayable: type?.nonPayable ?? false,
  deductionPayitem: type?.deductionPayitem ?? null,
})

const decisionSchema = z.object({
  approvedAmount: z.union([z.string(), z.number()]).nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  repaymentDate: z.string().nullable().optional(),
})

/**
 * The approver's fields. From the Approve popup all three are needed; the
 * bulk "Approved" sends none, and then the amount asked, Bank and the default
 * repayment date are used (or what an earlier approver chose).
 */
function applyDecision(
  record: StoredStandardRequest,
  extras: Record<string, unknown>,
): Response | Record<string, unknown> {
  const payload = stored(record)
  const type = loanTypes.find(payload.typeId)
  if (Object.keys(extras).length === 0) {
    return {
      ...payload,
      currency: 'PKR',
      approvedAmount: payload.approvedAmount ?? payload.requiredAmount,
      paymentMethod: payload.paymentMethod ?? 'bank',
      repaymentDate: payload.repaymentDate ?? defaultRepaymentDate(payload.requiredDate),
      ...termsOf(type),
    } satisfies LoanStored
  }
  const errors: Record<string, string> = {}
  const raw = extras.approvedAmount
  const amount =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : NaN
  if (!Number.isFinite(amount) || amount <= 0) errors.approvedAmount = 'Enter the approved amount'
  else if (amount > payload.requiredAmount) {
    errors.approvedAmount = `At most the amount asked, ${money(payload.requiredAmount)}`
  }
  const method = PAYMENT_METHODS.find((value) => value === extras.paymentMethod)
  if (!method) errors.paymentMethod = 'Choose the payment method'
  const date = typeof extras.repaymentDate === 'string' ? extras.repaymentDate : ''
  if (!ymd.test(date)) errors.repaymentDate = 'Choose the repayment date'
  else if (date < payload.requiredDate) {
    errors.repaymentDate = 'Choose the required date or a later day'
  }
  const first = Object.values(errors)[0]
  if (first || !method) return invalid(`${first ?? 'Fill in the approval fields'}.`, errors)
  return {
    ...payload,
    currency: 'PKR',
    approvedAmount: Math.round(amount),
    paymentMethod: method,
    repaymentDate: date,
    ...termsOf(type),
  } satisfies LoanStored
}

const numberFilter = (value: string) => {
  const number = Number(value.replace(/,/g, ''))
  return Number.isFinite(number) ? number : null
}

/** Settings → Repayment: every installment of the approved loans. */
const repaymentsHandler = http.get(
  base('/loan-advances/settings/repayments'),
  async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const url = new URL(request.url)
    const get = (name: string) => url.searchParams.get(name) ?? ''
    const now = today()
    const rows = loans().flatMap((record) => {
      const payload = stored(record)
      const employee = requestEmployee(mustFind(record.employeeId))
      const schedule = scheduleOf(record)
      return schedule.map((installment) => ({
        id: `${record.id}-${String(installment.number)}`,
        requestId: record.id,
        code: record.code,
        employee: {
          id: employee.id,
          name: employee.name,
          code: employee.code,
          department: employee.department,
          photoUrl: employee.photoUrl,
        },
        typeId: payload.typeId,
        typeName: loanTypes.find(payload.typeId)?.name ?? '—',
        approvedAmount: payload.approvedAmount ?? 0,
        installment: installment.number,
        installments: schedule.length,
        date: installment.date,
        amount: installment.amount,
        deductionPayitem: payload.deductionPayitem,
        status: installment.date <= now ? ('repaid' as const) : ('due' as const),
      }))
    })
    const filtered = rows
      .filter((row) => !get('employeeId') || row.employee.id === get('employeeId'))
      .filter((row) => !get('department') || row.employee.department === get('department'))
      .filter((row) => !get('typeId') || row.typeId === get('typeId'))
      .filter((row) => !get('status') || row.status === get('status'))
      .filter((row) => !get('from') || row.date >= get('from'))
      .filter((row) => !get('to') || row.date <= get('to'))
      .filter((row) => !get('code') || row.code.toLowerCase().includes(get('code').toLowerCase()))
      .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code))
      .map(({ typeId: _typeId, ...row }) => row)
    const { page, pageSize } = readPageParams(url)
    return HttpResponse.json<Paginated<(typeof filtered)[number]>>(
      paginate(filtered, page, pageSize),
    )
  },
)

const usedBy = (field: 'typeId' | 'categoryId', id: string) =>
  loans().find((record) => stored(record)[field] === id)?.code ?? null

const def: StandardKindServer<Input> = {
  kind: 'loan-advances',
  settingsType: 'lend',
  codePrefix: 'LA-',
  codeDigits: 4,
  schema,
  toPayload,
  // Request Restriction and the From / To filters read the day the money is needed.
  dateOf: (payload) => String(payload.requiredDate),
  present: (payload, record) => {
    const value = payload as unknown as LoanStored
    return {
      ...value,
      typeName: loanTypes.find(value.typeId)?.name ?? '—',
      categoryName: loanCategories.find(value.categoryId)?.name ?? '—',
      totals: totalsOf(record.employeeId),
    }
  },
  filters: {
    code: (record, value) => record.code.toLowerCase().includes(value.trim().toLowerCase()),
    typeId: (record, value) => stored(record).typeId === value,
    amountFrom: (record, value) => {
      const number = numberFilter(value)
      return number === null || stored(record).requiredAmount >= number
    },
    amountTo: (record, value) => {
      const number = numberFilter(value)
      return number === null || stored(record).requiredAmount <= number
    },
    location: (record, value) => requestEmployee(mustFind(record.employeeId)).location === value,
    branch: (record, value) => requestEmployee(mustFind(record.employeeId)).branch === value,
  },
  lookups: () => {
    const people = DIRECTORY.map((employee) => requestEmployee(employee))
    const names = (values: (string | null)[]) =>
      [...new Set(values.filter((value): value is string => Boolean(value)))].sort()
    return {
      types: loanTypes
        .all()
        .filter((type) => type.active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((type) => ({
          id: type.id,
          name: type.name,
          guarantorRequired: type.guarantorRequired,
          nonPayable: type.nonPayable,
          experienceMonths: type.experienceMonths,
          requestGapMonths: type.requestGapMonths,
          installments: type.installments,
          installmentGapMonths: type.installmentGapMonths,
        })),
      categories: loanCategories
        .all()
        .filter((category) => category.active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((category) => ({ id: category.id, name: category.name })),
      locations: names(people.map((person) => person.location)),
      branches: names(people.map((person) => person.branch)),
    }
  },
  decision: {
    schema: decisionSchema,
    apply: applyDecision,
  },
  extraHandlers: [repaymentsHandler, ...loanSettingsHandlers(usedBy)],
  seed: () => {
    // The settings start again with the requests (tests reset the requests table).
    resetLoanSettings()
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const inDays = (offset: number) => iso(addDays(new Date(), offset))
    const firstOfMonth = (offsetMonths: number) =>
      iso(startOfMonth(addMonths(new Date(), offsetMonths)))
    const guarantor = (name: string, cnic: string, relationship: string, years: number) => ({
      name,
      cnic,
      attachment: null,
      knownSince: iso(addMonths(new Date(), -12 * years)),
      relationship,
      extensionNo: '',
      description: '',
    })
    const make = (
      id: string,
      employeeId: string,
      typeId: string,
      categoryId: string,
      amount: number,
      status: StoredStandardRequest['status'],
      options: {
        daysAgo: number
        requiredDate: string
        reason: string
        guarantors?: Guarantor[]
        approvedSteps?: number
        approved?: { amount: number; method: PaymentMethod; repaymentDate: string }
        remarks?: string
        cancelReason?: string
      },
    ) => {
      const type = loanTypes.find(typeId)
      const approved = options.approved
      return seedRequest(def, {
        id,
        code: `LA-${id.slice(-4)}`,
        employeeId,
        payload: {
          typeId,
          categoryId,
          requiredAmount: amount,
          requiredDate: options.requiredDate,
          extensionNo: '',
          attachment: null,
          reason: options.reason,
          guarantors: options.guarantors ?? [],
          currency: 'PKR',
          approvedAmount: approved?.amount ?? null,
          paymentMethod: approved?.method ?? null,
          repaymentDate: approved?.repaymentDate ?? null,
          ...(approved
            ? termsOf(type)
            : {
                installments: null,
                installmentGapMonths: null,
                nonPayable: type?.nonPayable ?? false,
                deductionPayitem: type?.deductionPayitem ?? null,
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
      make('la_0001', 'em_sadia', 'lt_bike', 'lc_personal', 180_000, 'pending', {
        daysAgo: 1,
        requiredDate: inDays(20),
        reason: 'A bike to commute to the office.',
        guarantors: [guarantor('Nadia Rehman', '35202-1234567-1', 'Friends', 6)],
      }),
      // Bilal Ahmed's team: his approvals are delegated to the HR manager (Delegates).
      make('la_0002', 'em_haroon', 'lt_laptop', 'lc_education', 150_000, 'pending', {
        daysAgo: 2,
        requiredDate: inDays(14),
        reason: 'A laptop for the evening course.',
      }),
      make('la_0003', 'em_zainab', 'lt_laptop', 'lc_education', 120_000, 'pending', {
        daysAgo: 3,
        requiredDate: inDays(10),
        reason: 'A MacBook for iOS builds at home.',
        approvedSteps: 1,
        approved: { amount: 110_000, method: 'bank', repaymentDate: firstOfMonth(1) },
      }),
      // Finance goes to Hina Raza first, then the HR manager.
      make('la_0004', 'em_omer', 'lt_bike', 'lc_personal', 240_000, 'completed', {
        daysAgo: 110,
        requiredDate: iso(addDays(new Date(), -100)),
        reason: 'A bike for the family.',
        guarantors: [guarantor('Kamran Farooq', '35201-7654321-3', 'Family', 20)],
        approved: { amount: 240_000, method: 'bank', repaymentDate: firstOfMonth(-2) },
      }),
      make('la_0005', 'em_laiba', 'lt_salary', 'lc_emergency', 60_000, 'cancelling', {
        daysAgo: 8,
        requiredDate: inDays(5),
        reason: 'Hospital bills.',
        approved: { amount: 60_000, method: 'cash', repaymentDate: firstOfMonth(1) },
        cancelReason: 'The insurance paid the bills.',
      }),
      // The HR manager's own: Daniel Brooks, then Kaleem Murtaza.
      make('la_0006', 'em_shelley', 'lt_car', 'lc_personal', 1_500_000, 'pending', {
        daysAgo: 2,
        requiredDate: inDays(30),
        reason: 'A car for client visits.',
        guarantors: [guarantor('Ahmed Kannes', '35202-2345678-5', 'Family', 30)],
      }),
      make('la_0007', 'em_shelley', 'lt_salary', 'lc_emergency', 80_000, 'completed', {
        daysAgo: 150,
        requiredDate: iso(addDays(new Date(), -140)),
        reason: 'House repairs after the rain.',
        approved: { amount: 80_000, method: 'bank', repaymentDate: firstOfMonth(-3) },
      }),
      make('la_0008', 'em_mahnoor', 'lt_car', 'lc_personal', 2_000_000, 'rejected', {
        daysAgo: 5,
        requiredDate: inDays(25),
        reason: 'A car for the family.',
        guarantors: [guarantor('Ali Raza', '35202-3456789-7', 'Colleague', 4)],
        remarks: 'Please wait until the next review.',
      }),
      make('la_0009', 'em_rehan', 'lt_bike', 'lc_personal', 150_000, 'cancelled', {
        daysAgo: 40,
        requiredDate: iso(addDays(new Date(), -25)),
        reason: 'A bike to commute.',
        guarantors: [guarantor('Usman Ahmad', '35202-4567890-9', 'Relative', 10)],
        approved: { amount: 150_000, method: 'cheque', repaymentDate: firstOfMonth(1) },
        cancelReason: 'Bought one with my savings.',
      }),
      make('la_0012', 'em_saad', 'lt_salary', 'lc_emergency', 70_000, 'completed', {
        daysAgo: 30,
        requiredDate: iso(addDays(new Date(), -20)),
        reason: 'Father’s surgery.',
        approved: { amount: 70_000, method: 'bank', repaymentDate: firstOfMonth(1) },
      }),
      make('la_0010', 'em_laiba', 'lt_laptop', 'lc_education', 200_000, 'rejected', {
        daysAgo: 12,
        requiredDate: inDays(3),
        reason: 'A laptop for recruitment drives.',
        remarks: 'IT will issue a company laptop instead.',
      }),
      make('la_0011', 'em_shelley', 'lt_medical', 'lc_emergency', 50_000, 'rejected', {
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
