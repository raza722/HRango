import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { finalSettlements, payslips } from '@/mocks/payroll/db'
import { ensurePayrollRuns } from '@/mocks/payroll/engine'
import { thisMonth } from '@/mocks/payroll/seed'
import { renderApp } from '@/test/test-utils'

import { amountInWords, formatMonth, formatRs } from './utils/format'

const MONTH = formatMonth(thisMonth())

async function openAction(user: UserEvent, label: string, action: string) {
  await user.click(await screen.findByRole('button', { name: label }, { timeout: 4000 }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

async function confirmYes(user: UserEvent) {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

const slipOf = (employeeId: string) => {
  ensurePayrollRuns()
  const slip = payslips.find(`ps_pr_6_${employeeId}_${thisMonth()}`)
  if (!slip) throw new Error(`no pay slip for ${employeeId}`)
  return slip
}

describe('Pay Slips', () => {
  it('shows My Employee Accounts and only the signed-in person’s slips', async () => {
    renderApp('/payroll/pay-slips/my')

    expect(await screen.findByRole('heading', { name: 'Pay Slips', level: 1 })).toBeVisible()
    const accounts = screen.getByRole('table', { name: 'Employee Accounts' })
    expect(await within(accounts).findByText('Rs 90,000')).toBeVisible()
    expect(within(accounts).getByText('Rs 6,660')).toBeVisible()
    expect(within(accounts).getByText('Rs 40,000')).toBeVisible()
    const menus = await screen.findAllByRole('button', { name: /^Actions for / })
    expect(menus).toHaveLength(2)
    expect(menus.every((menu) => menu.getAttribute('aria-label')?.includes('Shelley Kannes'))).toBe(
      true,
    )
  })

  it('puts a slip on hold, pays it, and recalculates another', async () => {
    const { user } = renderApp('/payroll/pay-slips/all')

    await openAction(user, `Actions for Ayesha Malik, ${MONTH}`, 'On Hold')
    await confirmYes(user)
    await waitFor(() => {
      expect(slipOf('em_ayesha').status).toBe('on-hold')
    })

    await openAction(user, `Actions for Ayesha Malik, ${MONTH}`, 'Pay')
    await confirmYes(user)
    await waitFor(() => {
      expect(slipOf('em_ayesha').status).toBe('released')
    })

    await openAction(user, `Actions for Dr Hamda Shafeeq, ${MONTH}`, 'Recalculate')
    await confirmYes(user)
    expect((await screen.findAllByText('Pay slip recalculated')).length).toBeGreaterThan(0)
  })

  it('edits a value, marks it Manually Updated and keeps it in History', async () => {
    const { user } = renderApp('/payroll/pay-slips/all')
    const before = slipOf('em_hamda')

    await openAction(user, `Actions for Dr Hamda Shafeeq, ${MONTH}`, 'Edit')
    const dialog = await screen.findByRole('dialog', { name: /^Edit pay slip of Dr Hamda Shafeeq/ })
    const overtime = within(dialog).getByRole('textbox', { name: 'Overtime value' })
    await user.clear(overtime)
    await user.type(overtime, '5000')
    expect(
      within(dialog).getByRole('checkbox', { name: 'Overtime manually updated' }),
    ).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const item = slipOf('em_hamda').items.find((entry) => entry.payItemId === 'pi_overtime')
      expect(item).toMatchObject({ value: 5000, manuallyUpdated: true })
    })
    const previousOvertime =
      before.items.find((entry) => entry.payItemId === 'pi_overtime')?.value ?? 0
    expect(slipOf('em_hamda').earnings).toBe(before.earnings - previousOvertime + 5000)

    await openAction(user, `Actions for Dr Hamda Shafeeq, ${MONTH}`, 'View')
    const view = await screen.findByRole('dialog', { name: /^Pay slip of Dr Hamda Shafeeq/ })
    await user.click(within(view).getByRole('button', { name: 'History of Overtime' }))
    const history = await screen.findByRole('dialog', { name: 'History: Overtime' })
    expect(within(history).getByRole('cell', { name: '5000' })).toBeVisible()
    expect(within(history).getByRole('cell', { name: 'Update' })).toBeVisible()
  })

  it('shows the pay slip document with the net pay in words', async () => {
    const { user } = renderApp('/payroll/pay-slips/all')
    const slip = slipOf('em_ayesha')

    await openAction(user, `Actions for Ayesha Malik, ${MONTH}`, 'Payslip')
    const document = await screen.findByRole('article', { name: 'Payslip of Ayesha Malik' })
    expect(within(document).getByText('Employee Info')).toBeVisible()
    expect(within(document).getByText(`Rs ${amountInWords(slip.netPayable)}`)).toBeVisible()
    expect(within(document).getAllByText(formatRs(slip.netPayable)).length).toBeGreaterThan(0)
  })
})

describe('Salary Sheet', () => {
  it('lists the payroll’s people with a Total line', async () => {
    renderApp('/payroll/salary-sheet?payrollId=pr_6')
    ensurePayrollRuns()
    const slips = payslips
      .all()
      .filter((slip) => slip.payrollId === 'pr_6' && slip.month === thisMonth())
    const net = slips.reduce((sum, slip) => sum + slip.netPayable, 0)

    const table = await screen.findByRole('table', { name: /^Salary Sheet, Head Office/ })
    expect(within(table).getAllByRole('row')).toHaveLength(slips.length + 3)
    const total = within(table).getByRole('row', { name: /^Total/ })
    expect(within(total).getByText(formatRs(net))).toBeVisible()
  })
})

describe('Final Settlement', () => {
  it('closes a pending settlement, which becomes Completed', async () => {
    const { user } = renderApp('/payroll/final-settlement')

    expect(await screen.findByRole('heading', { name: 'Final Settlement', level: 1 })).toBeVisible()
    await openAction(user, 'Actions for Talha Aziz', 'Close FS')
    await confirmYes(user)

    await waitFor(() => {
      expect(finalSettlements.find('fs_talha')?.status).toBe('completed')
    })
    const row = await screen.findByRole('row', { name: /Talha Aziz/ })
    expect(await within(row).findByText('Completed')).toBeVisible()
    const fsSlip = payslips
      .all()
      .find((slip) => slip.employeeId === 'em_talha' && slip.payrollId === 'fs')
    expect(fsSlip?.status).toBe('released-fs')
  })
})
