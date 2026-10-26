import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { payslips } from '@/mocks/payroll/db'
import { renderApp } from '@/test/test-utils'

import { amountInWords, formatMonth, formatRs } from './utils/format'

const MONTH = formatMonth(format(new Date(), 'yyyy-MM'))

async function openAction(user: UserEvent, label: string, action: string) {
  await user.click(await screen.findByRole('button', { name: label }, { timeout: 4000 }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

async function confirmYes(user: UserEvent) {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

/** The seeded Head Office payslip of a person (worked out on the first request). */
const slipOf = (employeeId: string) => {
  const slip = payslips.find(`ps_pr_6_${employeeId}`)
  if (!slip) throw new Error(`no pay slip for ${employeeId}`)
  return slip
}

describe('Pay Slips', () => {
  it('shows My Employee Accounts and only the signed-in person’s slips', async () => {
    renderApp('/payroll/pay-slips/my')

    expect(await screen.findByRole('heading', { name: 'Pay Slips', level: 1 })).toBeVisible()
    const accounts = screen.getByRole('table', { name: 'Employee Accounts' })
    expect(await within(accounts).findByText('Outstanding Loan')).toBeVisible()
    expect(within(accounts).getByText('Advance Payments')).toBeVisible()
    const menus = await screen.findAllByRole('button', { name: /^Actions for / })
    expect(menus.length).toBeGreaterThan(0)
    expect(menus.every((menu) => menu.getAttribute('aria-label')?.includes('Shelley Kannes'))).toBe(
      true,
    )
  })

  it('puts a slip on hold, releases the hold, marks it paid and recalculates another', async () => {
    const { user } = renderApp('/payroll/pay-slips/all')

    await openAction(user, `Actions for Ayesha Malik, ${MONTH}`, 'On Hold')
    await confirmYes(user)
    await waitFor(() => {
      expect(slipOf('em_ayesha').status).toBe('on_hold')
    })

    await openAction(user, `Actions for Ayesha Malik, ${MONTH}`, 'Release Hold')
    await confirmYes(user)
    await waitFor(() => {
      expect(slipOf('em_ayesha').status).toBe('ready')
    })

    await openAction(user, `Actions for Ayesha Malik, ${MONTH}`, 'Mark Paid')
    await confirmYes(user)
    await waitFor(() => {
      expect(slipOf('em_ayesha')).toMatchObject({ status: 'released' })
    })
    expect(slipOf('em_ayesha').paidAt).not.toBeNull()

    await openAction(user, `Actions for Dr Hamda Shafeeq, ${MONTH}`, 'Recalculate')
    await confirmYes(user)
    expect((await screen.findAllByText('Pay slip recalculated')).length).toBeGreaterThan(0)
  })

  it('edits a value, which the API marks Manually Updated and keeps in History', async () => {
    const { user } = renderApp('/payroll/pay-slips/all')

    await openAction(user, `Actions for Dr Hamda Shafeeq, ${MONTH}`, 'Edit')
    const dialog = await screen.findByRole('dialog', { name: /^Edit pay slip of Dr Hamda Shafeeq/ })
    const salary = within(dialog).getByRole('textbox', { name: 'Gross Salary value' })
    await user.clear(salary)
    await user.type(salary, '500000')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Pay slip updated')).toBeInTheDocument()

    await waitFor(() => {
      const line = slipOf('em_hamda').lines.find((entry) => entry.systemCode === 'salary')
      expect(line).toMatchObject({ amount: 500000, isManuallyUpdated: true })
    })

    await openAction(user, `Actions for Dr Hamda Shafeeq, ${MONTH}`, 'View')
    const view = await screen.findByRole('dialog', { name: /^Pay slip of Dr Hamda Shafeeq/ })
    expect(
      within(view).getByRole('checkbox', { name: 'Gross Salary manually updated' }),
    ).toBeChecked()
    await user.click(within(view).getByRole('button', { name: 'History of Gross Salary' }))
    const history = await screen.findByRole('dialog', { name: 'History: Gross Salary' })
    expect(await within(history).findByRole('cell', { name: '500000' })).toBeVisible()
    expect(within(history).getByRole('cell', { name: 'update' })).toBeVisible()
  })

  it('shows the pay slip document with the net pay in words', async () => {
    const { user } = renderApp('/payroll/pay-slips/all')

    await openAction(user, `Actions for Ayesha Malik, ${MONTH}`, 'Payslip')
    const document = await screen.findByRole('article', { name: 'Payslip of Ayesha Malik' })
    const slip = slipOf('em_ayesha')
    expect(within(document).getByText('Employee Info')).toBeVisible()
    expect(within(document).getByText(`Rs ${amountInWords(slip.netPayable ?? 0)}`)).toBeVisible()
    expect(within(document).getAllByText(formatRs(slip.netPayable ?? 0)).length).toBeGreaterThan(0)
  })
})

describe('Salary Sheet', () => {
  it('lists the payroll’s people with a Total line', async () => {
    renderApp('/payroll/salary-sheet?payrollId=pr_6')

    const table = await screen.findByRole('table', { name: /^Salary Sheet, Head Office/ })
    const slips = payslips.all().filter((slip) => slip.payrollId === 'pr_6')
    const net = slips.reduce((sum, slip) => sum + (slip.netPayable ?? 0), 0)
    expect(within(table).getAllByRole('row')).toHaveLength(slips.length + 3)
    const total = within(table).getByRole('row', { name: /^Total/ })
    expect(within(total).getAllByText(formatRs(net)).length).toBeGreaterThan(0)
  })
})
