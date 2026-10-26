import { http, HttpResponse } from 'msw'
import { z } from 'zod'

import {
  ACCOUNT_CATEGORIES,
  BENEFIT_TYPES,
  CALCULATION_TYPES,
  type ExpressionCheck,
  type ExpressionVariable,
  INCENTIVE_TYPES,
  INFO_TYPES,
  PAY_ITEM_TYPES,
  PAYSLIP_TEMPLATES,
  REPORT_ROUNDING_OPTIONS,
  ROUNDING_OPTIONS,
  SURCHARGE_RATES,
  TAX_DISTRIBUTIONS,
  VALUE_TYPES,
} from '@/features/payroll'

import type { MockCollection } from '../collection'
import { mockFileUrl } from '../files/handlers'
import { branches } from '../settings/handlers'
import { createId, latency, requireAuth } from '../utils'
import { accountEntries, payrolls } from './db'
import {
  accountTypes,
  banks,
  benefits,
  currentPayrollSettings,
  formulas,
  incentives,
  payItems,
  payrollSettingsStore,
  payRules,
  taxRebates,
  taxStructures,
} from './db-settings'
import {
  base,
  conflict,
  day,
  invalid,
  nextCode,
  notFound,
  ok,
  page,
  readBody,
  rejected,
  searched,
} from './http'
import { payrollLookupHandlers } from './lookup-handlers'
import { nextRowVersion, personFields } from './people'
import { referenceOf } from './seed-settings'

// Payroll Settings as the API serves them (backend/app/routers/payroll_settings.py).

const nowStamp = () => new Date().toISOString().slice(0, 19)

interface Stamped {
  id: string
  createdAt: string
  updatedAt: string | null
  rowVersion: string
}

interface Resource<T extends Stamped, I extends { rowVersion?: string | null | undefined }> {
  path: string
  noun: string
  collection: MockCollection<T>
  schema: z.ZodType<I>
  /** The stored record from the body (stamps are added here). */
  build: (
    input: I,
    existing: T | undefined,
  ) => Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'rowVersion'> | Response
  /** Search text (`?q=`). */
  text: (item: T) => string
  /** Other query filters. */
  filter?: (item: T, url: URL) => boolean
  /** What lists show (detail-only parts left out). */
  listRow?: (item: T) => T
  /** A name that must be unique (case-insensitive). */
  uniqueName?: (item: T) => string
  /** Why the record cannot be deleted, if it is used or a system record. */
  inUse?: (item: T) => string | null
  idPrefix: string
}

function crud<T extends Stamped, I extends { rowVersion?: string | null | undefined }>(
  resource: Resource<T, I>,
) {
  const url = base(resource.path)
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
  const stale = () =>
    conflict(`Someone else changed this ${resource.noun}. Reload it and try again`, 'CONFLICT')

  return [
    http.get(url, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const query = new URL(request.url)
      const rows = searched(query, resource.collection.all(), resource.text)
        .filter((item) => resource.filter?.(item, query) ?? true)
        .map((item) => (resource.listRow ? resource.listRow(item) : item))
      return page(query, rows)
    }),
    http.get(`${url}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const item = resource.collection.find(String(params.id))
      return item ? ok(item) : notFound(resource.noun)
    }),
    http.post(url, async ({ request }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const parsed = await readBody(request, resource.schema)
      if (!parsed.success) return rejected(parsed.error)
      const built = resource.build(parsed.data, undefined)
      if (built instanceof Response) return built
      const item = {
        ...built,
        id: createId(resource.idPrefix),
        createdAt: nowStamp(),
        updatedAt: null,
        rowVersion: nextRowVersion(),
      } as T
      if (clash(item)) return duplicate()
      resource.collection.insert(item)
      return HttpResponse.json({ data: item }, { status: 201 })
    }),
    http.put(`${url}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const existing = resource.collection.find(String(params.id))
      if (!existing) return notFound(resource.noun)
      const parsed = await readBody(request, resource.schema)
      if (!parsed.success) return rejected(parsed.error)
      if (parsed.data.rowVersion && parsed.data.rowVersion !== existing.rowVersion) return stale()
      const built = resource.build(parsed.data, existing)
      if (built instanceof Response) return built
      const item = {
        ...built,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowStamp(),
        rowVersion: nextRowVersion(),
      } as T
      if (clash(item)) return duplicate()
      resource.collection.update(existing.id, item)
      return ok(item)
    }),
    http.delete(`${url}/:id`, async ({ request, params }) => {
      await latency()
      const unauthorized = requireAuth(request)
      if (unauthorized) return unauthorized
      const existing = resource.collection.find(String(params.id))
      if (!existing) return notFound(resource.noun)
      const version = new URL(request.url).searchParams.get('rowVersion')
      if (version && version !== existing.rowVersion) return stale()
      const used = resource.inUse?.(existing)
      if (used) return conflict(used, 'IN_USE')
      resource.collection.remove(existing.id)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}

const rowVersion = z.string().nullish()
const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`)
const required = (label: string, max: number) => text(max).min(1, `Enter the ${label}`)
const optionalText = (max: number) =>
  text(max)
    .nullish()
    .transform((value) => (value === '' || value === undefined ? null : value))
const id = z.coerce.string().min(1)
const optionalId = z.coerce
  .string()
  .min(1)
  .nullish()
  .transform((value) => value ?? null)
const amount = z.number({ error: 'Enter an amount' }).min(0, 'The amount cannot be negative')

const usedBy = (count: number, what: string, noun: string) =>
  count > 0 ? `This ${noun} is used by ${count} ${what}${count === 1 ? '' : 's'}.` : null

// --- expressions ------------------------------------------------------------------------------

const VARIABLES: [string, string][] = [
  ['gross_salary', 'Monthly salary from the latest salary revision'],
  ['month_days', 'Calendar days in the payroll month'],
  ['applicable_days', "Days the month is paid on: actual days, or the payroll's fixed days"],
  ['employed_days', 'Days of the month the person was employed (joining and leaving prorate)'],
  ['worked_days', 'Employed days less absences, half days (as half) and unpaid leave'],
  ['present_days', 'Days marked present, work from home or official visit'],
  ['absent_days', 'Days marked absent'],
  ['half_days', 'Days marked half day'],
  ['short_days', 'Days marked short day'],
  ['holiday_days', 'Holidays, weekends and rest days'],
  ['leave_days', 'Approved leave days in the month'],
  ['unpaid_leave_days', 'Approved leave days of deductible leave types'],
  ['late_days', 'Days with a late arrival'],
  ['late_minutes', 'Minutes late, all month'],
  ['early_left_days', 'Days left early'],
  ['early_left_minutes', 'Minutes left early, all month'],
  ['short_minutes', 'Late plus early-left minutes'],
  ['overtime_minutes', 'Overtime minutes from the time sheet'],
  ['worked_minutes', 'Minutes worked, all month'],
  ['expected_minutes', 'Minutes the shifts expected, all month'],
  ['day_minutes', "Minutes in a working day (the shift's, or 480)"],
  ['penalty_days', 'Warning penalties as days (100% = 1 day)'],
  ['loan_installment', 'Loan installments due this month'],
  ['leave_encashment', 'Leave encashment paid through this payroll'],
  ['service_months', 'Whole months since joining'],
  ['branch_id', "The person's branch id"],
  ['department_id', "The person's department id"],
  ['designation_id', "The person's designation id"],
  ['grade_id', "The person's grade id"],
  ['employment_type_id', "The person's employment type id"],
  ['employee_group_id', "The person's employee group id"],
  ['location_id', "The person's location id"],
]

function variables(): ExpressionVariable[] {
  return [
    ...VARIABLES.map(([name, description]) => ({
      name,
      reference: `{${name}}`,
      kind: 'variable',
      description,
    })),
    ...payItems.all().map((item) => ({
      name: item.reference.slice(1, -1),
      reference: item.reference,
      kind: 'pay_item',
      description: item.label ?? item.name,
    })),
    ...formulas.all().map((item) => ({
      name: item.reference.slice(1, -1),
      reference: item.reference,
      kind: 'formula',
      description: item.name,
    })),
  ]
}

/**
 * A light syntax check (the API's parser is stricter): known characters, functions the API
 * allows (if, min, max, round, floor, ceil, abs, and, or, not) and balanced brackets.
 */
function syntaxProblem(expression: string): string | null {
  const bare = expression.replace(/\{[^}]+\}/g, '1')
  const words = bare.match(/[a-z_]+/gi) ?? []
  const allowed = new Set(['if', 'min', 'max', 'round', 'floor', 'ceil', 'abs', 'and', 'or', 'not'])
  const word = words.find((item) => !allowed.has(item.toLowerCase()))
  if (word) return `Unknown name "${word}": put references in braces.`
  if (/[^\d\s.+\-*/%()<>=!,a-z_]/i.test(bare))
    return 'The expression has a character it cannot use.'
  let depth = 0
  for (const char of bare) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (depth < 0) return 'A bracket is closed before it is opened.'
  }
  return depth === 0 ? null : 'A bracket is not closed.'
}

/** The API's check: syntax, then every `{reference}` must be a variable, pay item or formula. */
function checkExpression(expression: string): ExpressionCheck {
  const references = [...expression.matchAll(/\{([^}]+)\}/g)].map((match) => match[1] ?? '')
  const known = new Set(variables().map((item) => item.name))
  const unknown = references.find((name) => !known.has(name))
  if (unknown !== undefined) {
    return {
      valid: false,
      message: `{${unknown}} is not a variable, pay item or formula.`,
      references: [],
    }
  }
  const problem = syntaxProblem(expression)
  return problem
    ? { valid: false, message: problem, references: [] }
    : { valid: true, message: null, references: [...new Set(references)] }
}

const expressionError = (field: string, expression: string | null | undefined) => {
  if (!expression?.trim()) return null
  const check = checkExpression(expression)
  return check.valid
    ? null
    : invalid(check.message ?? 'The expression is not valid', {
        [field]: check.message ?? 'The expression is not valid',
      })
}

// --- Pay Components ---------------------------------------------------------------------------

const payItemSchema = z.object({
  name: required('name', 200),
  label: optionalText(200),
  itemType: z.enum(PAY_ITEM_TYPES, { error: 'Choose the pay item type' }),
  calculationType: z.enum(CALCULATION_TYPES, { error: 'Choose the calculation type' }),
  taxDistribution: z.enum(TAX_DISTRIBUTIONS),
  employeeFormulaId: optionalId,
  employerFormulaId: optionalId,
  isTaxable: z.boolean().default(false),
  isDisplayOnly: z.boolean().default(false),
  isBenefit: z.boolean().default(false),
  isAdvancePayment: z.boolean().default(false),
  eligibilityExpression: optionalText(2000),
  description: optionalText(2000),
  rowVersion,
})

const formulaOf = (formulaId: string | null) =>
  formulaId === null ? undefined : formulas.find(formulaId)

const payItemResource = crud({
  path: '/pay-items',
  noun: 'pay item',
  idPrefix: 'pi',
  collection: payItems,
  schema: payItemSchema,
  build: (input, existing) => {
    if (input.calculationType === 'formula' && input.employeeFormulaId === null) {
      return invalid('A formula pay item needs its formula.', {
        employeeFormulaId: 'A formula pay item needs its formula.',
      })
    }
    const failed = expressionError('eligibilityExpression', input.eligibilityExpression)
    if (failed) return failed
    const employee = formulaOf(input.employeeFormulaId)
    const employer = formulaOf(input.employerFormulaId)
    const { rowVersion: _rv, ...fields } = input
    return {
      ...fields,
      reference: referenceOf(input.name),
      employeeFormulaName: employee?.name ?? null,
      expression: employee?.expression ?? null,
      employerFormulaName: employer?.name ?? null,
      employerExpression: employer?.expression ?? null,
      systemCode: existing?.systemCode ?? null,
    }
  },
  text: (item) => `${item.name} ${item.label ?? ''}`,
  filter: (item, url) => {
    const type = url.searchParams.get('itemType')
    return !type || item.itemType === type
  },
  uniqueName: (item) => item.name,
  inUse: (item) =>
    item.systemCode
      ? 'This pay item was added by the system. It cannot be deleted'
      : usedBy(
          payrolls
            .all()
            .filter((payroll) => payroll.payItems.some((row) => row.payItemId === item.id)).length,
          'payroll',
          'pay item',
        ),
})

const formulaResource = crud({
  path: '/formulas',
  noun: 'formula',
  idPrefix: 'f',
  collection: formulas,
  schema: z.object({
    name: required('name', 200),
    expression: required('expression', 2000),
    isSalaryDivision: z.boolean().default(false),
    forIntegration: z.boolean().default(false),
    description: optionalText(2000),
    rowVersion,
  }),
  build: (input, existing) => {
    const failed = expressionError('expression', input.expression)
    if (failed) return failed
    const { rowVersion: _rv, ...fields } = input
    return { ...fields, reference: referenceOf(input.name), isCustom: existing?.isCustom ?? true }
  },
  text: (item) => `${item.name} ${item.expression}`,
  uniqueName: (item) => item.name,
  inUse: (item) =>
    !item.isCustom
      ? 'This formula was added by the system. It cannot be deleted'
      : usedBy(
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
  idPrefix: 'r',
  collection: payRules,
  schema: z.object({
    name: required('name', 200),
    expression: required('expression', 2000),
    accountTypeId: id,
    description: optionalText(2000),
    rowVersion,
  }),
  build: (input) => {
    const failed = expressionError('expression', input.expression)
    if (failed) return failed
    const account = accountTypes.find(input.accountTypeId)
    if (!account) {
      return invalid('Choose an account type', { accountTypeId: 'Choose an account type' })
    }
    const { rowVersion: _rv, ...fields } = input
    return { ...fields, accountTypeName: account.name, accountCategory: account.category }
  },
  text: (item) => `${item.name} ${item.expression}`,
  uniqueName: (item) => item.name,
})

// --- Account Type, Disbursement Banks --------------------------------------------------------

const accountTypeResource = crud({
  path: '/account-types',
  noun: 'account type',
  idPrefix: 'at',
  collection: accountTypes,
  schema: z.object({
    name: required('name', 200),
    category: z.enum(ACCOUNT_CATEGORIES, { error: 'Choose the account category' }),
    refId: optionalId,
    rowVersion,
  }),
  build: (input, existing) => {
    const refName =
      input.refId === null
        ? null
        : input.category === 'benefit'
          ? (benefits.find(input.refId)?.name ?? null)
          : input.category === 'custom_pay_item'
            ? (payItems.find(input.refId)?.name ?? null)
            : input.refId
    return {
      name: input.name,
      category: input.category,
      refId: input.refId,
      refName,
      code:
        existing?.code ??
        nextCode(
          'ACT-',
          accountTypes.all().map((item) => item.code),
          4,
        ),
    }
  },
  text: (item) => `${item.code} ${item.name}`,
  filter: (item, url) => {
    const category = url.searchParams.get('category')
    return !category || item.category === category
  },
  uniqueName: (item) => item.name,
  inUse: (item) =>
    usedBy(
      accountEntries.all().filter((entry) => entry.accountTypeId === item.id).length,
      'employee account entry',
      'account type',
    ) ??
    usedBy(
      payRules.all().filter((rule) => rule.accountTypeId === item.id).length,
      'rule',
      'account type',
    ),
})

const bankResource = crud({
  path: '/disbursement-banks',
  noun: 'disbursement bank',
  idPrefix: 'bank',
  collection: banks,
  schema: z.object({
    accountHolder: required('account holder', 200),
    accountNumber: required('account number', 50),
    bankName: required('bank name', 200),
    branchName: optionalText(200),
    branchCode: required('branch code', 30),
    branchLocation: required('branch location', 200),
    taxPayerId: required('tax payer ID', 30),
    effectiveDate: day.nullish().transform((value) => value ?? null),
    description: optionalText(2000),
    rowVersion,
  }),
  build: (input) => {
    const { rowVersion: _rv, ...fields } = input
    return fields
  },
  text: (item) => `${item.bankName} ${item.branchName ?? ''} ${item.accountNumber}`,
  uniqueName: (item) => item.accountNumber,
  inUse: (item) =>
    usedBy(
      payrolls.all().filter((payroll) => payroll.disbursementBankId === item.id).length,
      'payroll',
      'bank',
    ),
})

// --- Tax ----------------------------------------------------------------------------------------

const slabSchema = z.object({
  minAmount: amount,
  maxAmount: amount.nullable(),
  fixedAmount: amount.default(0),
  percentage: z.number().min(0, 'Use 0 to 100').max(100, 'Use 0 to 100').default(0),
})

const taxStructureResource = crud({
  path: '/tax-structures',
  noun: 'tax structure',
  idPrefix: 'tx',
  collection: taxStructures,
  schema: z.object({
    name: required('name', 200),
    startDate: day,
    endDate: day,
    surchargeType: z
      .enum(SURCHARGE_RATES)
      .nullish()
      .transform((value) => value ?? null),
    surchargeValue: amount.nullish().transform((value) => value ?? null),
    description: optionalText(2000),
    slabs: z.array(slabSchema).min(1, 'Add at least one slab').max(50),
    rowVersion,
  }),
  build: (input, existing) => {
    if (input.endDate < input.startDate) {
      return invalid('The end date is before the start date.', {
        endDate: 'The end date is before the start date.',
      })
    }
    if (input.surchargeType && input.surchargeValue === null) {
      return invalid('Give the surcharge.', { surchargeValue: 'Give the surcharge.' })
    }
    const slabs = [...input.slabs].sort((a, b) => a.minAmount - b.minAmount)
    for (const [index, slab] of slabs.entries()) {
      if (slab.maxAmount !== null && slab.maxAmount <= slab.minAmount) {
        return invalid('The maximum must be above the minimum.', {
          [`slabs.${index}.maxAmount`]: 'The maximum must be above the minimum.',
        })
      }
      const next = slabs[index + 1]
      if (next && (slab.maxAmount === null || slab.maxAmount > next.minAmount)) {
        return invalid('The slabs overlap.', { slabs: 'The slabs overlap.' })
      }
    }
    return {
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      surchargeType: input.surchargeType,
      surchargeValue: input.surchargeType ? input.surchargeValue : null,
      description: input.description,
      code:
        existing?.code ??
        nextCode(
          'TXS-',
          taxStructures.all().map((item) => item.code),
          4,
        ),
      slabCount: slabs.length,
      slabs: slabs.map((slab, index) => ({ ...slab, id: createId(`slab${index}`) })),
    }
  },
  text: (item) => `${item.code} ${item.name}`,
  // Lists leave the slabs out, as the API does.
  listRow: (item) => ({ ...item, slabs: [] }),
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
  idPrefix: 'rb',
  collection: taxRebates,
  schema: z.object({
    employeeId: id,
    rebateDate: day,
    amount: z.number({ error: 'Enter an amount' }).gt(0, 'Enter an amount'),
    fileId: optionalId,
    description: optionalText(2000),
    rowVersion,
  }),
  build: (input, existing) => {
    const person = personFields(input.employeeId)
    const sameFile = existing?.file?.id === input.fileId
    return {
      employeeId: input.employeeId,
      employeeCode: person.employeeCode,
      employeeName: person.employeeName,
      rebateDate: input.rebateDate,
      amount: input.amount,
      fileId: input.fileId,
      file:
        input.fileId === null
          ? null
          : sameFile && existing.file
            ? existing.file
            : { id: input.fileId, name: 'Attachment', url: mockFileUrl(input.fileId) },
      description: input.description,
    }
  },
  text: (item) => `${item.employeeName} ${item.employeeCode}`,
  filter: (item, url) => {
    const employeeId = url.searchParams.get('employeeId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    return (
      (!employeeId || item.employeeId === employeeId) &&
      (!from || item.rebateDate >= from) &&
      (!to || item.rebateDate <= to)
    )
  },
})

// --- Rewards --------------------------------------------------------------------------------------

const groupName = (groupId: string) => `Group ${groupId}`

const benefitResource = crud({
  path: '/benefits',
  noun: 'benefit',
  idPrefix: 'bn',
  collection: benefits,
  schema: z.object({
    name: required('name', 200),
    benefitType: z.enum(BENEFIT_TYPES, { error: 'Choose the type' }),
    payItemId: id,
    formulaId: optionalId,
    isGroup: z.boolean().default(false),
    isAccumulative: z.boolean().default(false),
    description: optionalText(2000),
    members: z
      .array(z.object({ employeeId: optionalId, employeeGroupId: optionalId }))
      .max(5000)
      .default([]),
    fields: z
      .array(
        z.object({
          name: required('name', 200),
          fieldType: z.enum(INFO_TYPES),
          isRequired: z.boolean().default(false),
          minValue: z
            .number()
            .nullish()
            .transform((value) => value ?? null),
          maxValue: z
            .number()
            .nullish()
            .transform((value) => value ?? null),
          minLength: z
            .number()
            .int()
            .min(0)
            .nullish()
            .transform((value) => value ?? null),
          maxLength: z
            .number()
            .int()
            .min(0)
            .nullish()
            .transform((value) => value ?? null),
          fieldValue: optionalText(2000),
        }),
      )
      .max(50)
      .default([]),
    rowVersion,
  }),
  build: (input) => {
    const item = payItems.find(input.payItemId)
    if (!item) return invalid('Choose the pay item', { payItemId: 'Choose the pay item' })
    if (input.isGroup && input.members.length === 0) {
      return invalid('Add at least one member to a group benefit', {
        members: 'Add at least one member to a group benefit',
      })
    }
    for (const [index, field] of input.fields.entries()) {
      const value = field.fieldValue ?? ''
      const fail = (message: string) =>
        invalid(message, { [`fields.${index}.fieldValue`]: message })
      if (value === '' && field.isRequired) return fail(`${field.name} is required.`)
      if (value !== '' && field.fieldType === 'number') {
        const number = Number(value)
        if (!Number.isFinite(number)) return fail(`${field.name} must be a number.`)
        if (
          (field.minValue !== null && number < field.minValue) ||
          (field.maxValue !== null && number > field.maxValue)
        ) {
          return fail(`${field.name} is outside the allowed range.`)
        }
      }
      if (
        value !== '' &&
        field.fieldType === 'string' &&
        ((field.minLength !== null && value.length < field.minLength) ||
          (field.maxLength !== null && value.length > field.maxLength))
      ) {
        return fail(`${field.name} is not the allowed length.`)
      }
    }
    const formula = input.formulaId ? formulas.find(input.formulaId) : undefined
    const members = input.isGroup
      ? input.members.map((member) => ({
          id: createId('bm'),
          employeeId: member.employeeId,
          employeeName: member.employeeId ? personFields(member.employeeId).employeeName : null,
          employeeGroupId: member.employeeGroupId,
          employeeGroupName: member.employeeGroupId ? groupName(member.employeeGroupId) : null,
        }))
      : []
    return {
      name: input.name,
      benefitType: input.benefitType,
      payItemId: input.payItemId,
      payItemName: item.name,
      formulaId: input.formulaId,
      formulaName: formula?.name ?? null,
      isGroup: input.isGroup,
      isAccumulative: input.isAccumulative,
      description: input.description,
      memberCount: members.length,
      members,
      fields: input.fields.map((field) => ({ ...field, id: createId('bf') })),
    }
  },
  text: (item) => `${item.name} ${item.description ?? ''}`,
  listRow: (item) => ({ ...item, members: [], fields: [] }),
  uniqueName: (item) => item.name,
})

const incentiveResource = crud({
  path: '/incentives',
  noun: 'incentive',
  idPrefix: 'inc',
  collection: incentives,
  schema: z.object({
    branchId: id,
    applicableMonth: day,
    incentiveType: z.enum(INCENTIVE_TYPES, { error: 'Choose the incentive type' }),
    targetAmount: amount,
    valueType: z.enum(VALUE_TYPES),
    rewardValue: amount,
    description: optionalText(2000),
    rowVersion,
  }),
  build: (input) => {
    if (input.valueType === 'percentage' && input.rewardValue > 100) {
      return invalid('A percentage cannot be above 100.', {
        rewardValue: 'A percentage cannot be above 100.',
      })
    }
    const { rowVersion: _rv, ...fields } = input
    return {
      ...fields,
      applicableMonth: `${input.applicableMonth.slice(0, 7)}-01`,
      branchName: branches.find(input.branchId)?.name ?? input.branchId,
    }
  },
  text: (item) => item.branchName,
  filter: (item, url) => {
    const branchId = url.searchParams.get('branchId')
    const month = url.searchParams.get('month')
    return (
      (!branchId || item.branchId === branchId) &&
      (!month || item.applicableMonth.slice(0, 7) === month.slice(0, 7))
    )
  },
})

// --- General ---------------------------------------------------------------------------------------

const rounding = z.enum(ROUNDING_OPTIONS)

const settingsSchema = z.object({
  excludeFinalSettlement: z.boolean(),
  disableTaxDistributionOnFinalSettlement: z.boolean(),
  hidePayslipAfterRun: z.boolean(),
  salaryReportRounding: z.enum(REPORT_ROUNDING_OPTIONS),
  revisionOnFixedDays: z.boolean(),
  revisionFixedDate: z
    .string()
    .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Use MM-DD')
    .nullable(),
  revisionOnShiftDays: z.boolean(),
  revisionShiftDays: z.number().int().min(1).max(3650).nullable(),
  disableRevisionEmail: z.boolean(),
  cutoffProration: z.boolean(),
  cutoffDay: z.number().int().min(1).max(28).nullable(),
  hideAttendanceSummary: z.boolean(),
  showSalaryBreakdown: z.boolean(),
  payslipColor: z.string().max(30).nullable(),
  taxRounding: rounding,
  taxPositiveOnly: z.boolean(),
  notesEnglishEnabled: z.boolean(),
  notesEnglish: z.string().max(1000).nullable(),
  notesOtherLanguage: z.string().max(1000).nullable(),
  printSignature: z.boolean(),
  sendCloseEmail: z.boolean(),
  payslipTemplate: z.enum(PAYSLIP_TEMPLATES),
  prorationRounding: rounding,
  showOnHoldAmounts: z.boolean(),
  useShiftHours: z.boolean(),
  showEmployeePayItems: z.boolean(),
  cplLeaveTypeId: z.coerce.string().nullable(),
  maxEarnedCpl: z.number().min(0).nullable(),
  deductCasualLeaves: z.boolean(),
  deductSickLeaves: z.boolean(),
  leaveYearBasis: z.enum(['calendar', 'fiscal']),
  fiscalYearStartMonth: z.number().int().min(1).max(12).nullable(),
  fiscalYearEndMonth: z.number().int().min(1).max(12).nullable(),
  rowVersion: z.string().nullable(),
})

const generalHandlers = [
  http.get(base('/settings/general'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return ok(currentPayrollSettings())
  }),
  http.put(base('/settings/general'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(request, settingsSchema)
    if (!parsed.success) return rejected(parsed.error)
    const current = currentPayrollSettings()
    if (current.rowVersion !== null && parsed.data.rowVersion !== current.rowVersion) {
      return conflict('Someone else changed the payroll settings. Reload them and try again')
    }
    payrollSettingsStore.update('settings', {
      id: 'settings',
      ...parsed.data,
      rowVersion: nextRowVersion(),
    })
    return ok(currentPayrollSettings())
  }),
  http.get(base('/settings/variables'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    return ok(variables())
  }),
  http.post(base('/settings/expressions/check'), async ({ request }) => {
    await latency()
    const unauthorized = requireAuth(request)
    if (unauthorized) return unauthorized
    const parsed = await readBody(
      request,
      z.object({
        expression: z.string().min(1).max(2000),
        kind: z.enum(['value', 'condition']).default('value'),
      }),
    )
    if (!parsed.success) return rejected(parsed.error)
    return ok(checkExpression(parsed.data.expression))
  }),
]

export const payrollSettingsHandlers = [
  // The pickers payroll screens read from other modules (handlers.ts registers only this array).
  ...payrollLookupHandlers,
  ...generalHandlers,
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
