import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { leaveTypeStore } from '@/mocks/leaves/db'
import { leaveEncashments } from '@/mocks/payroll/db'
import { renderApp } from '@/test/test-utils'

const year = new Date().getFullYear()

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function openCreate(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Create' }))
  return screen.findByRole('dialog', { name: 'Leave Encashment Create' })
}

async function pickYear(user: UserEvent, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole('button', { name: /^Year/ }))
  await user.click(await screen.findByRole('button', { name: String(year) }))
}

describe('Leave Encashment', () => {
  it('lists one line per person, with the days and the amount per leave', async () => {
    renderApp('/payroll/leave-encashment')

    expect(await screen.findByRole('heading', { name: 'Leave Encashment', level: 1 })).toBeVisible()
    const omer = (await screen.findByText('Omer Farooq')).closest('tr')
    if (!omer) throw new Error('No row for Omer Farooq')
    expect(within(omer).getByText('Sick Leave')).toBeVisible()
    expect(within(omer).getByText(String(year))).toBeVisible()
    expect(within(omer).getByText('Rs 4,000')).toBeVisible()
    expect(within(omer).getByText('Rs 20,000')).toBeVisible()
    expect(screen.getByText('Haroon Jalani')).toBeVisible()
    expect(screen.getByText('Fatima Zahra')).toBeVisible()
  })

  it('encashes everyone’s sick leave through the payroll', async () => {
    const { user } = renderApp('/payroll/leave-encashment')

    const dialog = await openCreate(user)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the leave type')).toBeVisible()
    expect(within(dialog).getByText('Choose the employees')).toBeVisible()
    expect(within(dialog).getByText('Choose the year')).toBeVisible()

    await choose(user, /^Leave Type/, 'Sick Leave')
    await user.click(within(dialog).getByRole('checkbox', { name: 'All Employees' }))
    expect(within(dialog).queryByRole('combobox', { name: /^Employees/ })).not.toBeInTheDocument()
    await pickYear(user, dialog)
    expect(within(dialog).getByRole('switch', { name: 'Type: Payroll' })).not.toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/^Leave encashment created \(\d+ people\)$/)).toBeInTheDocument()

    const created = leaveEncashments
      .all()
      .find((item) => item.appliesToAll && item.leaveTypeId === 'lt_sick')
    expect(created).toMatchObject({ mode: 'payroll', basis: 'earned_salary', fiscalYear: year })
    // Omer Farooq encashed 5 of his 8 sick days already.
    expect(created?.employees.find((line) => line.employeeId === 'em_omer')?.days).toBe(3)
  })

  it('needs an amount for an hourly basis, and says when nobody has days left', async () => {
    const { user } = renderApp('/payroll/leave-encashment')

    let dialog = await openCreate(user)
    await choose(user, /^Leave Type/, 'Casual Leaves')
    await user.click(within(dialog).getByRole('combobox', { name: /^Employees/ }))
    await user.click(await screen.findByRole('option', { name: /Haroon Jalani/ }))
    await user.keyboard('{Escape}')
    await pickYear(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Nobody chosen has leave days to encash.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    dialog = await openCreate(user)
    await choose(user, /^Leave Type/, 'Casual Leaves')
    await user.click(within(dialog).getByRole('combobox', { name: /^Employees/ }))
    await user.click(await screen.findByRole('option', { name: /Imran Butt/ }))
    await user.keyboard('{Escape}')
    await pickYear(user, dialog)
    await user.click(within(dialog).getByRole('switch', { name: 'Type: Payroll' }))
    await choose(user, /^Amount Per Leave/, 'Per Hour Rate')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('Enter the amount per leave for this basis'),
    ).toBeVisible()
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount$/ }), '1200')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Leave encashment created (1 person)')).toBeInTheDocument()

    const created = leaveEncashments
      .all()
      .find((item) => item.employees.some((line) => line.employeeId === 'em_imran'))
    expect(created).toMatchObject({ mode: 'manual', basis: 'per_hour_rate', amountPerLeave: 1200 })
    expect(created?.employees.map((line) => [line.days, line.amount])).toEqual([[10, 12_000]])
  })

  it('shows the leave type’s limits and pays no more than its maximum', async () => {
    const { user } = renderApp('/payroll/leave-encashment')

    const dialog = await openCreate(user)
    await choose(user, /^Leave Type/, 'Annual Leave')
    expect(
      within(dialog).getByText(
        'Encashment limit: 1 to 10 days per person. Anyone with fewer than 1 day left is left out, and anyone with more than 10 days is paid for 10.',
      ),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('combobox', { name: /^Employees/ }))
    await user.click(await screen.findByRole('option', { name: /Imran Butt/ }))
    await user.keyboard('{Escape}')
    await pickYear(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Leave encashment created (1 person)')).toBeInTheDocument()

    // Imran has all 14 annual days left; the maximum pays 10.
    const created = leaveEncashments
      .all()
      .find(
        (item) =>
          item.leaveTypeId === 'lt_annual' &&
          item.employees.some((line) => line.employeeId === 'em_imran'),
      )
    expect(created?.employees.map((line) => line.days)).toEqual([10])
  })

  it('refuses a leave type whose encashment is off before sending anything', async () => {
    const { user } = renderApp('/payroll/leave-encashment')

    const dialog = await openCreate(user)
    await choose(user, /^Leave Type/, 'Unpaid Leave')
    expect(
      within(dialog).getByText(
        'Encashment is turned off for Unpaid Leave (Leave Settings → Leave Types).',
      ),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('checkbox', { name: 'All Employees' }))
    await pickYear(user, dialog)
    const before = leaveEncashments.all().length
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText(
        'Unpaid Leave cannot be encashed: turn on Encashment for it in Leave Settings → Leave Types',
      ),
    ).toBeVisible()
    expect(leaveEncashments.all()).toHaveLength(before)
  })

  it('shows the API’s refusal when nobody has the minimum days', async () => {
    // Raise Casual Leaves' minimum to 5: Fatima Zahra has 4 of her 10 days left.
    const casual = leaveTypeStore.find('lt_casual')
    if (!casual) throw new Error('No Casual Leaves')
    leaveTypeStore.update('lt_casual', { ...casual, encashmentMin: 5 })
    const { user } = renderApp('/payroll/leave-encashment')

    const dialog = await openCreate(user)
    await choose(user, /^Leave Type/, 'Casual Leaves')
    expect(within(dialog).getByText(/^Encashment limit: 5 to 10 days per person\./)).toBeVisible()
    await user.click(within(dialog).getByRole('combobox', { name: /^Employees/ }))
    await user.click(await screen.findByRole('option', { name: /Fatima Zahra/ }))
    await user.keyboard('{Escape}')
    await pickYear(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText(
        'Nobody chosen has the 5 days of Casual Leaves its minimum asks for.',
      ),
    ).toBeVisible()
  })

  it('views an encashment, deletes one, and locks one that was paid', async () => {
    const { user } = renderApp('/payroll/leave-encashment')

    await user.click(
      await screen.findByRole('button', {
        name: `Actions for Casual Leaves, Haroon Jalani, ${String(year)}`,
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'View' }))
    const view = await screen.findByRole('dialog', { name: 'Leave Encashment View' })
    expect(within(view).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(await within(view).findByRole('switch', { name: 'Type: Manually' })).toBeChecked()
    expect(within(view).getByRole('combobox', { name: /^Amount Per Leave/ })).toHaveTextContent(
      'Earned Salary',
    )
    await user.click(within(view).getByRole('button', { name: 'Cancel' }))

    await user.click(
      screen.getByRole('button', {
        name: `Actions for Casual Leaves, Fatima Zahra, ${String(year)}`,
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete leave encashment' })
    expect(within(confirm).getByText(/for everyone on it/)).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('Leave encashment deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(leaveEncashments.find('le_2')).toBeUndefined()
    })

    // Paid in a released slip: it can be looked at, no longer changed.
    const paid = leaveEncashments.find('le_1')
    if (!paid) throw new Error('No seeded encashment')
    leaveEncashments.update(paid.id, { ...paid, isPaid: true })
    await user.click(
      screen.getByRole('button', { name: `Actions for Sick Leave, Omer Farooq, ${String(year)}` }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const edit = await screen.findByRole('dialog', { name: 'Leave Encashment Edit' })
    expect(await within(edit).findByText(/was paid in a released pay slip/)).toBeVisible()
    expect(within(edit).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
