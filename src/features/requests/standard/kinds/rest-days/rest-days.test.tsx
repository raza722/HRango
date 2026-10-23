import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { standardRequests } from '@/mocks/requests/standard'
import { scheduleEntries } from '@/mocks/scheduling/handlers'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/**
 * Opens a date field's calendar and picks the day, moving months if needed.
 * The calendar opens on its earliest allowed day's month (`opensOn`).
 */
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

const confirmYes = async (user: UserEvent) => {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

describe('Rest Days (the shared standard request pages)', () => {
  it('lists my requests and everyone’s, and submits a new one', async () => {
    const { user } = renderApp('/requests/rest-days')

    expect(await screen.findByRole('heading', { name: 'Rest Days Requests' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'RD-006' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'RD-001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All Requests' }))
    expect(await screen.findByRole('cell', { name: 'RD-001' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'My Requests' }))
    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Rest Day Request' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the roster')).toBeVisible()

    await choose(user, /^Roster/, /^Morning Work/)
    const from = addDays(new Date(), 40)
    await pickDate(user, /^Date \(from\)/, from)
    await pickDate(user, /^Date \(to\)/, addDays(from, 6), from)
    expect(within(dialog).getByText('Selected Days').nextElementSibling).not.toHaveTextContent(
      /^0$/,
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .filter((record) => record.kind === 'rest-days' && record.employeeId === 'em_shelley'),
      ).toHaveLength(3)
    })
  })

  it('approves a request into rest days on the schedule', async () => {
    const { user } = renderApp('/requests/rest-days?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Rest Days Approvals' })).toBeVisible()
    await openAction(user, 'RD-001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Rest Days Approve/Reject' })
    expect((await within(dialog).findAllByText('Sadia Rehman')).length).toBeGreaterThan(0)

    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(await within(dialog).findByText('Give a reason for rejecting')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    const record = standardRequests.find('rd_001')
    expect(record?.status).toBe('completed')
    const dates = (record?.payload.dates ?? []) as string[]
    expect(dates.length).toBeGreaterThan(0)
    for (const date of dates) {
      expect(
        scheduleEntries
          .all()
          .find((entry) => entry.employeeId === 'em_sadia' && entry.date === date),
      ).toMatchObject({ kind: 'rest', restDayPayable: true })
    }
  })

  it('approves a cancellation from Cancellations', async () => {
    const { user } = renderApp('/requests/rest-days?tab=approvals&view=cancellations')

    await openAction(user, 'RD-005', 'Approve/Reject Cancellation')
    const dialog = await screen.findByRole('dialog', {
      name: 'Rest Days Cancellation Approve/Reject',
    })
    expect(await within(dialog).findByText(/Moving house/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('rd_005')?.status).toBe('cancelled')
    })
  })

  it('approves a delegated request with the bulk button', async () => {
    const { user } = renderApp('/requests/rest-days?tab=approvals&view=delegates')

    expect(await screen.findByRole('cell', { name: 'RD-002' })).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Select RD-002' }))
    await user.click(screen.getByRole('button', { name: 'Approved' }))
    await confirmYes(user)

    expect(await screen.findByText('1 request approved')).toBeInTheDocument()
    const record = standardRequests.find('rd_002')
    expect(record?.flow[0]).toMatchObject({ status: 'approved', actedById: 'em_shelley' })
    expect(record?.status).toBe('pending')
  })
})
