import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format, nextMonday, nextWednesday } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { standardRequests } from '@/mocks/requests/standard'
import { balanceOf } from '@/mocks/requests/standard/kinds/leave'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar (on `opensOn`'s month) and picks the day. */
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

const shelleysLeave = () =>
  standardRequests
    .all()
    .filter((record) => record.kind === 'leave' && record.employeeId === 'em_shelley')

/** A weekday a week or more ahead, clear of the seeded requests. */
const aMonday = () => nextMonday(addDays(new Date(), 6))

describe('Leave (the shared standard request pages, on /requests/leave)', () => {
  it('shows the balance card over my requests, and everyone’s on All Requests', async () => {
    const { user } = renderApp('/requests/leave')

    expect(await screen.findByRole('heading', { name: 'Leave Request' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Balance' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Request' })).toBeVisible()
    // The card reads GET /leaves/balances (the signed-in person's own).
    const card = screen.getByRole('table', { name: /leave balance/i })
    expect(await within(card).findByRole('rowheader', { name: 'Casual Leaves' })).toBeVisible()

    expect(await screen.findByRole('cell', { name: 'LV-0007' })).toBeVisible()
    expect(screen.getByRole('cell', { name: /Short Leave/ })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'LV-0001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All Requests' }))
    expect(await screen.findByRole('cell', { name: 'LV-0001' })).toBeVisible()
  })

  it('checks the fields, then saves a leave of the shift days', async () => {
    const { user } = renderApp('/requests/leave')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Leave Request Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the leave type')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    await choose(user, /^Leave Type/, /^Casual Leaves/)
    // Monday to Wednesday: three shift days on the person's schedule.
    const start = aMonday()
    await pickDate(user, /^Start Date/, start)
    await pickDate(user, /^End Date/, addDays(start, 2), start)
    await waitFor(() => {
      expect(within(dialog).getByText('Selected Days').nextElementSibling).toHaveTextContent('3')
    })
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Family wedding.')

    expect(within(dialog).getByRole('button', { name: 'Attach a file' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(shelleysLeave()).toHaveLength(4)
    })
    const saved = shelleysLeave().find((record) => record.payload.reason === 'Family wedding.')
    expect(saved?.payload).toMatchObject({ leaveTypeId: 'lt_casual', short: false, count: 3 })
  }, 30_000)

  it('saves a short leave inside the day’s shift', async () => {
    const { user } = renderApp('/requests/leave')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Leave Request Create' })
    await choose(user, /^Leave Type/, /^Casual Leaves/)
    await user.click(within(dialog).getByRole('checkbox', { name: 'Short' }))
    await choose(user, /^Short Leave Type/, 'Half Day')
    const date = nextWednesday(addDays(new Date(), 6))
    await pickDate(user, /^Request Date/, date)

    // The strip shows the day's shift; the times start with it and last half of it.
    const strip = await within(dialog).findByRole('region', { name: 'The day’s shift' })
    expect(await within(strip).findByText('09:00 AM - 05:00 PM')).toBeVisible()
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/^Start Time/)).toHaveValue('09:00')
    })
    expect(within(dialog).getByLabelText(/^End Time/)).toHaveValue('13:00')
    expect(within(dialog).getByText('Selected Days').nextElementSibling).toHaveTextContent('0.5')

    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Dentist.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(shelleysLeave().find((record) => record.payload.reason === 'Dentist.')).toBeDefined()
    })
    const saved = shelleysLeave().find((record) => record.payload.reason === 'Dentist.')
    expect(saved?.payload).toMatchObject({
      leaveTypeId: 'lt_casual',
      short: true,
      shortType: 'half-day',
      from: format(date, 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '13:00',
      count: 0.5,
    })
  }, 30_000)

  it('approves a request, showing the person’s balance, and counts it as availed', async () => {
    const { user } = renderApp('/requests/leave?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Approvals' })).toBeVisible()
    await openAction(user, 'LV-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Leave Approve/Reject' })
    expect((await within(dialog).findAllByText('Sadia Rehman')).length).toBeGreaterThan(0)
    expect(within(dialog).getByText('Total Leaves')).toBeVisible()
    expect(within(dialog).getByText('Availed Leaves')).toBeVisible()
    expect(within(dialog).getByText('Casual Leaves')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    expect(standardRequests.find('lv_0001')?.status).toBe('completed')
    expect(balanceOf('em_sadia', 'lt_casual', standardRequests.all())).toMatchObject({
      availed: 2,
      pending: 0,
    })
  })

  it('decides a cancellation from Cancellations', async () => {
    const { user } = renderApp('/requests/leave?tab=approvals&view=cancellations')

    await openAction(user, 'LV-0005', 'Approve/Reject Cancellation')
    const dialog = await screen.findByRole('dialog', { name: 'Leave Cancellation Approve/Reject' })
    expect(await within(dialog).findByText(/Plans changed/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('lv_0005')?.status).toBe('cancelled')
    })
  })
})
