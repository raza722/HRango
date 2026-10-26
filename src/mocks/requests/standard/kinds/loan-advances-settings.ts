import { http, type HttpHandler, HttpResponse } from 'msw'
import { z } from 'zod'

import type {
  LoanCategory,
  LoanType,
} from '@/features/requests/standard/kinds/loan-advances/loan-advances.types'
import type { ApiItem, Paginated } from '@/types/api'

import { createMockCollection, type MockCollection } from '../../../collection'
import { formulas, payItems } from '../../../payroll/db'
import {
  apiPath,
  createId,
  errorResponse,
  latency,
  paginate,
  readPageParams,
  requireAuth,
} from '../../../utils'
import { invalid, notFound, now } from '../../http'

/*
 * Loan & Advance Settings on the Loans module's routes (backend/app/routers/loans.py):
 *   GET/POST /loans/types           ?q&isActive&page&pageSize      LoanTypeIn / LoanTypeOut
 *   GET/PUT/DELETE /loans/types/:id (PUT with rowVersion, DELETE ?rowVersion)
 *   GET/POST /loans/categories, GET/PUT/DELETE /loans/categories/:id
 * Repayment (`/loans/installments`) and the totals (`/loans/summary`) are worked
 * out from the approved requests (see loan-advances.ts).
 */

/** The employment (contract) types the mock knows, as `/organisation/lookups/employment-types` names them. */
export const LOAN_EMPLOYMENT_TYPES = [
  { id: 'et_permanent', name: 'Permanent' },
  { id: 'et_contractual', name: 'Contractual' },
  { id: 'et_trainee', name: 'Management Trainee' },
  { id: 'et_daily', name: 'Daily Wager' },
] as const
export type LoanEmploymentTypeId = (typeof LOAN_EMPLOYMENT_TYPES)[number]['id']

export interface StoredLoanType {
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
  deductionPayItemId: string | null
  employmentTypeIds: string[]
  description: string | null
  createdAt: string
  updatedAt: string | null
}

export interface StoredLoanCategory {
  id: string
  name: string
  isActive: boolean
  description: string | null
  createdAt: string
  updatedAt: string | null
}

const created = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

function seedTypes(): StoredLoanType[] {
  const type = (
    id: string,
    name: string,
    terms: Omit<StoredLoanType, 'id' | 'name' | 'createdAt' | 'updatedAt' | 'description'> & {
      description?: string
    },
    daysAgo: number,
  ): StoredLoanType => ({
    id,
    name,
    description: null,
    ...terms,
    createdAt: created(daysAgo),
    updatedAt: null,
  })
  const terms = (
    guarantorRequired: boolean,
    minExperienceMonths: number,
    gapBetweenRequestsMonths: number | null,
    installments: number,
    employmentTypeIds: LoanEmploymentTypeId[],
    extra: Partial<Pick<StoredLoanType, 'isActive' | 'nonPayable' | 'deductionPayItemId'>> & {
      description?: string
    } = {},
  ) => ({
    isActive: true,
    guarantorRequired,
    nonPayable: false,
    minExperienceMonths,
    gapBetweenRequestsMonths,
    installments,
    gapBetweenInstallmentsMonths: 1,
    formulaId: 'f_salary',
    deductionPayItemId: 'pi_loan',
    employmentTypeIds,
    ...extra,
  })
  return [
    type(
      'lt_car',
      'Car Loan',
      terms(true, 24, 24, 36, ['et_permanent'], {
        description: 'For buying a car; repaid from salary over three years.',
      }),
      300,
    ),
    type('lt_bike', 'Bike Loan', terms(true, 6, 12, 12, ['et_permanent', 'et_contractual']), 310),
    type(
      'lt_laptop',
      'Laptop Advance',
      terms(false, 3, 12, 6, ['et_permanent', 'et_contractual', 'et_trainee']),
      320,
    ),
    type(
      'lt_salary',
      'Salary Advance',
      terms(false, 1, 2, 2, ['et_permanent', 'et_contractual', 'et_trainee', 'et_daily']),
      330,
    ),
    type(
      'lt_medical',
      'Medical Assistance',
      terms(false, 0, null, 1, ['et_permanent', 'et_contractual'], {
        nonPayable: true,
        deductionPayItemId: null,
        description: 'Paid by the company; not repaid.',
      }),
      340,
    ),
    type(
      'lt_house',
      'House Loan',
      terms(true, 60, 60, 60, ['et_permanent'], {
        isActive: false,
        description: 'Paused while the policy is reviewed.',
      }),
      350,
    ),
  ]
}

function seedCategories(): StoredLoanCategory[] {
  const category = (
    id: string,
    name: string,
    isActive: boolean,
    description: string,
    daysAgo: number,
  ): StoredLoanCategory => ({
    id,
    name,
    isActive,
    description,
    createdAt: created(daysAgo),
    updatedAt: null,
  })
  return [
    category('lc_personal', 'Personal', true, 'For the employee’s own needs.', 300),
    category('lc_emergency', 'Emergency', true, 'Medical or family emergencies.', 305),
    category('lc_education', 'Education', true, 'Courses, fees and study equipment.', 310),
    category('lc_business', 'Business', false, 'Work equipment the employee buys.', 315),
  ]
}

export const loanTypes = createMockCollection<StoredLoanType>({
  storageKey: 'hrms-mock-loans-types-v2',
  seed: seedTypes,
})

export const loanCategories = createMockCollection<StoredLoanCategory>({
  storageKey: 'hrms-mock-loans-categories-v2',
  seed: seedCategories,
})

/** Runs when the standard requests table is seeded again (a reset), so the settings follow. */
export function resetLoanSettings(): void {
  loanTypes.reset()
  loanCategories.reset()
}

const rowVersion = (item: { createdAt: string; updatedAt: string | null }) =>
  item.updatedAt ?? item.createdAt

/** `LoanTypeOut`. */
export function loanTypeOut(type: StoredLoanType): LoanType {
  return {
    id: type.id,
    name: type.name,
    isActive: type.isActive,
    guarantorRequired: type.guarantorRequired,
    nonPayable: type.nonPayable,
    minExperienceMonths: type.minExperienceMonths,
    gapBetweenRequestsMonths: type.gapBetweenRequestsMonths,
    installments: type.installments,
    gapBetweenInstallmentsMonths: type.gapBetweenInstallmentsMonths,
    formulaId: type.formulaId,
    formulaName: type.formulaId ? (formulas.find(type.formulaId)?.name ?? null) : null,
    deductionPayItemId: type.deductionPayItemId,
    deductionPayItemName: type.deductionPayItemId
      ? (payItems.find(type.deductionPayItemId)?.name ?? null)
      : null,
    description: type.description,
    employmentTypes: LOAN_EMPLOYMENT_TYPES.filter((item) =>
      type.employmentTypeIds.includes(item.id),
    ).map(({ id, name }) => ({ id, name })),
    createdAt: type.createdAt,
    updatedAt: type.updatedAt,
    rowVersion: rowVersion(type),
  }
}

/** `LoanCategoryOut`. */
export const loanCategoryOut = (category: StoredLoanCategory): LoanCategory => ({
  ...category,
  rowVersion: rowVersion(category),
})

// --- the endpoints ----------------------------------------------------------------------------------

const id = z.union([z.string(), z.number()]).transform(String)

const typeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isActive: z.boolean().default(true),
  guarantorRequired: z.boolean().default(false),
  nonPayable: z.boolean().default(false),
  minExperienceMonths: z.number().int().min(0),
  gapBetweenRequestsMonths: z.number().int().min(0).nullish(),
  installments: z.number().int().min(1).max(600),
  gapBetweenInstallmentsMonths: z.number().int().min(0).nullish(),
  formulaId: id.nullish(),
  deductionPayItemId: id.nullish(),
  employmentTypeIds: z.array(id).min(1),
  description: z.string().max(4000).nullish(),
  rowVersion: z.string().nullish(),
})
type TypeIn = z.infer<typeof typeSchema>

const categorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  isActive: z.boolean().default(true),
  description: z.string().max(4000).nullish(),
  rowVersion: z.string().nullish(),
})
type CategoryIn = z.infer<typeof categorySchema>

/** Which requests use a type or category (they cannot be deleted then). */
export type UsedBy = (field: 'loanTypeId' | 'loanCategoryId', id: string) => string | null

async function guard(request: Request) {
  await latency()
  return requireAuth(request)
}

const conflict = (message: string, code = 'CONFLICT') => errorResponse(409, message, { code })

function listOf<T extends { name: string; isActive: boolean; createdAt: string }, O>(
  url: URL,
  items: readonly T[],
  out: (item: T) => O,
) {
  const q = url.searchParams.get('q')?.trim().toLowerCase()
  const isActive = url.searchParams.get('isActive')
  const { page, pageSize } = readPageParams(url)
  const filtered = items
    .filter((item) => !q || item.name.toLowerCase().includes(q))
    .filter((item) => !isActive || String(item.isActive) === isActive)
    .sort((a, b) => a.name.localeCompare(b.name))
  const result = paginate(filtered, page, pageSize)
  return HttpResponse.json<Paginated<O>>({ ...result, data: result.data.map(out) })
}

/** CRUD for one settings list (types or categories). */
function crud<
  T extends {
    id: string
    name: string
    isActive: boolean
    createdAt: string
    updatedAt: string | null
  },
  I extends { name: string; rowVersion?: string | null | undefined },
>(
  options: {
    path: string
    idPrefix: string
    noun: string
    field: 'loanTypeId' | 'loanCategoryId'
    collection: MockCollection<T>
    schema: z.ZodType<I>
    build: (input: I, id: string, createdAt: string, updatedAt: string | null) => T
    check?: (input: I) => Response | null
    out: (item: T) => unknown
  },
  usedBy: UsedBy,
): HttpHandler[] {
  const { collection, noun } = options
  const path = (suffix = '') => apiPath(`/loans/${options.path}${suffix}`)
  const clash = (name: string, ignoreId: string | null) =>
    collection
      .all()
      .some((item) => item.id !== ignoreId && item.name.toLowerCase() === name.trim().toLowerCase())

  async function read(request: Request, ignoreId: string | null): Promise<Response | I> {
    const body: unknown = await request.json().catch(() => null)
    const parsed = options.schema.safeParse(body)
    if (!parsed.success) {
      return invalid(
        'Some fields are not valid.',
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      )
    }
    if (clash(parsed.data.name, ignoreId)) {
      return conflict(`A loan ${noun} with this name already exists.`, 'DUPLICATE')
    }
    return options.check?.(parsed.data) ?? parsed.data
  }

  const item = (value: T, status = 200) =>
    HttpResponse.json<ApiItem<unknown>>({ data: options.out(value) }, { status })

  return [
    http.get(path(), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      return listOf(new URL(request.url), collection.all(), options.out)
    }),
    http.get(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const found = collection.find(String(params.id))
      return found ? item(found) : notFound()
    }),
    http.post(path(), async ({ request }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const input = await read(request, null)
      if (input instanceof Response) return input
      const created = options.build(input, createId(options.idPrefix), now(), null)
      collection.insert(created)
      return item(created, 201)
    }),
    http.put(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const current = collection.find(String(params.id))
      if (!current) return notFound()
      const input = await read(request, current.id)
      if (input instanceof Response) return input
      if (input.rowVersion && input.rowVersion !== rowVersion(current)) {
        return conflict('Someone else changed this record. Reload it and try again.')
      }
      const next = options.build(input, current.id, current.createdAt, now())
      collection.update(current.id, next)
      return item(next)
    }),
    http.delete(path('/:id'), async ({ request, params }) => {
      const unauthorized = await guard(request)
      if (unauthorized) return unauthorized
      const current = collection.find(String(params.id))
      if (!current) return notFound()
      const code = usedBy(options.field, current.id)
      if (code) {
        return conflict(`${code} uses ${current.name}; make it inactive instead.`, 'IN_USE')
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
        path: 'types',
        idPrefix: 'lt',
        noun: 'type',
        field: 'loanTypeId',
        collection: loanTypes,
        schema: typeSchema,
        check: (input: TypeIn) =>
          !input.nonPayable && !input.deductionPayItemId
            ? invalid('Choose the deduction pay item.', {
                deductionPayItemId: 'A payable type needs a deduction pay item.',
              })
            : null,
        build: (input: TypeIn, id, createdAt, updatedAt): StoredLoanType => ({
          id,
          name: input.name.trim(),
          isActive: input.isActive,
          guarantorRequired: input.guarantorRequired,
          nonPayable: input.nonPayable,
          minExperienceMonths: input.minExperienceMonths,
          gapBetweenRequestsMonths: input.gapBetweenRequestsMonths ?? null,
          installments: input.installments,
          gapBetweenInstallmentsMonths: input.gapBetweenInstallmentsMonths ?? null,
          formulaId: input.formulaId ?? null,
          deductionPayItemId: input.nonPayable ? null : (input.deductionPayItemId ?? null),
          employmentTypeIds: input.employmentTypeIds,
          description: input.description?.trim() ?? null,
          createdAt,
          updatedAt,
        }),
        out: loanTypeOut,
      },
      usedBy,
    ),
    ...crud(
      {
        path: 'categories',
        idPrefix: 'lc',
        noun: 'category',
        field: 'loanCategoryId',
        collection: loanCategories,
        schema: categorySchema,
        build: (input: CategoryIn, id, createdAt, updatedAt): StoredLoanCategory => ({
          id,
          name: input.name.trim(),
          isActive: input.isActive,
          description: input.description?.trim() ?? null,
          createdAt,
          updatedAt,
        }),
        out: loanCategoryOut,
      },
      usedBy,
    ),
  ]
}
