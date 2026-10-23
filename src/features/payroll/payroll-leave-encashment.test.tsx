import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { accountEntries, leaveEncashments, payslips, vouchers } from '@/mocks/payroll/db'
import { salaryOn, shiftHours } from '@/mocks/payroll/engine'
import { renderApp } from '@/test/test-utils'

import { formatRs } from './utils/format'

const year = new Date().getFullYear()
const thisMonth = format(new Date(), 'yyyy-MM')
const today = format(new Date(), 'yyyy-MM-dd')
const daySalary = (employeeId: string) => Math.round(salaryOn(employeeId, today) / 30)

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
  it('lists one line per person, with the amount per leave', async () => {
    renderApp('/payroll/leave-encashment')

    expect(await screen.findByRole('heading', { name: 'Leave Encashment', level: 1 })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Leave Encashment' })).toBeInTheDocument()
    const omer = (await screen.findByText('Omer Farooq')).closest('tr')
    if (!omer) throw new Error('No row for Omer Farooq')
    expect(within(omer).getByText('Sick Leave')).toBeVisible()
    expect(within(omer).getByText(String(year))).toBeVisible()
    expect(within(omer).getByText(formatRs(daySalary('em_omer')))).toBeVisible()
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
    expect(await screen.findByText('Leave encashment created (5 people)')).toBeInTheDocument()

    // Omer Farooq's sick leave was encashed already; the others' days come off their quota.
    const created = leaveEncashments.all().find((item) => item.code === 'LE-00003')
    expect(
      created?.lines
        .map((line) => [line.employeeId, line.days])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ['em_fatima', 8],
      ['em_haroon', 8],
      ['em_imran', 8],
      ['em_rehan', 8],
      ['em_sadia', 7],
    ])
    expect(
      accountEntries
        .all()
        .some(
          (entry) =>
            entry.id === `ae_le_${created?.id ?? ''}_em_sadia` &&
            entry.direction === 'debit' &&
            entry.amount === 7,
        ),
    ).toBe(true)
    // Sadia Rehman is on the Head Office payroll, which is open this month.
    await waitFor(() => {
      const slip = payslips
        .all()
        .find((item) => item.employeeId === 'em_sadia' && item.month === thisMonth)
      expect(slip?.items.find((item) => item.payItemId === 'pi_leave_encashment')?.value).toBe(
        7 * daySalary('em_sadia'),
      )
    })
  })

  it('pays a manual encashment by voucher, and says when nobody has days left', async () => {
    const { user } = renderApp('/payroll/leave-encashment')

    let dialog = await openCreate(user)
    await choose(user, /^Leave Type/, 'Casual Leaves')
    await user.click(within(dialog).getByRole('combobox', { name: /^Employees/ }))
    await user.click(await screen.findByRole('option', { name: /Haroon Jalani/ }))
    await user.keyboard('{Escape}')
    await pickYear(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText(`Nobody chosen has Casual Leaves left in ${String(year)}.`),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    dialog = await openCreate(user)
    await choose(user, /^Leave Type/, 'Casual Leaves')
    await user.click(within(dialog).getByRole('combobox', { name: /^Employees/ }))
    await user.click(await screen.findByRole('option', { name: /Imran Butt/ }))
    await user.keyboard('{Escape}')
    await pickYear(user, dialog)
    await user.click(within(dialog).getByRole('switch', { name: 'Type: Payroll' }))
    expect(within(dialog).getByRole('combobox', { name: /^Amount Per Leave/ })).toHaveTextContent(
      'Overtime',
    )
    await choose(user, /^Amount Per Leave/, 'Per Hour Rate')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Leave encashment created (1 person)')).toBeInTheDocument()

    const perLeave = Math.round((daySalary('em_imran') / 8) * shiftHours('em_imran', today))
    const created = leaveEncashments.all().find((item) => item.code === 'LE-00003')
    expect(created?.lines).toEqual([
      { employeeId: 'em_imran', days: 10, amountPerLeave: Math.round(perLeave) },
    ])
    const line = vouchers.find(`vc_le_${created?.id ?? ''}_em_imran`)
    expect(line?.type).toBe('leave-encashment')
    expect(line?.amount).toBe(10 * Math.round(perLeave))
  })

  it('views an encashment, deletes one, and locks one paid in a released slip', async () => {
    const { user } = renderApp('/payroll/leave-encashment')

    await user.click(
      await screen.findByRole('button', {
        name: `Actions for Casual Leaves, Haroon Jalani, ${String(year)}`,
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'View' }))
    const view = await screen.findByRole('dialog', { name: 'Leave Encashment View' })
    expect(within(view).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(within(view).getByRole('switch', { name: 'Type: Manually' })).toBeChecked()
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
    expect(within(confirm).getByText(/for all 2 people on it/)).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('Leave encashment deleted')).toBeInTheDocument()
    expect(leaveEncashments.find('le_2')).toBeUndefined()
    expect(vouchers.all().some((voucher) => voucher.id.startsWith('vc_le_le_2_'))).toBe(false)
    expect(accountEntries.all().some((entry) => entry.id.startsWith('ae_le_le_2_'))).toBe(false)

    // Release Omer Farooq's slip: his payroll encashment is paid and can no longer change.
    const slip = payslips
      .all()
      .find((item) => item.employeeId === 'em_omer' && item.month === thisMonth)
    if (!slip) throw new Error('No pay slip for Omer Farooq')
    expect(slip.items.find((item) => item.payItemId === 'pi_leave_encashment')?.value).toBe(
      5 * daySalary('em_omer'),
    )
    payslips.update(slip.id, { ...slip, status: 'released' })
    await user.click(
      screen.getByRole('button', { name: `Actions for Sick Leave, Omer Farooq, ${String(year)}` }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const edit = await screen.findByRole('dialog', { name: 'Leave Encashment Edit' })
    expect(await within(edit).findByText(/was paid in the .* payroll/)).toBeVisible()
    expect(within(edit).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
