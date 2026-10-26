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

describe('Air ticket claims (the shared standard request pages)', () => {
  it('submits a claim and refuses a second one for the same travel date', async () => {
    const { user } = renderApp('/requests/air-tickets')

    expect(await screen.findByRole('heading', { name: 'Air Ticket Claims' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'AIR-0002' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'AIR-0001' })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Air Ticket Claim' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the title')).toBeVisible()
    expect(within(dialog).getByText('Choose the travel date')).toBeVisible()
    expect(within(dialog).getByText('Enter an amount above 0')).toBeVisible()

    const travel = addDays(new Date(), 30)
    await user.type(within(dialog).getByRole('textbox', { name: /^Title/ }), 'Karachi expo')
    await pickDate(user, /^Travel Date/, travel)
    await user.type(within(dialog).getByRole('textbox', { name: /^From/ }), 'Lahore')
    await user.type(within(dialog).getByRole('textbox', { name: /^To/ }), 'Karachi')
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '28000')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find(
            (record) => record.kind === 'air-tickets' && record.payload.title === 'Karachi expo',
          ),
      ).toMatchObject({
        employeeId: 'em_shelley',
        status: 'pending',
        payload: { travelDate: format(travel, 'yyyy-MM-dd'), amount: 28000, toPlace: 'Karachi' },
      })
    })

    // The same travel date again: refused by the API (AIR_TICKET_DUPLICATE).
    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const again = await screen.findByRole('dialog', { name: 'Air Ticket Claim' })
    await user.type(within(again).getByRole('textbox', { name: /^Title/ }), 'Same day')
    await pickDate(user, /^Travel Date/, travel)
    await user.type(within(again).getByRole('textbox', { name: /^Amount/ }), '1000')
    await user.click(within(again).getByRole('button', { name: 'Save' }))
    expect(await within(again).findByText(/already claimed a ticket/)).toBeVisible()
  }, 30_000)

  it('approves a claim at a lower amount', async () => {
    const { user } = renderApp('/requests/air-tickets?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Air Ticket Approvals' })).toBeVisible()
    await openAction(user, 'AIR-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Air Ticket Approve/Reject' })
    const approved = await within(dialog).findByRole('textbox', { name: /^Approved Amount/ })
    expect(approved).toHaveValue('32000')
    await user.clear(approved)
    await user.type(approved, '30000')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(standardRequests.find('air_0001')).toMatchObject({
        status: 'completed',
        payload: { approvedAmount: 30000 },
      })
    })
  }, 30_000)
})
