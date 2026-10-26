import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { standardRequests } from '@/mocks/requests/standard'
import { renderApp } from '@/test/test-utils'

/** Opens a date field's calendar (on today's month) and picks the day. */
async function pickDate(user: UserEvent, label: RegExp, date: Date) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
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

const confirmYes = async (user: UserEvent) => {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

describe('Requisitions (the shared standard request pages)', () => {
  it('submits a requisition with two items', async () => {
    const { user } = renderApp('/requests/requisition')

    expect(await screen.findByRole('heading', { name: 'Requisitions' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'RQN-0002' })).toBeVisible()

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Requisition' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the title')).toBeVisible()
    expect(within(dialog).getByText('Choose the type')).toBeVisible()
    expect(within(dialog).getByText('Give the justification')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: /^Title/ }), 'Chairs')
    await user.click(within(dialog).getByRole('combobox', { name: /^Type/ }))
    await user.click(await screen.findByRole('option', { name: 'Furniture' }))
    const needed = addDays(new Date(), 10)
    await pickDate(user, /^Needed By/, needed)
    const first = within(dialog).getByRole('region', { name: 'Item 1' })
    await user.type(within(first).getByRole('textbox', { name: /^Item/ }), 'Office chair')
    await user.clear(within(first).getByRole('textbox', { name: /^Quantity/ }))
    await user.type(within(first).getByRole('textbox', { name: /^Quantity/ }), '4')
    await user.type(within(first).getByRole('textbox', { name: /^Estimated Unit Cost/ }), '15000')
    await user.click(within(dialog).getByRole('button', { name: 'Add Item' }))
    const second = within(dialog).getByRole('region', { name: 'Item 2' })
    await user.type(within(second).getByRole('textbox', { name: /^Item/ }), 'Desk')
    expect(within(dialog).getByText('PKR 60,000.00')).toBeVisible()
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Justification/ }),
      'The new team needs seats.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find((record) => record.kind === 'requisition' && record.payload.title === 'Chairs'),
      ).toMatchObject({
        status: 'pending',
        payload: {
          requisitionType: 'furniture',
          neededByDate: format(needed, 'yyyy-MM-dd'),
          reason: 'The new team needs seats.',
          lines: [
            { itemName: 'Office chair', quantity: 4, estimatedUnitCost: 15000 },
            { itemName: 'Desk', quantity: 1, estimatedUnitCost: null },
          ],
        },
      })
    })
  }, 30_000)

  it('approves a requisition and shows its items', async () => {
    const { user } = renderApp('/requests/requisition?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Requisition Approvals' })).toBeVisible()
    await openAction(user, 'RQN-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Requisition Approve/Reject' })
    expect(await within(dialog).findByRole('cell', { name: 'Laptop' })).toBeVisible()
    expect(within(dialog).getByText('PKR 500,000.00')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('rqn_0001')?.status).toBe('completed')
    })
  }, 30_000)
})
