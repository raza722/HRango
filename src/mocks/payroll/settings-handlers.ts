import { http } from 'msw'
import { z } from 'zod'

import {
  ACCOUNT_CATEGORIES,
  BENEFIT_TYPES,
  CALCULATION_TYPES,
  INFO_TYPES,
  LEAVE_TYPES,
  PAY_ITEM_TYPES,
  type PayrollLookups,
  PAYSLIP_TEMPLATES,
  PRORATE_OPTIONS,
  ROUNDING_OPTIONS,
  SURCHARGE_CONDITIONS,
  SURCHARGE_RATES,
  TAX_DISTRIBUTIONS,
  VALUE_TYPES,
} from '@/features/payroll'

import type { MockCollection } from '../collection'
import { DIRECTORY } from '../employees/seed'
import { profileOf } from '../scheduling/seed'
import { branches } from '../settings/handlers'
import { createId, latency, requireAuth } from '../utils'
import {
  accountEntries,
  accountTypes,
  banks,
  benefits,
  currentPayrollSettings,
  formulas,
  incentives,
  payItems,
  payrolls,
  payrollSettingsStore,
  payRules,
  taxRebates,
  taxStructures,
} from './db'
import { employeeRef, timeSlots } from './engine'
import { expressionProblem } from './expression'
import {
  base,
  conflict,
  day,
  money,
  month,
  name,
  nextCode,
  notFound,
  now,
  ok,
  page,
  readBody,
  rejected,
  searched,
} from './http'

interface Resource<T extends { id: string }, I> {
  path: string
  noun: string
  collection: MockCollection<T>
  schema: z.ZodType<I>
  build: (input: I, existing: T | undefined) => T
  text: (item: T) => string
  /** The list row (adds names for ids). */
  row?: (item: T) => unknown
  /** A name that must be unique (case-insensitive). */
  uniqueName?: (item: T) => string
  /** Why the record cannot be deleted, if it is used. */
  inUse?: (item: T) => string | null
}

function crud<T extends { id: string }, I>(resource: Resource<T, I>) {
  const url = base(resource.path)
  const toRow = (item: T) => (resource.row ? resource.row(item) : item)
  const clash = (candidate: T) => {
    if (!resource.uniqueName) return false
    const wanted = resource.uniqueName(candidate).trim().toLowerCase()
    return resource.collection
      .all()
      .some(
        (item) =>
          item.id !== candidate.id && resource.uniqueName?.(item).trim().toLowerCase() === wanted,
      )
  }
  const duplicate = () =>
    conflict(`A ${resource.noun} with this name already exists`, 'DUPLICATE', {
      name: `A ${resource.noun} with this name already exists`,
    })

  return [
    http.get(url, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const query = new URL(request.url)
      return page(query, searched(query, resource.collection.all(), resource.text).map(toRow))
    }),
    http.get(`${url}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const item = resource.collection.find(String(params.id))
      return item ? ok(toRow(item)) : notFound(resource.noun)
    }),
    http.post(url, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const parsed = await readBody(request, resource.schema)
      if (!parsed.success) return rejected(parsed.error)
      const item = resource.build(parsed.data, undefined)
      if (clash(item)) return duplicate()
      resource.collection.insert(item)
      return ok(toRow(item))
    }),
    http.put(`${url}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const existing = resource.collection.find(String(params.id))
      if (!existing) return notFound(resource.noun)
      const parsed = await readBody(request, resource.schema)
      if (!parsed.success) return rejected(parsed.error)
      const item = resource.build(parsed.data, existing)
      if (clash(item)) return duplicate()
      resource.collection.update(existing.id, item)
      return ok(toRow(item))
    }),
    http.delete(`${url}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const existing = resource.collection.find(String(params.id))
      if (!existing) return notFound(resource.noun)
      const used = resource.inUse?.(existing)
      if (used) return conflict(used, 'IN_USE')
      resource.collection.remove(existing.id)
      return ok({ id: existing.id })
    }),
  ]
}

const expression = z
  .string()
  .trim()
  .max(500, 'Keep it under 500 characters')
  .refine((value) => value === '' || expressionProblem(value) === null, {
    message: 'The expression is not valid: use numbers, {variables}, + - * / and brackets',
  })
const requiredExpression = expression.refine((value) => value.length > 0, {
  message: 'Enter an expression',
})
const optionalId = z.string().min(1).nullable()

const usedBy = (count: number, what: string, noun: string) =>
  count > 0 ? `This ${noun} is used by ${count} ${what}${count === 1 ? '' : 's'}.` : null

// --- Pay Components ---------------------------------------------------------------------------

const payItemSchema = z
  .object({
    name,
    label: z.string().trim().max(80),
    taxDistribution: z.enum(TAX_DISTRIBUTIONS),
    type: z.enum(PAY_ITEM_TYPES, { error: 'Choose the pay item type' }),
    calculationType: z.enum(CALCULATION_TYPES, { error: 'Choose the calculation type' }),
    expression,
    employeeFormulaId: optionalId,
    employerContribution: z.boolean(),
    employerFormulaId: optionalId,
    displayOnly: z.boolean(),
    benefit: z.boolean(),
    eligibilityCriteria: z.boolean(),
    isAdvancePayment: z.boolean(),
  })
  .refine(
    (value) => value.calculationType === 'manual' || value.expression || value.employeeFormulaId,
    {
      message: 'A fixed pay item needs an expression or an employee formula',
      path: ['expression'],
    },
  )
  .refine((value) => !value.employerContribution || value.employerFormulaId, {
    message: 'Choose the employer contribution formula',
    path: ['employerFormulaId'],
  })

const payItemResource = crud({
  path: '/pay-items',
  noun: 'pay item',
  collection: payItems,
  schema: payItemSchema,
  build: (input, existing) => ({
    id: existing?.id ?? createId('pi'),
    createdAt: existing?.createdAt ?? now(),
    ...input,
    label: input.label || input.name,
  }),
  text: (item) => `${item.name} ${item.expression}`,
  uniqueName: (item) => item.name,
  inUse: (item) =>
    usedBy(
      payrolls.all().filter((payroll) => payroll.payItems.some((row) => row.payItemId === item.id))
        .length,
      'payroll',
      'pay item',
    ),
})

const formulaResource = crud({
  path: '/formulas',
  noun: 'formula',
  collection: formulas,
  schema: z.object({
    name,
    expression: requiredExpression,
    isSalaryDivision: z.boolean(),
    forIntegration: z.boolean(),
    isCustom: z.boolean(),
    description: z.string().trim().max(500),
  }),
  build: (input, existing) => ({ id: existing?.id ?? createId('f'), ...input }),
  text: (item) => `${item.name} ${item.expression}`,
  uniqueName: (item) => item.name,
  inUse: (item) =>
    usedBy(
      payItems
        .all()
        .filter(
          (entry) => entry.employeeFormulaId === item.id || entry.employerFormulaId === item.id,
        ).length,
      'pay item',
      'formula',
    ),
})

const ruleResource = crud({
  path: '/rules',
  noun: 'rule',
  collection: payRules,
  schema: z.object({ name, expression: requiredExpression, isCustom: z.boolean() }),
  build: (input, existing) => ({ id: existing?.id ?? createId('r'), ...input }),
  text: (item) => `${item.name} ${item.expression}`,
  uniqueName: (item) => item.name,
})

// --- Account Type, Disbursement Banks --------------------------------------------------------

const accountTypeResource = crud({
  path: '/account-types',
  noun: 'account type',
  collection: accountTypes,
  schema: z.object({
    category: z.enum(ACCOUNT_CATEGORIES, { error: 'Choose the account category' }),
    name: z.string().trim().max(80),
  }),
  build: (input, existing) => ({
    id: existing?.id ?? createId('at'),
    category: input.category,
    name: input.name || 'Custom Pay Item',
  }),
  text: (item) => `${item.category} ${item.name}`,
  uniqueName: (item) => `${item.category}|${item.name}`,
  inUse: (item) =>
    usedBy(
      accountEntries.all().filter((entry) => entry.accountTypeId === item.id).length,
      'employee account entry',
      'account type',
    ),
})

const required = (label: string) => z.string().trim().min(1, `Enter the ${label}`).max(120)

const bankResource = crud({
  path: '/banks',
  noun: 'bank',
  collection: banks,
  schema: z.object({
    accountHolder: required('account holder'),
    accountNumber: required('account number'),
    bankName: required('bank name'),
    branchName: required('branch name'),
    branchCode: required('branch code'),
    branchLocation: z.string().trim().max(120),
    bankCode: z.string().trim().max(40),
    taxPayerId: z.string().trim().max(40),
    effectiveDate: day,
  }),
  build: (input, existing) => ({ id: existing?.id ?? createId('bank'), ...input }),
  text: (item) => `${item.bankName} ${item.branchName} ${item.branchCode}`,
  inUse: (item) =>
    usedBy(
      payrolls.all().filter((payroll) => payroll.companyBankId === item.id).length,
      'payroll',
      'bank',
    ),
})

// --- Tax ----------------------------------------------------------------------------------------

const slabSchema = z.object({
  id: z.string().min(1),
  min: money,
  max: money.nullable(),
  fixedAmount: money,
  percentage: z.number().min(0, 'Use 0 to 100').max(100, 'Use 0 to 100'),
})

const taxStructureResource = crud({
  path: '/tax-structures',
  noun: 'tax structure',
  collection: taxStructures,
  schema: z
    .object({
      name,
      startDate: day,
      endDate: day,
      surcharge: z.boolean(),
      surchargeRule: z
        .object({
          value: money,
          rate: z.enum(SURCHARGE_RATES, { error: 'Choose the rate' }),
          condition: z.enum(SURCHARGE_CONDITIONS, { error: 'Choose the condition' }),
          amount: money,
        })
        .nullable(),
      description: z.string().trim().max(500),
      slabs: z.array(slabSchema).max(30),
    })
    .refine((value) => value.endDate >= value.startDate, {
      message: 'The end date must be on or after the start date',
      path: ['endDate'],
    })
    .refine((value) => !value.surcharge || value.surchargeRule, {
      message: 'Fill in the surcharge',
      path: ['surchargeRule'],
    })
    .refine((value) => value.slabs.every((slab) => slab.max === null || slab.max >= slab.min), {
      message: 'A slab’s maximum must be at least its minimum',
      path: ['slabs'],
    }),
  build: (input, existing) => ({
    id: existing?.id ?? createId('ts'),
    code:
      existing?.code ??
      nextCode(
        'TS-',
        taxStructures.all().map((item) => item.code),
        4,
      ),
    ...input,
    surchargeRule: input.surcharge ? input.surchargeRule : null,
    slabs: [...input.slabs].sort((a, b) => a.min - b.min),
  }),
  text: (item) => `${item.code} ${item.name}`,
  uniqueName: (item) => item.name,
  inUse: (item) =>
    usedBy(
      payrolls.all().filter((payroll) => payroll.taxStructureId === item.id).length,
      'payroll',
      'tax structure',
    ),
})

const taxRebateResource = crud({
  path: '/tax-rebates',
  noun: 'tax rebate',
  collection: taxRebates,
  schema: z.object({
    employeeId: z.string().min(1, 'Choose the employee'),
    date: day,
    amount: money.refine((value) => value > 0, { message: 'Enter an amount' }),
    attachmentName: z.string().max(200).nullable(),
  }),
  build: (input, existing) => ({ id: existing?.id ?? createId('rb'), ...input }),
  text: (item) => employeeRef(item.employeeId).name,
  row: (item) => ({ ...item, employee: employeeRef(item.employeeId) }),
})

// --- Rewards --------------------------------------------------------------------------------------

const benefitResource = crud({
  path: '/benefits',
  noun: 'benefit',
  collection: benefits,
  schema: z
    .object({
      name,
      type: z.enum(BENEFIT_TYPES, { error: 'Choose the type' }),
      payItemId: z.string().min(1, 'Choose the pay item'),
      group: z.boolean(),
      accumulative: z.boolean(),
      description: z.string().trim().max(500),
      additionalInfo: z
        .array(
          z.object({
            id: z.string().min(1),
            name,
            type: z.enum(INFO_TYPES),
            required: z.boolean(),
            min: z.number().nullable(),
            max: z.number().nullable(),
          }),
        )
        .max(30),
      members: z
        .array(z.object({ id: z.string().min(1), name, formulaId: z.string().min(1).nullable() }))
        .max(100),
    })
    .refine((value) => !value.group || value.members.length > 0, {
      message: 'Add at least one member to a group benefit',
      path: ['members'],
    }),
  build: (input, existing) => ({
    id: existing?.id ?? createId('bn'),
    code:
      existing?.code ??
      nextCode(
        'BN-',
        benefits.all().map((item) => item.code),
        4,
      ),
    ...input,
    members: input.group ? input.members : [],
  }),
  text: (item) => `${item.code} ${item.name} ${item.description}`,
  uniqueName: (item) => item.name,
})

const incentiveResource = crud({
  path: '/incentives',
  noun: 'incentive',
  collection: incentives,
  schema: z.object({
    branchId: z.string().min(1, 'Choose the branch'),
    month,
    incentiveType: z.enum(BENEFIT_TYPES, { error: 'Choose the incentive type' }),
    amount: money.refine((value) => value > 0, { message: 'Enter the target amount' }),
    valueType: z.enum(VALUE_TYPES),
    value: money.refine((value) => value > 0, { message: 'Enter the value' }),
  }),
  build: (input, existing) => ({
    id: existing?.id ?? createId('inc'),
    code:
      existing?.code ??
      nextCode(
        'INC-',
        incentives.all().map((item) => item.code),
        4,
      ),
    ...input,
  }),
  text: (item) => `${item.code} ${branches.find(item.branchId)?.name ?? ''}`,
  row: (item) => ({ ...item, branchName: branches.find(item.branchId)?.name ?? '—' }),
})

// --- General ---------------------------------------------------------------------------------------

const nullableEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullable()

const settingsSchema = z.object({
  configuration: z.object({
    excludeFinalSettlement: z.boolean(),
    disableTaxDistributionOnFinalSettlement: z.boolean(),
    doNotDisplayPayslipAfterRun: nullableEnum(ROUNDING_OPTIONS),
    applySalaryRevisionOnFixedDays: z.boolean(),
    applySalaryRevisionOnShiftDays: z.boolean(),
    disableSalaryRevisionEmail: z.boolean(),
    applyCutOffDatesForProration: z.boolean(),
    hideAttendanceSummaryInPayslip: z.boolean(),
    showSalaryBreakdownOnPayslip: z.boolean(),
    mainColorForPayslip: z.boolean(),
    roundOffTaxAmount: nullableEnum(ROUNDING_OPTIONS),
    displayTaxOnlyForPositive: z.boolean(),
    notesInEnglish: z.string().max(1000),
    notesInOtherLanguage: z.string().max(1000),
    printSignatureOnSalarySheet: z.boolean(),
    sendPayrollCloseEmail: z.boolean(),
    payslipTemplate: nullableEnum(PAYSLIP_TEMPLATES),
    prorateMonthly: nullableEnum(PRORATE_OPTIONS),
    showOnHoldOnSalarySheet: z.boolean(),
    prorateMonthlyByShift: z.boolean(),
    useShiftHoursForPolicies: z.boolean(),
    displayEmployeePayItemsOnPayslip: z.boolean(),
  }),
  leave: z.object({
    cplLeaveType: nullableEnum(LEAVE_TYPES),
    maximumEarnedCpl: z.number().int().min(0).max(365).nullable(),
    deductionOrder: z.object({ casual: z.boolean(), sick: z.boolean() }),
    fiscalYear: z.enum(['calendar', 'fiscal']),
    yearStartMonth: z.number().int().min(1).max(12),
    yearEndMonth: z.number().int().min(1).max(12),
  }),
})

const generalHandlers = [
  http.get(base('/settings'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return ok(currentPayrollSettings())
  }),
  http.put(base('/settings'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, settingsSchema)
    if (!parsed.success) return rejected(parsed.error)
    payrollSettingsStore.update('settings', { id: 'settings', ...parsed.data })
    return ok(currentPayrollSettings())
  }),
]

// --- Lookups ---------------------------------------------------------------------------------------

const lookupHandlers = [
  http.get(base('/lookups'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const lookups: PayrollLookups = {
      employees: DIRECTORY.map((employee) => ({
        ...employeeRef(employee.id),
        status: profileOf(employee).status === 'active' ? 'active' : 'inactive',
        branchId: employee.branchId,
      })),
      branches: branches.all().map((branch) => ({ id: branch.id, name: branch.name })),
      departments: [...new Set(DIRECTORY.map((employee) => employee.department))].sort(),
      payrolls: payrolls
        .all()
        .map((payroll) => ({ id: payroll.id, name: payroll.name, month: payroll.month })),
      payItems: payItems.all().map((item) => ({ id: item.id, name: item.name, type: item.type })),
      formulas: formulas.all().map((item) => ({ id: item.id, name: item.name })),
      taxStructures: taxStructures.all().map((item) => ({ id: item.id, name: item.name })),
      banks: banks
        .all()
        .map((item) => ({ id: item.id, name: `${item.bankName} (${item.branchName})` })),
      accountTypes: accountTypes
        .all()
        .map((item) => ({ id: item.id, name: item.name, category: item.category })),
      timeSlots: timeSlots(),
    }
    return ok(lookups)
  }),
]

export const payrollSettingsHandlers = [
  ...generalHandlers,
  ...lookupHandlers,
  ...payItemResource,
  ...formulaResource,
  ...ruleResource,
  ...accountTypeResource,
  ...bankResource,
  ...taxStructureResource,
  ...taxRebateResource,
  ...benefitResource,
  ...incentiveResource,
]
