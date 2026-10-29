import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { differenceInCalendarMonths, format, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { accountEntries, openingBalances, salaryRevisions, vouchers } from '@/mocks/payroll/db'
import { salaryOn } from '@/mocks/payroll/people'
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

async function rowAction(user: UserEvent, name: string | RegExp, action: string) {
  await user.click(await screen.findByRole('button', { name }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

describe('Employee Voucher', () => {
  it('creates a voucher, approves it, verifies it, and lists it on Vouchers', async () => {
    const { user, router } = renderApp('/payroll/vouchers/employee')

    expect(await screen.findByRole('heading', { name: 'Employee Voucher', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Employee Voucher Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the employee')).toBeVisible()
    expect(within(dialog).getByText('Enter the purpose of the voucher')).toBeVisible()

    await choose(user, /^Employee Name/, /Omar Siddiqui/)
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: /^Designation/ })).toHaveValue(
        'Branch Manager',
      )
    })
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '25000')
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Purpose Of Voucher/ }),
      'Hotel stay',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Voucher created')).toBeInTheDocument()

    const created = vouchers.all().find((item) => item.purpose === 'Hotel stay')
    // After the three seeded vouchers and the two manual leave encashment lines (VCH-00004, 5).
    expect(created?.voucherNo).toBe('VCH-00006')
    expect(created?.status).toBe('pending')

    await rowAction(user, 'Actions for Omar Siddiqui, voucher VCH-00006', 'Approve')
    const approve = await screen.findByRole('dialog', { name: 'Approve Voucher' })
    await user.type(within(approve).getByRole('textbox', { name: 'Remarks' }), 'Within policy')
    await user.click(within(approve).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Voucher approved')).toBeInTheDocument()

    await rowAction(user, 'Actions for Omar Siddiqui, voucher VCH-00006', 'Verify')
    const verify = await screen.findByRole('dialog', { name: 'Verify Voucher' })
    await user.click(within(verify).getByRole('button', { name: 'Verify' }))
    expect(await screen.findByText('Voucher verified for payment')).toBeInTheDocument()
    await waitFor(() => {
      expect(vouchers.find(created?.id ?? '')?.status).toBe('processed')
    })
    expect(vouchers.find(created?.id ?? '')?.remarks).toBe('Within policy')

    await router.navigate({ to: '/payroll/vouchers' })
    expect(await screen.findByRole('heading', { name: 'Vouchers', level: 1 })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'Rs 25,000' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Daily Wages' })).toBeVisible()
  }, 40_000)

  it('refuses to verify a voucher nobody approved', async () => {
    const { user } = renderApp('/payroll/vouchers/employee')
    await user.click(
      await screen.findByRole('button', { name: 'Actions for Saad Hadier, voucher VCH-00001' }),
    )
    expect(await screen.findByRole('menuitem', { name: 'Approve' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'Verify' })).not.toBeInTheDocument()
  })
})

describe('Balances', () => {
  it('adds an opening balance and views a person’s entries', async () => {
    const { user } = renderApp('/payroll/balances/opening-balance')

    expect(await screen.findByRole('heading', { name: 'Opening Balance', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const create = await screen.findByRole('dialog', { name: 'Opening Balance Adjustment' })
    await choose(user, /^Employees/, /Hina Raza/)
    await user.click(within(create).getByRole('button', { name: /^Month/ }))
    await user.click(await screen.findByRole('button', { name: format(new Date(), 'MMMM, yyyy') }))
    await choose(user, /^Pay item/, 'Travel Allowance')
    await user.type(within(create).getByRole('textbox', { name: /^Amount/ }), '7000')
    await user.click(within(create).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('cell', { name: 'RS 7,000' })).toBeVisible()
    const hina = openingBalances.all().find((item) => item.employeeId === 'em_hina')
    expect(hina).toMatchObject({
      amount: 7000,
      payItemId: 'pi_travel',
      balanceMonth: format(new Date(), 'yyyy-MM-01'),
      kind: 'opening',
    })

    await rowAction(user, /^Actions for .*, Rehan Ahmad/, 'View')
    const view = await screen.findByRole('dialog', { name: 'Opening Balance View' })
    expect(await within(view).findByRole('region', { name: 'Travel Allowance' })).toBeVisible()
    expect(within(view).getByRole('region', { name: 'Medical' })).toBeVisible()
    // The oldest entry's month is closed: it can be looked at, not changed.
    expect(within(view).getByLabelText(/^Locked \(month closed\)/)).toBeVisible()
    expect(within(view).getAllByRole('button', { name: /^Edit, / })).toHaveLength(1)
  })

  it('creates an employee account debit', async () => {
    const { user } = renderApp('/payroll/balances/employee-accounts')

    expect(
      await screen.findByRole('heading', { name: 'Employee Accounts', level: 1 }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Employee Account Create' })
    await choose(user, /^Account/, 'Provident Fund')
    await choose(user, /^Employee/, /Hina Raza/)
    await user.click(within(dialog).getByRole('switch', { name: 'Credit or debit: Credit+' }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '4500')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(
        accountEntries
          .all()
          .some(
            (entry) => entry.employeeId === 'em_hina' && entry.debit === 4500 && entry.credit === 0,
          ),
      ).toBe(true)
    })
    expect(await screen.findByRole('cell', { name: 'RS 4,500' })).toBeVisible()
  })

  it('shows the running balance on the account statement', async () => {
    renderApp('/payroll/balances/account-statement')

    expect(
      await screen.findByRole('heading', { name: 'Employee Account Statement', level: 1 }),
    ).toBeVisible()
    await screen.findAllByText('Rehan Ahmad')
    const rows = screen.getAllByRole('row').filter((row) => within(row).queryByText('Rehan Ahmad'))
    expect(rows.map((row) => within(row).getAllByRole('cell').at(-2)?.textContent)).toEqual([
      'RS 8,500',
      'RS 17,000',
      'RS 15,000',
    ])
  })
})

describe('Salary Revision', () => {
  it('works out a percentage revision from the previous salary', async () => {
    const { user } = renderApp('/payroll/salary-revision')

    expect(await screen.findByRole('heading', { name: 'Salary Revision', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Salary Revision Create' })
    await choose(user, /^Employee/, /Hina Raza/)
    const day = new Date()
    await pickDate(user, /^Effective Date/, day)
    await user.click(within(dialog).getByRole('switch', { name: 'Type: Flat' }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Percentage Increase/ }), '10')

    const previous = salaryOn('em_hina', format(subDays(day, 1), 'yyyy-MM-dd'))
    const expected = Math.round(previous * 1.1 * 100) / 100
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: /^New Salary/ })).toHaveValue(
        new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(expected),
      )
    })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Salary revision created')).toBeInTheDocument()
    const saved = salaryRevisions.all().find((item) => item.employeeId === 'em_hina')
    expect(saved).toMatchObject({ type: 'percentage', percentage: 10, salary: expected })
    expect(salaryOn('em_hina', format(day, 'yyyy-MM-dd'))).toBe(expected)
  })
})

describe('Final Settlement', () => {
  it('works out a leaver’s settlement and closes it', async () => {
    const { user } = renderApp('/payroll/final-settlement')

    expect(await screen.findByRole('heading', { name: 'Final Settlement', level: 1 })).toBeVisible()
    const talha = (await screen.findByText('Talha Aziz')).closest('tr')
    if (!talha) throw new Error('No row for Talha Aziz')
    expect(within(talha).getByText('Pending')).toBeVisible()

    await rowAction(user, 'Actions for Talha Aziz', 'Recalculate')
    await user.click(await screen.findByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('Final settlement recalculated')).toBeInTheDocument()
    expect(await screen.findByText('Calculated')).toBeVisible()

    await rowAction(user, 'Actions for Talha Aziz', 'Close FS')
    const close = await screen.findByRole('dialog', { name: 'Close Final Settlement' })
    await user.click(within(close).getByRole('button', { name: 'Close FS' }))
    expect(await screen.findByText('Final settlement closed')).toBeInTheDocument()
    await waitFor(() => {
      const row = screen.getByText('Talha Aziz').closest('tr')
      expect(row && within(row).getByText('Completed')).toBeVisible()
    })
  })
})
