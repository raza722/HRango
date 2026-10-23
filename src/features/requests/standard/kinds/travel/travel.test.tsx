import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { standardRequests } from '@/mocks/requests/standard'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar (on its earliest allowed month) and picks the day. */
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

/** Clicks the box and pastes the text (much faster than typing it). */
async function fill(user: UserEvent, element: HTMLElement, text: string) {
  await user.click(element)
  await user.paste(text)
}

const setTime = (label: RegExp | string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('Travel (the shared standard request pages)', () => {
  it('lists my requests and everyone’s', async () => {
    const { user } = renderApp('/requests/travel')

    expect(await screen.findByRole('heading', { name: 'Travel Request' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'TR-0006' }, { timeout: 5000 })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'TR-0001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All Requests' }))
    expect(await screen.findByRole('cell', { name: 'TR-0001' })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Pending \(\d+\)$/ })).toBeVisible()
  })

  it(
    'submits a request with a travel detail, a hotel and a ticket',
    { timeout: 40_000 },
    async () => {
      const { user } = renderApp('/requests/travel')

      await user.click(await screen.findByRole('button', { name: 'Create' }))
      const dialog = await screen.findByRole('dialog', { name: 'Travel Request Create' })
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(await within(dialog).findByText('Give the purpose of the travel')).toBeVisible()
      expect(within(dialog).getByText('Add at least one travel detail')).toBeVisible()

      await fill(user, within(dialog).getByLabelText(/^Purpose/), 'Client workshop in Karachi.')
      await user.click(within(dialog).getByRole('checkbox', { name: 'Advance Required' }))
      await fill(user, within(dialog).getByLabelText('Advance 1 Amount'), '40000')

      // Travel Detail Create.
      await user.click(within(dialog).getByRole('button', { name: 'Add travel detail' }))
      const leg = await screen.findByRole('dialog', { name: 'Travel Detail Create' })
      await choose(user, /^Travel Type/, 'Domestic')
      await fill(user, within(leg).getByLabelText(/^Departure From/), 'Lahore')
      await fill(user, within(leg).getByLabelText(/^Arrival at/), 'Karachi')
      await choose(user, /^Travel Mode/, 'Air')
      await fill(user, within(leg).getByLabelText(/^Distance/), '1030')
      const from = addDays(new Date(), 40)
      const to = addDays(from, 2)
      await pickDate(user, /^From Date/, from)
      setTime(/^From Time/, '09:00')
      await pickDate(user, /^To Date/, to, from)
      setTime(/^To Time/, '18:00')

      await user.click(within(leg).getByRole('checkbox', { name: /^Stay Required/ }))
      expect(within(leg).getByLabelText('Hotel 1 Night')).toHaveValue('2')
      await fill(user, within(leg).getByLabelText('Hotel 1 Address'), 'Harbour View Hotel, Clifton')
      await fill(user, within(leg).getByLabelText('Hotel 1 Phone No'), '021-3583-1111')
      await fill(user, within(leg).getByLabelText('Hotel 1 Email'), 'stay@harbourview.example')

      // Air travel needs its ticket.
      await user.click(within(leg).getByRole('button', { name: 'Save' }))
      expect(await within(leg).findByText('Add the ticket booking')).toBeVisible()
      await user.click(within(leg).getByRole('button', { name: 'Add ticket booking' }))
      await fill(user, within(leg).getByLabelText('Ticket 1 Ticket No'), 'PK-304')
      setTime('Ticket 1 Time', '07:30')
      await user.click(within(leg).getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: 'Travel Detail Create' }),
        ).not.toBeInTheDocument()
      })
      expect(within(dialog).getByRole('cell', { name: 'Karachi' })).toBeVisible()
      expect(
        within(dialog).getByRole('cell', { name: format(from, 'MMMM d, yyyy') + ' 09:00 AM' }),
      ).toBeVisible()

      await user.click(within(dialog).getByRole('button', { name: 'Regenerate' }))
      expect(within(dialog).getByRole('textbox', { name: 'Application' })).toHaveTextContent(
        /Subject: Travel Request from Lahore to Karachi/,
      )

      await user.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)

      await waitFor(() => {
        expect(
          standardRequests
            .all()
            .filter((record) => record.kind === 'travel' && record.employeeId === 'em_shelley'),
        ).toHaveLength(3)
      })
      const record = standardRequests
        .all()
        .find((item) => item.kind === 'travel' && item.code === 'TR-0010')
      expect(record?.payload).toMatchObject({
        purpose: 'Client workshop in Karachi.',
        advanceRequired: true,
        advances: [{ amount: 40_000, currency: 'PKR' }],
        details: [
          {
            departureFrom: 'Lahore',
            arrivalAt: 'Karachi',
            travelMode: 'air',
            distanceKm: 1030,
            stayRequired: true,
            hotels: [{ nights: 2, city: 'Karachi', stayType: 'hotel' }],
            tickets: [{ ticketNo: 'PK-304', time: '07:30', date: format(from, 'yyyy-MM-dd') }],
          },
        ],
      })
    },
  )

  it('approves a request after looking at its hotel booking', async () => {
    const { user } = renderApp('/requests/travel?tab=approvals')

    expect(await screen.findByRole('cell', { name: 'TR-0001' }, { timeout: 5000 })).toBeVisible()
    await openAction(user, 'TR-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Travel Approve/Reject' })
    expect(
      await within(dialog).findByText('Campus hiring drive at the university job fair.'),
    ).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'View Multan to Lahore' }))
    const leg = await screen.findByRole('dialog', { name: 'Travel Detail View' })
    expect(within(leg).getByLabelText('Hotel 1 Address')).toHaveValue(
      'Lahore Grand Hotel, Mall Road',
    )
    await user.click(within(leg).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Travel Detail View' })).not.toBeInTheDocument()
    })

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)
    expect(standardRequests.find('tr_001')?.status).toBe('completed')
  })

  it('shows Bilal Ahmed’s team under Delegates', async () => {
    renderApp('/requests/travel?tab=approvals&view=delegates')
    expect(await screen.findByRole('cell', { name: 'TR-0002' }, { timeout: 5000 })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'TR-0001' })).not.toBeInTheDocument()
  })
})
