import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { differenceInCalendarMonths, format, isWeekend, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import {
  accountEntries,
  dailyWages,
  employeeVouchers,
  openingBalances,
  payslips,
  salaryRevisions,
  vouchers,
} from '@/mocks/payroll/db'
import { salaryOn } from '@/mocks/payroll/engine'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date box's calendar and picks the day, moving months if needed. */
async function pickDate(user: UserEvent, label: string | RegExp, date: Date) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }))
}

function lastWeekday(): Date {
  let day = subDays(new Date(), 1)
  while (isWeekend(day)) day = subDays(day, 1)
  return day
}

describe('Payrolls Daily Wages', () => {
  it('creates a daily wage payroll in two steps', async () => {
    const { user } = renderApp('/payroll/payrolls/daily-wages')

    expect(
      await screen.findByRole('heading', { name: 'Payrolls Daily Wages', level: 1 }),
    ).toBeVisible()
    expect(await screen.findByText('Event Helpers')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const first = await screen.findByRole('dialog', { name: 'Create Daily Wage Payroll' })
    await user.click(within(first).getByRole('button', { name: 'Next' }))
    expect(await within(first).findByText('Enter a name')).toBeVisible()

    await user.type(within(first).getByRole('textbox', { name: /^Name/ }), 'Warehouse Shift')
    await pickDate(user, /^Date/, lastWeekday())
    await choose(user, /^Time Slot/, /Morning Work/)
    await user.click(within(first).getByRole('button', { name: 'Next' }))

    const second = await screen.findByRole('dialog', { name: 'Select Employee' })
    await user.click(await within(second).findByRole('checkbox', { name: 'Select Kashif Raza' }))
    await user.click(within(second).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Warehouse Shift')).toBeVisible()
    const batch = dailyWages.all().find((item) => item.name === 'Warehouse Shift')
    expect(batch?.employeeIds).toEqual(['em_kashif'])
    expect(batch?.timeSlotId).toBe('rg_morning')
  })

  it('opens the details and pays them out as vouchers', async () => {
    const { user } = renderApp('/payroll/payrolls/daily-wages')

    const seeded = dailyWages.find('dw_1')
    if (!seeded) throw new Error('no seeded batch')
    await user.click(
      await screen.findByRole('button', { name: `Actions for Daily Wages, ${seeded.date}` }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'View' }))
    const details = await screen.findByRole('dialog', { name: /Daily Wages Details/ })
    expect(await within(details).findByText('Kashif Raza')).toBeVisible()
    expect(within(details).getByText('In words')).toBeVisible()

    const before = vouchers.all().length
    await user.click(within(details).getByRole('button', { name: 'Voucher' }))
    expect((await screen.findAllByText(/vouchers? created$/)).length).toBeGreaterThan(0)
    expect(vouchers.all().length).toBeGreaterThanOrEqual(before)
  })
})

describe('Employee Voucher', () => {
  it('creates a voucher that shows on the Vouchers list', async () => {
    const { user, router } = renderApp('/payroll/vouchers/employee')

    expect(await screen.findByRole('heading', { name: 'Employee Voucher', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Employee Voucher Create' })

    await choose(user, /^Employee Name/, /Omar Siddiqui/)
    expect(within(dialog).getByRole('textbox', { name: /^Designation/ })).toHaveValue(
      'Branch Manager',
    )
    await user.type(within(dialog).getByRole('textbox', { name: /^Voucher No/ }), 'TEST-0001')
    await user.type(within(dialog).getByRole('textbox', { name: /^Currency/ }), '25000')
    await choose(user, /^Requested By/, /Omar Siddiqui/)
    await choose(user, /^Approved By/, /Bilal Ahmed/)
    await pickDate(user, /^Approval Date/, new Date())
    await user.type(within(dialog).getByRole('textbox', { name: /^Verified By/ }), 'Finance')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(employeeVouchers.all().some((item) => item.voucherNo === 'TEST-0001')).toBe(true)
    })
    await router.navigate({ to: '/payroll/vouchers' })
    expect(await screen.findByRole('heading', { name: 'Vouchers', level: 1 })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'Rs 25,000' })).toBeVisible()
  })
})

describe('Balances', () => {
  it('adds an opening balance and adjusts it', async () => {
    const { user } = renderApp('/payroll/balances/opening-balance')

    expect(await screen.findByRole('cell', { name: 'RI-00001' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const create = await screen.findByRole('dialog', { name: 'Opening Balance Adjustment' })
    await choose(user, /^Employees/, /Hina Raza/)
    await user.click(within(create).getByRole('button', { name: /^Month/ }))
    await user.click(await screen.findByRole('button', { name: format(new Date(), 'MMMM, yyyy') }))
    await choose(user, /^Pay item/, 'Arrear')
    await user.type(within(create).getByRole('textbox', { name: /^Amount/ }), '7000')
    await user.click(within(create).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('cell', { name: 'RS 7,000' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: /^Actions for RI-00002, Hina Raza/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Adjust' }))
    const adjust = await screen.findByRole('dialog', { name: 'Opening Balance Adjustment' })
    expect(within(adjust).getByRole('combobox', { name: /^Employees/ })).toBeDisabled()
    await choose(user, /^Pay item/, 'Gratuity')
    await user.type(within(adjust).getByRole('textbox', { name: /^Amount/ }), '3000')
    await user.click(within(adjust).getByRole('button', { name: 'Save' }))
    const hinaRow = (await screen.findByRole('cell', { name: 'RI-00002' })).closest('tr')
    if (!hinaRow) throw new Error('no row for RI-00002')
    expect(await within(hinaRow).findByRole('cell', { name: 'RS 10,000' })).toBeVisible()
    const hina = openingBalances.all().find((item) => item.employeeId === 'em_hina')
    expect(hina?.items.map((item) => item.amount)).toEqual([7000, 3000])
  })

  it('creates an employee account debit', async () => {
    const { user } = renderApp('/payroll/balances/employee-accounts')

    expect(
      await screen.findByRole('heading', { name: 'Employee Accounts', level: 1 }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Employee Account Create' })
    await choose(user, /^Account/, 'Medical')
    await choose(user, /^Employee/, /Hina Raza/)
    await user.click(within(dialog).getByRole('switch', { name: 'Credit or debit: Credit+' }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '4500')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(
        accountEntries
          .all()
          .some(
            (entry) =>
              entry.employeeId === 'em_hina' &&
              entry.direction === 'debit' &&
              entry.amount === 4500,
          ),
      ).toBe(true)
    })
    expect(await screen.findByRole('cell', { name: 'RS 4,500' })).toBeVisible()
  })
})

describe('Salary Revision', () => {
  it('works out a percentage revision from the current salary', async () => {
    const { user } = renderApp('/payroll/salary-revision')

    expect(await screen.findByRole('cell', { name: 'SR-00002' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Salary Revision Create' })
    await choose(user, /^Employee/, /Hina Raza/)
    const day = new Date()
    await pickDate(user, /^Effective Date/, day)
    await user.click(within(dialog).getByRole('switch', { name: 'Type: Flat' }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Percentage Increase/ }), '10')

    const expected = Math.round(salaryOn('em_hina', format(day, 'yyyy-MM-dd')) * 1.1)
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: /^Salary/ })).toHaveValue(String(expected))
    })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(salaryRevisions.all().find((item) => item.employeeId === 'em_hina')?.salary).toBe(
        expected,
      )
    })
    expect(await screen.findByRole('cell', { name: 'SR-00003' })).toBeVisible()
    expect(salaryOn('em_hina', format(day, 'yyyy-MM-dd'))).toBe(expected)
  })
})

describe('Reports', () => {
  it('lists provident fund, tax rebate and tax paid per person', async () => {
    renderApp('/payroll/reports/employee-accounts')

    expect(
      await screen.findByRole('heading', { name: 'Employee Account Report', level: 1 }),
    ).toBeVisible()
    expect(
      await screen.findByRole('columnheader', { name: 'Provident Fund Deduction' }),
    ).toBeVisible()
    const footer = await screen.findByText(/^Showing 1 to/)
    const people = new Set(payslips.all().map((slip) => slip.employeeId)).size
    expect(people).toBeGreaterThan(0)
    expect(footer).toHaveTextContent(`of ${String(people)} employees`)
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })
})
