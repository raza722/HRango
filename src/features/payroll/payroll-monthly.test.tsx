import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { payrolls, payslips } from '@/mocks/payroll/db'
import { renderApp } from '@/test/test-utils'

import { formatMonth } from './utils/format'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** The tax year the seed's current structure covers (July to June). */
const taxYear = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name)
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

describe('Payrolls → Monthly', () => {
  it('lists the payrolls with the icons their status allows', async () => {
    renderApp('/payroll/payrolls/monthly')

    expect(await screen.findByRole('heading', { name: 'Payrolls Monthly', level: 1 })).toBeVisible()
    const running = await rowOf('Head Office (Pakistan-PKR)')
    expect(within(running).getByText('Run')).toBeVisible()
    expect(
      within(running).getByRole('button', { name: 'On Hold, Head Office (Pakistan-PKR)' }),
    ).toBeVisible()
    const closed = await rowOf('Software (Pakistan-PKR)')
    expect(within(closed).getByText('Closed')).toBeVisible()
    expect(within(closed).queryByRole('button', { name: /^Close,/ })).not.toBeInTheDocument()
    expect(within(closed).queryByRole('button', { name: /^Edit,/ })).not.toBeInTheDocument()
    expect(
      within(closed).getByRole('button', { name: 'Salary Sheet, Software (Pakistan-PKR)' }),
    ).toBeVisible()
    const held = await rowOf('Abdul (Pakistan-PKR)')
    expect(within(held).getByText('On Hold')).toBeVisible()
    expect(
      within(held).getByRole('button', { name: 'Release Hold, Abdul (Pakistan-PKR)' }),
    ).toBeVisible()
  })

  it('creates a payroll, adds an employee, runs it and closes it', async () => {
    const { user } = renderApp('/payroll/payrolls/monthly')

    await user.click(await screen.findByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Payrolls Monthly' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the payroll name')).toBeVisible()
    expect(within(dialog).getByText('Choose the tax structure')).toBeVisible()
    expect(within(dialog).getByText('Choose the disbursement bank')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Dubai (UAE-PKR)')
    await user.click(within(dialog).getByRole('button', { name: /^Payroll Month/ }))
    await user.click(
      await screen.findByRole('button', { name: formatMonth(format(new Date(), 'yyyy-MM')) }),
    )
    await choose(user, /^Tax Structure/, `Tax Structure ${taxYear}-${taxYear + 1}`)
    await choose(user, /^Disbursement Bank/, /^UBL Digital Bank/)
    await user.click(within(dialog).getByRole('button', { name: '+Add' }))
    await choose(user, 'Payitem name, row 1', 'Salary')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Taxable: Salary' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Payroll created')).toBeInTheDocument()

    const row = await rowOf('Dubai (UAE-PKR)')
    expect(within(row).getByText('Pending')).toBeVisible()
    const created = payrolls.all().find((item) => item.name === 'Dubai (UAE-PKR)')
    expect(created?.payItems).toMatchObject([{ payItemId: 'pi_salary', isTaxable: true }])
    expect(created?.processingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Nobody on it yet: Run explains what is missing.
    await user.click(within(row).getByRole('button', { name: 'Run, Dubai (UAE-PKR)' }))
    expect(
      await screen.findByText(/Add employees to the payroll before running it/),
    ).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'View Employments, Dubai (UAE-PKR)' }))
    const employments = await screen.findByRole('dialog', { name: 'Employments' })
    expect(await within(employments).findByText('No Record Found')).toBeVisible()
    await user.click(within(employments).getByRole('button', { name: 'Add' }))
    const picker = await screen.findByRole('dialog', { name: 'Select Employees' })
    await user.click(within(picker).getByRole('combobox', { name: 'Employees' }))
    await user.click(await screen.findByRole('option', { name: /Daniel Brooks/ }))
    await user.click(within(picker).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Employments saved')).toBeInTheDocument()
    expect(await within(employments).findByText('Daniel Brooks')).toBeVisible()
    await user.click(within(employments).getByRole('button', { name: 'Cancel' }))

    await user.click(
      within(await rowOf('Dubai (UAE-PKR)')).getByRole('button', { name: 'Run, Dubai (UAE-PKR)' }),
    )
    expect(await screen.findByText('Payroll run (1 payslip)')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        payslips.all().some((slip) => slip.payrollId === created?.id && slip.status === 'ready'),
      ).toBe(true)
    })

    await user.click(
      within(await rowOf('Dubai (UAE-PKR)')).getByRole('button', {
        name: 'Close, Dubai (UAE-PKR)',
      }),
    )
    const confirm = await screen.findByRole('alertdialog', { name: 'Close payroll' })
    expect(within(confirm).getByText(/Close this Payroll/)).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('Payroll closed')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        payslips
          .all()
          .filter((slip) => slip.payrollId === created?.id)
          .every((slip) => slip.status === 'released'),
      ).toBe(true)
    })
    // Create → employments → run → close takes over the 15 s default when the whole suite runs.
  }, 40_000)

  it('puts a payroll on hold and shows its run history', async () => {
    const { user } = renderApp('/payroll/payrolls/monthly')

    const running = await rowOf('Head Office (Pakistan-PKR)')
    await user.click(
      within(running).getByRole('button', { name: 'On Hold, Head Office (Pakistan-PKR)' }),
    )
    expect(await screen.findByText('Payroll on hold')).toBeInTheDocument()
    await waitFor(() => {
      expect(payrolls.find('pr_6')?.status).toBe('on_hold')
    })

    const held = await rowOf('Abdul (Pakistan-PKR)')
    await user.click(within(held).getByRole('button', { name: 'Error, Abdul (Pakistan-PKR)' }))
    // Its last run could not pay Nida Hassan, who has left (the seeded error).
    const errors = await screen.findByRole('dialog', { name: 'Payrolls History Error' })
    expect(await within(errors).findByText('Nida Hassan')).toBeVisible()
    expect(
      within(errors).getByText('The employee is not active in the payroll month.'),
    ).toBeVisible()
    await user.click(within(errors).getByRole('button', { name: 'Cancel' }))

    await user.click(within(held).getByRole('button', { name: 'View, Abdul (Pakistan-PKR)' }))
    const view = await screen.findByRole('dialog', { name: 'Payrolls View' })
    expect(within(view).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await user.click(within(view).getByRole('button', { name: 'History' }))
    const history = await screen.findByRole('dialog', { name: 'Payrolls History' })
    expect(await within(history).findByText('Run')).toBeVisible()
    expect(within(history).getByText('Shelley Kannes')).toBeVisible()
  })
})
