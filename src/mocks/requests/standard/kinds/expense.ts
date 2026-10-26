import { addDays, format } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import type { ApiItem, Paginated } from '@/types/api'

import { createMockCollection } from '../../../collection'
import { mockFileUrl } from '../../../files/handlers'
import { errorResponse, latency, paginate, readPageParams, requireAuth } from '../../../utils'
import { staleRow, textOrNull } from '../../backend'
import { fallbackGet } from '../../fallback'
import { base, invalid, notFound, now, readBody, today } from '../../http'
import { mustFind } from '../../people'
import {
  defineStandardKind,
  seedRequest,
  type StandardKindServer,
  type StoredStandardRequest,
} from '../engine'

/*
 * Expense claims (backend `/requests/expense`): one request carries the claims
 * sent together (`details.lines`, 1–50), each with a title, date (today when
 * empty, never ahead), an active category, an amount, a description and an
 * optional receipt. A category may cap a claim (EXPENSE_OVER_LIMIT) and ask
 * for the receipt (EXPENSE_RECEIPT_REQUIRED); the same category, date and
 * amount in another live claim is refused (EXPENSE_DUPLICATE, 409); a claim
 * with no pay item to be paid under is refused (EXPENSE_NOT_PAYABLE).
 * Approvers may lower each claim (`details.lines [{id, approvedAmount}]`);
 * the rest are approved as claimed. Request Settings → Expense Categories and
 * Reimbursement live here too.
 */

// --- settings ------------------------------------------------------------------------------------

export interface ExpenseCategoryStored {
  id: string
  name: string
  payItemId: string | null
  maxAmount: number | null
  receiptRequired: boolean
  isActive: boolean
  description: string | null
  createdAt: string
  updatedAt: string | null
}

/**
 * Reimbursement pay items for when the Payroll mock does not serve them. Any
 * pay item id is accepted (the Payroll mock's own ones too); names are known for these.
 */
export const REIMBURSEMENT_PAY_ITEMS = [
  { id: 'pi_reimb_expense', name: 'Expense Reimbursement' },
  { id: 'pi_reimb_air', name: 'Air Ticket Reimbursement' },
  { id: 'pi_reimb_travel', name: 'Travel Reimbursement' },
] as const

const payItemName = (id: string | null) =>
  REIMBURSEMENT_PAY_ITEMS.find((item) => item.id === id)?.name ?? null

const seedCategories = (): ExpenseCategoryStored[] => {
  const at = '2026-01-05T09:00:00.000Z'
  const category = (
    id: string,
    name: string,
    extra: Partial<ExpenseCategoryStored> = {},
  ): ExpenseCategoryStored => ({
    id,
    name,
    payItemId: null,
    maxAmount: null,
    receiptRequired: false,
    isActive: true,
    description: null,
    createdAt: at,
    updatedAt: null,
    ...extra,
  })
  return [
    category('ec_travel', 'Travel Fee', {
      maxAmount: 50_000,
      receiptRequired: true,
      payItemId: 'pi_reimb_travel',
      description: 'Taxi, fuel and tolls.',
    }),
    category('ec_tech', 'Tech & Soft', { maxAmount: 100_000 }),
    category('ec_venue', 'Venue Rental', { receiptRequired: true }),
    category('ec_equipment', 'Equipment & Supplies'),
    category('ec_instructor', 'Instructor Fees'),
    category('ec_event', 'Event'),
    category('ec_software', 'Software', { isActive: false }),
  ]
}

export const expenseCategories = createMockCollection<ExpenseCategoryStored>({
  storageKey: 'hrms-mock-expense-categories-v1',
  seed: seedCategories,
})

const seedReimbursement = () => ({
  expensePayItemId: 'pi_reimb_expense' as string | null,
  airTicketPayItemId: 'pi_reimb_air' as string | null,
  updatedAt: null as string | null,
})
let reimbursement = seedReimbursement()

/** Request Settings → Reimbursement (also read by the air ticket mock). */
export const reimbursementSetting = () => reimbursement

export function resetExpenseSettingsDb(): void {
  expenseCategories.reset()
  reimbursement = seedReimbursement()
}

const categoryOut = (item: ExpenseCategoryStored) => ({
  id: item.id,
  name: item.name,
  payItemId: item.payItemId,
  payItemName: payItemName(item.payItemId),
  // The API sends decimals as strings.
  maxAmount: item.maxAmount === null ? null : item.maxAmount.toFixed(2),
  receiptRequired: item.receiptRequired,
  isActive: item.isActive,
  description: item.description,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  rowVersion: item.updatedAt ?? item.createdAt,
})

const reimbursementOut = () => ({
  expensePayItemId: reimbursement.expensePayItemId,
  expensePayItemName: payItemName(reimbursement.expensePayItemId),
  airTicketPayItemId: reimbursement.airTicketPayItemId,
  airTicketPayItemName: payItemName(reimbursement.airTicketPayItemId),
  updatedAt: reimbursement.updatedAt,
})

const id = z.union([z.string(), z.number()]).transform(String)
const amount = z.union([z.number(), z.string()]).transform(Number)

const categorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  payItemId: id.nullish(),
  maxAmount: amount.pipe(z.number().gt(0)).nullish(),
  receiptRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  description: z.string().max(4000).nullish(),
  rowVersion: z.string().nullish(),
})

const guard = async (request: Request) => {
  await latency()
  return requireAuth(request)
}

/** Saves a category from a body; refuses a name another category has. */
function saveCategory(
  body: z.infer<typeof categorySchema>,
  existing: ExpenseCategoryStored | null,
): Response | ExpenseCategoryStored {
  const duplicate = expenseCategories
    .all()
    .find(
      (item) =>
        item.id !== existing?.id && item.name.toLowerCase() === body.name.trim().toLowerCase(),
    )
  if (duplicate) {
    return errorResponse(409, 'A category with this name already exists.', {
      code: 'EXPENSE_CATEGORY_DUPLICATE',
      fieldErrors: { name: 'A category with this name already exists.' },
    })
  }
  const at = now()
  const item: ExpenseCategoryStored = {
    id: existing?.id ?? `ec_${Math.random().toString(36).slice(2, 8)}`,
    name: body.name.trim(),
    payItemId: body.payItemId ?? null,
    maxAmount: body.maxAmount ?? null,
    receiptRequired: body.receiptRequired,
    isActive: body.isActive,
    description: textOrNull(body.description),
    createdAt: existing?.createdAt ?? at,
    updatedAt: existing ? at : null,
  }
  if (existing) expenseCategories.update(item.id, item)
  else expenseCategories.insert(item)
  return item
}

function categoryPage(url: URL, activeOnly: boolean) {
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const isActive = url.searchParams.get('isActive')
  const rows = expenseCategories
    .all()
    .filter((item) =>
      activeOnly ? item.isActive : isActive === null || String(item.isActive) === isActive,
    )
    .filter((item) => !q || item.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
  const { page, pageSize } = readPageParams(url)
  const result = paginate(rows, page, pageSize)
  return HttpResponse.json<Paginated<ReturnType<typeof categoryOut>>>({
    ...result,
    data: result.data.map(categoryOut),
  })
}

const settingsHandlers = [
  // The claim form's dropdown: active categories (before `/requests/expense/:id`).
  http.get(base('/expense/categories'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    return categoryPage(new URL(request.url), true)
  }),

  http.get(base('/settings/expense-categories'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    return categoryPage(new URL(request.url), false)
  }),

  http.get(base('/settings/expense-categories/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const item = expenseCategories.find(String(params.id))
    return item ? HttpResponse.json({ data: categoryOut(item) }) : notFound()
  }),

  http.post(base('/settings/expense-categories'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const parsed = await readBody(request, categorySchema)
    if (!parsed.success) return invalid('Some fields are not valid.', { name: 'Enter the name.' })
    const out = saveCategory(parsed.data, null)
    if (out instanceof Response) return out
    return HttpResponse.json({ data: categoryOut(out) }, { status: 201 })
  }),

  http.put(base('/settings/expense-categories/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const existing = expenseCategories.find(String(params.id))
    if (!existing) return notFound()
    const parsed = await readBody(request, categorySchema)
    if (!parsed.success) return invalid('Some fields are not valid.', { name: 'Enter the name.' })
    const stale = staleRow(
      { updatedAt: existing.updatedAt ?? existing.createdAt },
      parsed.data.rowVersion,
    )
    if (stale) return stale
    const out = saveCategory(parsed.data, existing)
    if (out instanceof Response) return out
    return HttpResponse.json({ data: categoryOut(out) })
  }),

  http.delete(base('/settings/expense-categories/:id'), async ({ request, params }) => {
    const denied = await guard(request)
    if (denied) return denied
    const existing = expenseCategories.find(String(params.id))
    if (!existing) return notFound()
    const used = claimsUsing(existing.id)
    if (used) {
      return errorResponse(409, 'Claims were made under this category. Switch it off instead.', {
        code: 'EXPENSE_CATEGORY_IN_USE',
        fieldErrors: { id: 'Claims were made under this category. Switch it off instead.' },
      })
    }
    expenseCategories.remove(existing.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(base('/settings/reimbursement'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    return HttpResponse.json<ApiItem<ReturnType<typeof reimbursementOut>>>({
      data: reimbursementOut(),
    })
  }),

  http.put(base('/settings/reimbursement'), async ({ request }) => {
    const denied = await guard(request)
    if (denied) return denied
    const parsed = await readBody(
      request,
      z.object({ expensePayItemId: id.nullish(), airTicketPayItemId: id.nullish() }),
    )
    if (!parsed.success) return invalid('Some fields are not valid.')
    reimbursement = {
      expensePayItemId: parsed.data.expensePayItemId ?? null,
      airTicketPayItemId: parsed.data.airTicketPayItemId ?? null,
      updatedAt: now(),
    }
    return HttpResponse.json({ data: reimbursementOut() })
  }),

  // Payroll's reimbursement pay items, unless the Payroll mock serves them.
  fallbackGet('/payroll/pay-items', ({ request }) => {
    const itemType = new URL(request.url).searchParams.get('itemType')
    const rows =
      !itemType || itemType === 'reimbursement'
        ? REIMBURSEMENT_PAY_ITEMS.map((item) => ({ ...item, itemType: 'reimbursement' }))
        : []
    return HttpResponse.json({
      data: rows,
      meta: { page: 1, pageSize: 100, total: rows.length, totalPages: 1 },
    })
  }),
]

// --- the requests --------------------------------------------------------------------------------

export interface ExpenseLineStored {
  id: string
  lineNo: number
  title: string
  claimDate: string
  expenseCategoryId: string
  amount: number
  /** Set by an approver; the rest are approved as claimed at the final approval. */
  approvedAmount: number | null
  description: string
  fileId: string | null
}

export interface ExpenseStored {
  lines: ExpenseLineStored[]
  description: string | null
}

/** What approval did: the payroll month the claims are paid in (as opening balances). */
interface Effect {
  paidInMonth: string
}

const ymd = /^\d{4}-\d{2}-\d{2}$/
const schema = z.object({
  lines: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        claimDate: z.string().regex(ymd).nullish(),
        expenseCategoryId: id,
        amount: amount.pipe(z.number().gt(0)),
        description: z.string().trim().min(1).max(4000),
        fileId: id.nullish(),
      }),
    )
    .min(1)
    .max(50),
  description: z.string().max(4000).nullable(),
})
type Input = z.infer<typeof schema>

const stored = (record: StoredStandardRequest) => record.payload as unknown as ExpenseStored
const LIVE = ['pending', 'completed', 'cancelling'] as const

/** The expense requests (bound by the collection's owner, `../index.ts`). */
let expenseRecords: () => StoredStandardRequest[] = () => []

/** Whether any expense request has a claim of the category. */
function claimsUsing(categoryId: string): boolean {
  return expenseRecords().some((record) =>
    stored(record).lines.some((line) => line.expenseCategoryId === categoryId),
  )
}

const refused = (status: number, message: string, code: string, field: string) =>
  errorResponse(status, message, { code, fieldErrors: { [field]: message } })

function toPayload(
  input: Input,
  context: {
    employeeId: string
    ignoreId: string | null
    records: readonly StoredStandardRequest[]
  },
): Response | Record<string, unknown> {
  const lines: ExpenseLineStored[] = []
  for (const [index, line] of input.lines.entries()) {
    // The API names the claim in the message and puts it under `lines`.
    const claimDate = line.claimDate ?? today()
    if (claimDate > today()) {
      return invalid('A claim date cannot be in the future.', {
        lines: 'Choose today or an earlier day',
      })
    }
    const category = expenseCategories.find(line.expenseCategoryId)
    if (!category?.isActive) {
      return invalid('Choose an active expense category.', {
        lines: 'Choose an active category',
      })
    }
    if (category.maxAmount !== null && line.amount > category.maxAmount) {
      return refused(
        422,
        `${category.name} claims can be at most ${category.maxAmount.toFixed(2)}.`,
        'EXPENSE_OVER_LIMIT',
        'lines',
      )
    }
    if (category.receiptRequired && !line.fileId) {
      return refused(
        422,
        `${category.name} claims need the receipt.`,
        'EXPENSE_RECEIPT_REQUIRED',
        'lines',
      )
    }
    if (!category.payItemId && !reimbursement.expensePayItemId) {
      return refused(
        422,
        'There is no reimbursement pay item to pay this claim. Set one under Expense → Settings.',
        'EXPENSE_NOT_PAYABLE',
        'lines',
      )
    }
    const duplicate = context.records.find(
      (record) =>
        record.id !== context.ignoreId &&
        record.employeeId === context.employeeId &&
        (LIVE as readonly string[]).includes(record.status) &&
        stored(record).lines.some(
          (other) =>
            other.expenseCategoryId === category.id &&
            other.claimDate === claimDate &&
            other.amount === line.amount,
        ),
    )
    if (duplicate) {
      return refused(
        409,
        `${mustFind(context.employeeId).name} already claimed this (${duplicate.code}).`,
        'EXPENSE_DUPLICATE',
        'lines',
      )
    }
    lines.push({
      id: String(index + 1),
      lineNo: index + 1,
      title: line.title,
      claimDate,
      expenseCategoryId: category.id,
      amount: line.amount,
      approvedAmount: null,
      description: line.description,
      fileId: line.fileId ?? null,
    })
  }
  return { lines, description: input.description } satisfies ExpenseStored
}

const APPROVED = ['completed', 'cancelling'] as const
const isApproved = (record: StoredStandardRequest) =>
  (APPROVED as readonly string[]).includes(record.status)

function toDetails(payload: Record<string, unknown>, record: StoredStandardRequest) {
  const value = payload as unknown as ExpenseStored
  const effect = record.effect as Effect | undefined
  const lines = value.lines.map((line) => {
    const approved = line.approvedAmount ?? (isApproved(record) ? line.amount : null)
    return {
      id: line.id,
      lineNo: line.lineNo,
      title: line.title,
      claimDate: line.claimDate,
      expenseCategoryId: line.expenseCategoryId,
      expenseCategoryName: expenseCategories.find(line.expenseCategoryId)?.name ?? null,
      amount: line.amount,
      approvedAmount: approved,
      description: line.description,
      fileId: line.fileId,
      fileName: line.fileId ? `receipt-${line.fileId}.pdf` : null,
      fileUrl: line.fileId ? mockFileUrl(line.fileId) : null,
      openingBalanceId: effect && approved ? `ob_${record.id}_${String(line.lineNo)}` : null,
      paidInMonth: effect && approved ? effect.paidInMonth : null,
    }
  })
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  const anyApproved = lines.some((line) => line.approvedAmount !== null)
  return {
    currency: 'PKR',
    totalAmount: total,
    approvedAmount: anyApproved
      ? lines.reduce((sum, line) => sum + (line.approvedAmount ?? line.amount), 0)
      : null,
    lines,
  }
}

const decisionSchema = z.object({
  lines: z.array(z.object({ id, approvedAmount: amount.pipe(z.number().min(0)) })).nullish(),
})

function applyDecision(
  record: StoredStandardRequest,
  extras: Record<string, unknown>,
): Response | Record<string, unknown> {
  const parsed = decisionSchema.safeParse(extras)
  if (!parsed.success) return invalid('Some fields are not valid.')
  const value = stored(record)
  const lines = value.lines.map((line) => ({ ...line }))
  for (const change of parsed.data.lines ?? []) {
    const line = lines.find((item) => item.id === change.id)
    if (!line) return invalid('That claim is not on this request.', { lines: 'Unknown claim.' })
    if (change.approvedAmount > line.amount) {
      return invalid('An approved amount cannot be more than the claim.', {
        lines: 'An approved amount cannot be more than the claim.',
      })
    }
    line.approvedAmount = change.approvedAmount
  }
  return { ...value, lines } satisfies ExpenseStored
}

const iso = (date: Date) => format(date, 'yyyy-MM-dd')
const firstOfMonth = () => `${today().slice(0, 7)}-01`

const def: StandardKindServer<Input> = {
  kind: 'expense',
  typeCode: 'expense',
  typeName: 'Expense',
  settingsType: 'expense',
  codePrefix: 'EXP-',
  codeDigits: 4,
  fromBody: (body) => ({
    lines: body.details.lines,
    description: body.description ?? null,
  }),
  schema,
  toPayload,
  dateOf: (payload) => (payload as unknown as ExpenseStored).lines[0]?.claimDate ?? today(),
  header: (payload) => {
    const value = payload as unknown as ExpenseStored
    const dates = value.lines.map((line) => line.claimDate).sort()
    return {
      fromDate: dates[0] ?? null,
      toDate: dates.at(-1) ?? null,
      days: null,
      reason: null,
      description: value.description,
      application: null,
    }
  },
  toDetails,
  decision: {
    schema: z.record(z.string(), z.unknown()),
    apply: applyDecision,
  },
  onCompleted: (): Effect => ({ paidInMonth: firstOfMonth() }),
  seed: () => {
    const day = (offset: number) => iso(addDays(new Date(), offset))
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()
    const line = (
      lineNo: number,
      title: string,
      categoryId: string,
      claimAmount: number,
      daysAgo: number,
      fileId: string | null = null,
    ): ExpenseLineStored => ({
      id: String(lineNo),
      lineNo,
      title,
      claimDate: day(-daysAgo),
      expenseCategoryId: categoryId,
      amount: claimAmount,
      approvedAmount: null,
      description: `${title} for the client visit.`,
      fileId,
    })
    const payload = (lines: ExpenseLineStored[]) =>
      ({ lines, description: null }) satisfies ExpenseStored as unknown as Record<string, unknown>
    return [
      seedRequest(def, {
        id: 'exp_0001',
        code: 'EXP-0001',
        employeeId: 'em_sadia',
        payload: payload([
          line(1, 'Taxi to client', 'ec_travel', 2_500, 3, 'file_seed_r1'),
          line(2, 'Design licence', 'ec_tech', 12_000, 2),
        ]),
        at: at(2),
      }),
      seedRequest(def, {
        id: 'exp_0002',
        code: 'EXP-0002',
        employeeId: 'em_shelley',
        payload: payload([line(1, 'Training venue', 'ec_venue', 30_000, 6, 'file_seed_r2')]),
        at: at(5),
      }),
      seedRequest(def, {
        id: 'exp_0003',
        code: 'EXP-0003',
        employeeId: 'em_omer',
        payload: payload([line(1, 'Printer toner', 'ec_equipment', 8_000, 20)]),
        at: at(19),
        status: 'completed',
      }),
      seedRequest(def, {
        id: 'exp_0004',
        code: 'EXP-0004',
        employeeId: 'em_laiba',
        payload: payload([line(1, 'Team dinner', 'ec_event', 15_000, 12)]),
        at: at(11),
        status: 'rejected',
        remarks: 'Not a reimbursable event.',
      }),
    ].map((record) =>
      record.status === 'completed'
        ? { ...record, effect: { paidInMonth: firstOfMonth() } }
        : record,
    )
  },
  extraHandlers: settingsHandlers,
}

export const expenseServer = defineStandardKind(def)

/** Lets the category delete check read the requests (set by the collection owner). */
export function bindExpenseRecords(read: () => StoredStandardRequest[]): void {
  expenseRecords = read
}
