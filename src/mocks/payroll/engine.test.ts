import { describe, expect, it } from 'vitest'

import { payrolls, taxStructures } from './db'
import { annualTax, computePayslip } from './engine'
import { evaluate, ExpressionError, expressionProblem } from './expression'

describe('pay item expressions', () => {
  it('works out arithmetic with variables and brackets', () => {
    const vars = { gross_salary: 300_000, applicable_days: 30, absent_days: 2 }
    expect(evaluate('{gross_salary} / {applicable_days} * {absent_days}', vars)).toBe(20_000)
    expect(evaluate('({gross_salary} - 1000) * 5 / 100', vars)).toBe(14_950)
    expect(evaluate('{GROSS_SALARY} + -100', vars)).toBe(299_900)
    expect(evaluate('', vars)).toBe(0)
  })

  it('fails like the design when a value is not a number', () => {
    expect(() => evaluate('{commission} * 1.5', {})).toThrow(
      new ExpressionError('Unsupported Operand Types String * Float'),
    )
    expect(expressionProblem('{gross_salary} * (2')).toBe('A ( has no closing )')
    expect(expressionProblem('{gross_salary} * 2')).toBeNull()
  })
})

describe('tax slabs', () => {
  it('charges the slab’s fixed amount plus its rate on the excess, then the surcharge', () => {
    const base = taxStructures.find('tx_current')
    if (!base) throw new Error('no tax structure')
    const structure = {
      ...base,
      surchargeType: null,
      surchargeValue: null,
      slabs: [
        { minAmount: 0, maxAmount: 600_000, fixedAmount: 0, percentage: 0 },
        { minAmount: 600_000, maxAmount: 1_200_000, fixedAmount: 0, percentage: 1 },
        { minAmount: 1_200_000, maxAmount: null, fixedAmount: 6_000, percentage: 11 },
      ],
    }
    expect(annualTax(500_000, structure)).toBe(0)
    expect(annualTax(1_200_000, structure)).toBe(6_000)
    expect(annualTax(2_000_000, structure)).toBe(94_000)
    const surcharged = { ...structure, surchargeType: 'percentage' as const, surchargeValue: 10 }
    expect(annualTax(2_000_000, surcharged)).toBe(103_400)
  })
})

describe('seeded runs', () => {
  it('works out a payslip: salary, tax from the structure, and the totals', () => {
    const headOffice = payrolls.find('pr_6')
    if (!headOffice) throw new Error('no payroll')
    expect(headOffice.employeeIds.length).toBeGreaterThan(3)
    const employeeId = headOffice.employeeIds[0] ?? ''
    const slip = computePayslip(headOffice, employeeId)
    const salary = slip.lines.find((line) => line.systemCode === 'salary')?.amount ?? 0
    const tax = slip.lines.find((line) => line.systemCode === 'tax')?.amount ?? 0
    expect(salary).toBeGreaterThan(0)
    expect(tax).toBeCloseTo(annualTax(salary * 12, taxStructures.find('tx_current')) / 12, 1)
    expect(slip.netPayable).toBeCloseTo(salary - tax, 2)
    expect(slip.status).toBe('ready')
  })
})
