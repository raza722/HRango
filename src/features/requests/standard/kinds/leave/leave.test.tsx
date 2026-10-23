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

describe('Leave (the shared standard request pages)', () => {
  it('shows the balance card over my requests, and everyone’s on All Requests', async () => {
    const { user } = renderApp('/requests/leave')

    expect(await screen.findByRole('heading', { name: 'Leave Request' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Balance' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Request' })).toBeVisible()
    const card = screen.getByRole('table', { name: /leave balance/i })
    // Casual: 8 a year, one day approved. Sick: 15, a half day pending.
    expect(await within(card).findByRole('row', { name: 'Casual Leaves 8 1 7 0' })).toBeVisible()
    expect(within(card).getByRole('row', { name: 'Sick Leave 15 0 14.5 0.5' })).toBeVisible()

    expect(await screen.findByRole('cell', { name: 'LV-0007' })).toBeVisible()
    expect(screen.getByRole('cell', { name: /Short Leave/ })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'LV-0001' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All Requests' }))
    expect(await screen.findByRole('cell', { name: 'LV-0001' })).toBeVisible()
  })

  it('checks the fields and the balance, then saves a leave of the shift days', async () => {
    const { user } = renderApp('/requests/leave')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Leave Request Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the leave type')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    await choose(user, /^Leave Type/, 'Casual Leaves')
    expect(within(dialog).getByRole('textbox', { name: 'Available Leaves' })).toHaveValue('7')

    // Two working weeks: ten shift days, more than the seven available.
    const start = aMonday()
    await pickDate(user, /^Start Date/, start)
    await pickDate(user, /^End Date/, addDays(start, 11), start)
    await waitFor(() => {
      expect(within(dialog).getByText('Selected Days').nextElementSibling).toHaveTextContent('10')
    })
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Family wedding.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Only 7 available')).toBeVisible()

    // Monday to Wednesday: three shift days.
    await pickDate(user, /^End Date/, addDays(start, 2), addDays(start, 11))
    await waitFor(() => {
      expect(within(dialog).getByText('Selected Days').nextElementSibling).toHaveTextContent('3')
    })
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
    await choose(user, /^Leave Type/, 'Sick Leave')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Short' }))
    await choose(user, /^Short Leave Type/, 'Half Day')
    const date = nextWednesday(addDays(new Date(), 6))
    await pickDate(user, /^Request Date/, date)

    // The strip shows the day's shift; the times start with it and last half of it.
    const strip = await within(dialog).findByRole('region', { name: 'The day’s shift' })
    expect(await within(strip).findByText('09:00 AM - 05:00 PM')).toBeVisible()
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Start Time time')).toHaveValue('09:00')
    })
    expect(within(dialog).getByLabelText('End Time time')).toHaveValue('13:00')
    expect(within(dialog).getByText('Selected Days').nextElementSibling).toHaveTextContent('0.5')

    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Dentist.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(shelleysLeave().find((record) => record.payload.reason === 'Dentist.')).toBeDefined()
    })
    const saved = shelleysLeave().find((record) => record.payload.reason === 'Dentist.')
    expect(saved?.payload).toMatchObject({
      leaveTypeId: 'lt_sick',
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

    const record = standardRequests.find('lv_0001')
    expect(record?.status).toBe('completed')
    expect(balanceOf('em_sadia', 'lt_casual', standardRequests.all())).toMatchObject({
      availed: 2,
      pending: 0,
    })

    // Delegates: Bilal Ahmed's team.
    await user.click(screen.getByRole('tab', { name: 'Delegates' }))
    expect(await screen.findByRole('cell', { name: 'LV-0002' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Required Date' })).toBeVisible()
  })
})
