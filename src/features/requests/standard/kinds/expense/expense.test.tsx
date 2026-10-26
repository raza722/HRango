import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { standardRequests } from '@/mocks/requests/standard'
import { expenseCategories, reimbursementSetting } from '@/mocks/requests/standard/kinds/expense'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, scope: HTMLElement, label: RegExp, option: string | RegExp) {
  await user.click(within(scope).getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function openAction(user: UserEvent, code: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${code}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

const confirmYes = async (user: UserEvent) => {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

async function fillClaim(
  user: UserEvent,
  claim: HTMLElement,
  values: { title: string; category: string; amount: string; description: string },
) {
  await user.type(
    within(claim).getByRole('textbox', { name: /^Expense Claim Title/ }),
    values.title,
  )
  await choose(user, claim, /^Expense Claim Category/, values.category)
  await user.type(within(claim).getByRole('textbox', { name: /^Amount/ }), values.amount)
  await user.type(within(claim).getByRole('textbox', { name: /^Description/ }), values.description)
}

describe('Expense claims (the shared standard request pages)', () => {
  it('lists my claims and everyone’s, and submits several claims as one request', async () => {
    const { user } = renderApp('/requests/expense')

    expect(await screen.findByRole('heading', { name: 'Expense Claims' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'EXP-0002' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'EXP-0001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All Claims' }))
    expect(await screen.findByRole('cell', { name: 'EXP-0001' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'My Claims' }))
    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Claim Expense' })
    await user.click(within(dialog).getByRole('button', { name: 'Submit All' }))
    expect(await within(dialog).findByText('Enter the claim title')).toBeVisible()
    expect(within(dialog).getByText('Choose the category')).toBeVisible()

    await fillClaim(user, within(dialog).getByRole('region', { name: 'Claim 1' }), {
      title: 'Projector hire',
      category: 'Equipment & Supplies',
      amount: '4500',
      description: 'For the town hall.',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Generate Claim' }))
    // Travel Fee needs the receipt: refused until one is attached.
    await fillClaim(user, within(dialog).getByRole('region', { name: 'Claim 2' }), {
      title: 'Taxi',
      category: 'Travel Fee',
      amount: '1200',
      description: 'Airport run.',
    })
    expect(within(dialog).getByText(/PKR 5,700\.00/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Submit All' }))
    expect(await within(dialog).findByText('Attach the receipt')).toBeVisible()

    await user.click(
      within(within(dialog).getByRole('region', { name: 'Claim 2' })).getByRole('button', {
        name: 'Remove claim 2',
      }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Submit All' }))
    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find(
            (record) =>
              record.kind === 'expense' &&
              record.employeeId === 'em_shelley' &&
              record.code !== 'EXP-0002',
          ),
      ).toMatchObject({
        status: 'pending',
        payload: {
          lines: [{ title: 'Projector hire', expenseCategoryId: 'ec_equipment', amount: 4500 }],
        },
      })
    })
  }, 30_000)

  it('approves a claim with one line lowered', async () => {
    const { user } = renderApp('/requests/expense?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Expense Approvals' })).toBeVisible()
    await openAction(user, 'EXP-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Expense Approve/Reject' })
    const licence = await within(dialog).findByRole('textbox', { name: /^Design licence/ })
    expect(licence).toHaveValue('12000')
    await user.clear(licence)
    await user.type(licence, '10000')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(standardRequests.find('exp_0001')?.status).toBe('completed')
    })
    expect(standardRequests.find('exp_0001')?.payload).toMatchObject({
      lines: [{ approvedAmount: 2500 }, { approvedAmount: 10000 }],
    })
  }, 30_000)

  it('creates, switches off and deletes an expense category under Settings', async () => {
    const { user } = renderApp('/requests/expense?tab=settings')

    expect(await screen.findByRole('cell', { name: 'Travel Fee' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Expense Category Create' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Courier')
    await user.type(within(dialog).getByRole('textbox', { name: /^Max Amount Per Claim/ }), '3000')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Receipt Required' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('cell', { name: 'Courier' })).toBeVisible()
    const created = expenseCategories.all().find((item) => item.name === 'Courier')
    expect(created).toMatchObject({ maxAmount: 3000, receiptRequired: true, isActive: true })

    await openAction(user, 'Courier', 'Inactivate')
    await waitFor(() => {
      expect(expenseCategories.all().find((item) => item.name === 'Courier')?.isActive).toBe(false)
    })

    await openAction(user, 'Courier', 'Delete')
    await confirmYes(user)
    await waitFor(() => {
      expect(expenseCategories.all().some((item) => item.name === 'Courier')).toBe(false)
    })

    // A category with claims cannot be deleted.
    await openAction(user, 'Travel Fee', 'Delete')
    await confirmYes(user)
    await waitFor(() => {
      expect(expenseCategories.find('ec_travel')).toBeDefined()
    })
  }, 30_000)

  it('saves the reimbursement pay items', async () => {
    const { user } = renderApp('/requests/expense?tab=settings&section=reimbursement')

    const expense = await screen.findByRole('combobox', { name: 'Expense Pay Item' })
    await waitFor(() => {
      expect(expense).toHaveTextContent('Expense Reimbursement')
    })
    await user.click(screen.getByRole('combobox', { name: 'Air Ticket Pay Item' }))
    // The current items are always offered (Payroll's list may be another mock's).
    await user.click(await screen.findByRole('option', { name: 'Expense Reimbursement' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('Reimbursement pay items saved')).length).toBeGreaterThan(0)
    expect(reimbursementSetting().airTicketPayItemId).toBe('pi_reimb_expense')
  }, 30_000)
})
