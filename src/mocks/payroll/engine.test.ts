import { describe, expect, it } from 'vitest'

import { payrolls, payslips, taxStructures } from './db'
import { annualTax, ensurePayrollRuns, withTotals } from './engine'
import { evaluate, ExpressionError, expressionProblem } from './expression'
import { lastMonth, thisMonth } from './seed'

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
  it('charges the slab’s fixed amount plus its rate on the excess', () => {
    const current = taxStructures.find('ts_current')
    expect(annualTax(500_000, current)).toBe(0)
    // 600,001–1,200,000: 1% of the amount over 600,000.
    expect(annualTax(1_200_000, current)).toBe(6_000)
    // 1,200,001–2,200,000: 6,000 + 11% over 1,200,000.
    expect(annualTax(2_000_000, current)).toBe(94_000)
  })
})

describe('seeded runs', () => {
  it('works out pay slips for every payroll and month', () => {
    ensurePayrollRuns()
    const headOffice = payrolls.find('pr_6')
    expect(headOffice?.employeeIds.length).toBeGreaterThan(3)
    const current = payslips
      .all()
      .filter((slip) => slip.payrollId === 'pr_6' && slip.month === thisMonth())
    const previous = payslips
      .all()
      .filter((slip) => slip.payrollId === 'pr_6' && slip.month === lastMonth())
    expect(current).toHaveLength(headOffice?.employeeIds.length ?? 0)
    expect(previous.every((slip) => slip.status === 'released')).toBe(true)
    expect(current.some((slip) => slip.status === 'on-hold')).toBe(true)

    const slip = current[0]
    if (!slip) throw new Error('no pay slip')
    const gross = slip.items.find((item) => item.payItemId === 'pi_gross_salary')?.value ?? 0
    expect(gross).toBe(slip.salary)
    expect(slip.items.find((item) => item.payItemId === 'pi_pf')?.employerContribution).toBe(
      Math.round(gross * 0.05),
    )
    expect(withTotals(slip).netPayable).toBe(slip.earnings - slip.deductions + slip.reimbursements)
    expect(payrolls.find('pr_8')?.errors[0]?.message).toBe(
      'Unsupported Operand Types String * Float',
    )
  })
})
