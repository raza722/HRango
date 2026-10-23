import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type { ApiItem, Paginated } from '@/types/api'

import { createMockCollection, type MockCollection } from '../../../collection'
import { createId, latency, paginate, readPageParams, requireAuth } from '../../../utils'
import { base, forbidden, invalid, notFound, now } from '../../http'

/*
 * Loan & Advances → Settings: the Types (terms each loan follows) and the
 * Categories the Create form offers. Repayment is worked out from the
 * approved requests (see loan-advances.ts).
 */

export type LoanContractType = 'management-trainee' | 'daily-wager' | 'permanent' | 'contractual'

export interface StoredLoanType {
  id: string
  name: string
  active: boolean
  guarantorRequired: boolean
  nonPayable: boolean
  experienceMonths: number
  requestGapMonths: number | null
  installments: number
  installmentGapMonths: number
  formula: string
  contractTypes: LoanContractType[]
  deductionPayitem: string | null
  description: string
  createdAt: string
}

export interface StoredLoanCategory {
  id: string
  name: string
  active: boolean
  description: string
  createdAt: string
}

export const CONTRACT_TYPES = [
  'management-trainee',
  'daily-wager',
  'permanent',
  'contractual',
] as const satisfies readonly LoanContractType[]

const DEDUCTION_PAYITEMS = [
  'Medical',
  'Overtime',
  'Salary Per Month',
  'Earned Salary',
  'EOBI',
  'Yearly Tax',
] as const

const FORMULA_VARIABLES = [
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

const created = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

function seedTypes(): StoredLoanType[] {
  const type = (
    id: string,
    name: string,
    terms: Omit<StoredLoanType, 'id' | 'name' | 'createdAt' | 'description'> & {
      description?: string
    },
    daysAgo: number,
  ): StoredLoanType => ({
    id,
    name,
    description: '',
    ...terms,
    createdAt: created(daysAgo),
  })
  return [
    type(
      'lt_car',
      'Car Loan',
      {
        active: true,
        guarantorRequired: true,
        nonPayable: false,
        experienceMonths: 24,
        requestGapMonths: 24,
        installments: 36,
        installmentGapMonths: 1,
        formula: 'Gross Salary',
        contractTypes: ['permanent'],
        deductionPayitem: 'Salary Per Month',
        description: 'For buying a car; repaid from salary over three years.',
      },
      300,
    ),
    type(
      'lt_bike',
      'Bike Loan',
      {
        active: true,
        guarantorRequired: true,
        nonPayable: false,
        experienceMonths: 6,
        requestGapMonths: 12,
        installments: 12,
        installmentGapMonths: 1,
        formula: 'Gross Salary',
        contractTypes: ['permanent', 'contractual'],
        deductionPayitem: 'Salary Per Month',
      },
      310,
    ),
    type(
      'lt_laptop',
      'Laptop Advance',
      {
        active: true,
        guarantorRequired: false,
        nonPayable: false,
        experienceMonths: 3,
        requestGapMonths: 12,
        installments: 6,
        installmentGapMonths: 1,
        formula: 'Gross Salary',
        contractTypes: ['permanent', 'contractual', 'management-trainee'],
        deductionPayitem: 'Earned Salary',
      },
      320,
    ),
    type(
      'lt_salary',
      'Salary Advance',
      {
        active: true,
        guarantorRequired: false,
        nonPayable: false,
        experienceMonths: 1,
        requestGapMonths: 2,
        installments: 2,
        installmentGapMonths: 1,
        formula: 'Per Day Salary',
        contractTypes: ['permanent', 'contractual', 'management-trainee', 'daily-wager'],
        deductionPayitem: 'Salary Per Month',
      },
      330,
    ),
    type(
      'lt_medical',
      'Medical Assistance',
      {
        active: true,
        guarantorRequired: false,
        nonPayable: true,
        experienceMonths: 0,
        requestGapMonths: null,
        installments: 1,
        installmentGapMonths: 1,
        formula: 'Gross Salary',
        contractTypes: ['permanent', 'contractual'],
        deductionPayitem: 'Medical',
        description: 'Paid by the company; not repaid.',
      },
      340,
    ),
    type(
      'lt_house',
      'House Loan',
      {
        active: false,
        guarantorRequired: true,
        nonPayable: false,
        experienceMonths: 60,
        requestGapMonths: 60,
        installments: 60,
        installmentGapMonths: 1,
        formula: 'Gross Salary',
        contractTypes: ['permanent'],
        deductionPayitem: 'Salary Per Month',
        description: 'Paused while the policy is reviewed.',
      },
      350,
    ),
  ]
}

function seedCategories(): StoredLoanCategory[] {
  const category = (
    id: string,
    name: string,
    active: boolean,
    description: string,
    daysAgo: number,
  ): StoredLoanCategory => ({ id, name, active, description, createdAt: created(daysAgo) })
  return [
    category('lc_personal', 'Personal', true, 'For the employee’s own needs.', 300),
    category('lc_emergency', 'Emergency', true, 'Medical or family emergencies.', 305),
    category('lc_education', 'Education', true, 'Courses, fees and study equipment.', 310),
    category('lc_business', 'Business', false, 'Work equipment the employee buys.', 315),
  ]
}

export const loanTypes = createMockCollection<StoredLoanType>({
  storageKey: 'hrms-mock-standard-loan-advances-types',
  seed: seedTypes,
})

export const loanCategories = createMockCollection<StoredLoanCategory>({
  storageKey: 'hrms-mock-standard-loan-advances-categories',
  seed: seedCategories,
})

/** Runs when the standard requests table is seeded again (a reset), so the settings follow. */
export function resetLoanSettings(): void {
  loanTypes.reset()
  loanCategories.reset()
}

// --- the endpoints ----------------------------------------------------------------------------------

const count = (min: number, max: number) => z.number().int().min(min).max(max)

const typeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  active: z.boolean(),
  guarantorRequired: z.boolean(),
  nonPayable: z.boolean(),
  experienceMonths: count(0, 600),
  requestGapMonths: count(0, 120).nullable(),
  installments: count(1, 120),
  installmentGapMonths: count(1, 12),
  formula: z.enum(FORMULA_VARIABLES),
  contractTypes: z.array(z.enum(CONTRACT_TYPES)).min(1),
  deductionPayitem: z.enum(DEDUCTION_PAYITEMS).nullable(),
  description: z.string().trim().max(500),
})

const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  active: z.boolean(),
  description: z.string().trim().max(500),
})

/** Which requests use a type or category (they cannot be deleted then). */
export type UsedBy = (field: 'typeId' | 'categoryId', id: string) => string | null

const path = (suffix: string) => base(`/loan-advances/settings${suffix}`)

async function guard(request: Request) {
  await latency()
  return requireAuth(request)
}

function listOf<T extends { name: string; active: boolean; createdAt: string }>(
  url: URL,
  items: readonly T[],
) {
  const name = url.searchParams.get('name')?.trim().toLowerCase()
  const status = url.searchParams.get('status')
  const { page, pageSize } = readPageParams(url)
  const filtered = items
    .filter((item) => !name || item.name.toLowerCase().includes(name))
    .filter((item) => !status || (status === 'active') === item.active)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return HttpResponse.json<Paginated<T>>(paginate(filtered, page, pageSize))
}

/** CRUD for one settings list (types or categories). */
function crud<T extends { id: string; name: string; active: boolean; createdAt: string }, I>(
  options: {
    suffix: string
    idPrefix: string
    noun: string
    field: 'typeId' | 'categoryId'
    collection: MockCollection<T>
    schema: z.ZodType<I>
    build: (input: I, id: string, createdAt: string) => T
  },
  usedBy: UsedBy,
): HttpHandler[] {
  const { suffix, collection, noun } = options
  const clash = (name: string, ignoreId: string | null) =>
    collection
      .all()
      .some((item) => item.id !== ignoreId && item.name.toLowerCase() === name.trim().toLowerCase())

  async function read(request: Request, ignoreId: string | null) {
    const body: unknown = await request.json().catch(() => null)
    const parsed = options.schema.safeParse(body)
    if (!parsed.success) return invalid('Some fields are not valid.')
    const name = (parsed.data as { name: string }).name
    if (clash(name, ignoreId)) {
      return invalid(`A ${noun} named ${name.trim()} already exists.`, {
        name: 'Choose another name',
      })
    }
    return parsed.data
  }

  return [
    http.get(path(suffix), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      return listOf(new URL(request.url), collection.all())
    }),
    http.post(path(suffix), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const input = await read(request, null)
      if (input instanceof Response) return input
      const item = options.build(input, createId(options.idPrefix), now())
      collection.insert(item)
      return HttpResponse.json<ApiItem<T>>({ data: item })
    }),
    http.put(path(`${suffix}/:id`), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const current = typeof params.id === 'string' ? collection.find(params.id) : undefined
      if (!current) return notFound()
      const input = await read(request, current.id)
      if (input instanceof Response) return input
      const next = options.build(input, current.id, current.createdAt)
      collection.update(current.id, next)
      return HttpResponse.json<ApiItem<T>>({ data: next })
    }),
    http.delete(path(`${suffix}/:id`), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const current = typeof params.id === 'string' ? collection.find(params.id) : undefined
      if (!current) return notFound()
      const code = usedBy(options.field, current.id)
      if (code) {
        return forbidden(`${code} uses ${current.name}; make it inactive instead.`)
      }
      collection.remove(current.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

/** Settings → Types and Categories. */
export function loanSettingsHandlers(usedBy: UsedBy): HttpHandler[] {
  return [
    ...crud(
      {
        suffix: '/types',
        idPrefix: 'lt',
        noun: 'type',
        field: 'typeId',
        collection: loanTypes,
        schema: typeSchema,
        build: (input, id, createdAt): StoredLoanType => ({
          ...input,
          name: input.name.trim(),
          id,
          createdAt,
        }),
      },
      usedBy,
    ),
    ...crud(
      {
        suffix: '/categories',
        idPrefix: 'lc',
        noun: 'category',
        field: 'categoryId',
        collection: loanCategories,
        schema: categorySchema,
        build: (input, id, createdAt): StoredLoanCategory => ({
          ...input,
          name: input.name.trim(),
          id,
          createdAt,
        }),
      },
      usedBy,
    ),
  ]
}
