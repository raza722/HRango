import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { salaryRevisions } from '@/mocks/payroll/db'
import { salaryOn } from '@/mocks/payroll/engine'
import { standardRequests } from '@/mocks/requests/standard'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function pickDate(user: UserEvent, label: RegExp, date: Date, opensOn = new Date()) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, opensOn)
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }))
}

async function openAction(user: UserEvent, code: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${code}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

const today = () => format(new Date(), 'yyyy-MM-dd')
const amount = (value: number) => value.toLocaleString('en-US')

describe('Promotion (the shared standard request pages)', () => {
  it('lists everyone’s requests and submits one against the current salary', async () => {
    const { user } = renderApp('/requests/promotion')

    expect(await screen.findByRole('heading', { name: 'Promotion Requests' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'PR-0001' }, { timeout: 5000 })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'PR-0006' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Promotion Request Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the employee')).toBeVisible()
    expect(within(dialog).getByText('Give the salary')).toBeVisible()

    await choose(user, /^Employee/, /^Hina Raza/)
    const previous = salaryOn('em_hina', today())
    expect(within(dialog).getByRole('status')).toHaveTextContent(amount(previous))
    // Grade and Job Title start from what she holds now.
    expect(within(dialog).getByRole('combobox', { name: /^Job Title/ })).toHaveTextContent(
      'Finance Manager',
    )

    await choose(user, /^Level/, 'L3')
    await choose(user, /^Designation/, 'Senior Manager')
    // A promotion cannot lower the salary.
    await user.click(within(dialog).getByLabelText(/^Salary/))
    await user.paste(String(previous - 1000))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Medical' }))
    const effective = addDays(new Date(), 10)
    await pickDate(user, /^Effective Date/, effective)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText(`At least ${amount(previous)}`)).toBeVisible()

    await user.clear(within(dialog).getByLabelText(/^Salary/))
    await user.paste(String(previous + 50_000))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find((record) => record.kind === 'promotion' && record.employeeId === 'em_hina')
          ?.payload,
      ).toMatchObject({
        demotion: false,
        designation: 'Senior Manager',
        level: 'L3',
        jobTitle: 'Finance Manager',
        previousSalary: previous,
        salary: previous + 50_000,
        benefits: ['pi_medical'],
        effectiveDate: format(effective, 'yyyy-MM-dd'),
      })
    })
  })

  it('approves a promotion into a Payroll salary revision', async () => {
    const { user } = renderApp('/requests/promotion?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Promotion Approvals' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'PR-0001' }, { timeout: 5000 })).toBeVisible()
    await openAction(user, 'PR-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Promotion Approve/Reject' })
    const record = standardRequests.find('pr_001')
    const payload = record?.payload as { previousSalary: number; salary: number }
    expect(await within(dialog).findByText(amount(payload.previousSalary))).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(standardRequests.find('pr_001')?.status).toBe('completed')
    })
    const effectiveDate = (record?.payload as { effectiveDate: string }).effectiveDate
    expect(
      salaryRevisions
        .all()
        .find((item) => item.employeeId === 'em_sadia' && item.effectiveDate === effectiveDate),
    ).toMatchObject({ type: 'flat', salary: payload.salary })
    expect(salaryOn('em_sadia', effectiveDate)).toBe(payload.salary)
  })

  it('shows Bilal Ahmed’s team under Delegates', async () => {
    renderApp('/requests/promotion?tab=approvals&view=delegates')
    expect(await screen.findByRole('cell', { name: 'PR-0002' }, { timeout: 5000 })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'PR-0001' })).not.toBeInTheDocument()
  })
})
