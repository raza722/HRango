import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format, isWeekend, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { attendancePunches } from '@/mocks/attendance/db'
import { shiftRequests } from '@/mocks/requests/db'
import { scheduleEntries } from '@/mocks/scheduling/handlers'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks the day, moving months if needed. */
async function pickDate(user: UserEvent, label: string | RegExp, date: Date) {
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', {
        name: months > 0 ? /next month/i : /previous month/i,
      }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }))
}

/** Today or the last weekday before it (a Morning Work shift day). */
function lastWeekday(): Date {
  let day = new Date()
  while (isWeekend(day)) day = subDays(day, 1)
  return day
}

function nextWeekday(): Date {
  let day = addDays(new Date(), 1)
  while (isWeekend(day)) day = addDays(day, 1)
  return day
}

async function openAction(user: UserEvent, code: string, action: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${code}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

describe('Punch requests', () => {
  it('lists my requests and creates one with the day’s expected times', async () => {
    const { user } = renderApp('/requests')

    expect(
      await screen.findByRole('heading', { name: 'Punch Request', level: 1 }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'RQ-ATT-0881' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'All (3)' })).toBeVisible()
    // The sidebar's Requests tree and the sub menu both mark Punch as the current page.
    expect(
      screen
        .getAllByRole('link', { name: 'Punch' })
        .some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the date')).toBeVisible()
    expect(within(dialog).getByText('Choose the punch type')).toBeVisible()

    await pickDate(user, /^Date/, lastWeekday())
    await waitFor(() => {
      expect(
        within(dialog).getByRole('textbox', { name: 'Expected Check In Time' }),
      ).toHaveTextContent('09:00 AM')
    })
    await choose(user, /^Punch Type/, 'Check Out')
    fireEvent.change(within(dialog).getByLabelText(/^Punch Time/), { target: { value: '17:40' } })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Request submitted')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'All (4)' })).toBeVisible()
  })

  it('approves a request and adds the punch to Attendance', async () => {
    const { user } = renderApp('/requests/punch?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Punch Approvals' })).toBeVisible()
    await openAction(user, 'RQ-ATT-0888', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Approve/Reject' })
    expect(await within(dialog).findByText('Omar Siddiqui')).toBeVisible()
    await user.type(within(dialog).getByRole('textbox', { name: 'Approval Remarks' }), 'Checked')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )

    expect(await screen.findByText('Request approved')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        attendancePunches
          .all()
          .some((punch) => punch.description.startsWith('Punch request RQ-ATT-0888')),
      ).toBe(true)
    })
  })

  it('needs a reason to reject', async () => {
    const { user } = renderApp('/requests/punch?tab=approvals')

    await openAction(user, 'RQ-ATT-0884', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Approve/Reject' })
    await within(dialog).findByText('Laiba Shah')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(await within(dialog).findByText('Give a reason for rejecting')).toBeVisible()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks to cancel a completed request', async () => {
    const { user } = renderApp('/requests/punch')

    await openAction(user, 'RQ-ATT-0882', 'Cancel')
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Cancel' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Give a reason for cancellation')).toBeVisible()
    await user.type(
      within(dialog).getByRole('textbox', { name: /Reason for Cancellation/ }),
      'Wrong day',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Cancellation requested')).toBeInTheDocument()
    const row = (await screen.findByRole('cell', { name: 'RQ-ATT-0882' })).closest('tr')
    if (!row) throw new Error('Row RQ-ATT-0882 missing')
    expect(await within(row).findByText('Cancelling')).toBeVisible()
  })

  it('shows the requests passed on to me under Delegates', async () => {
    const { user } = renderApp('/requests/punch?tab=approvals')

    await user.click(await screen.findByRole('tab', { name: 'Delegates' }))
    expect(await screen.findByRole('cell', { name: 'RQ-ATT-0886' })).toBeVisible()
    expect(screen.getAllByRole('cell', { name: 'Bilal Ahmed' }).length).toBeGreaterThan(0)
  })
})

describe('Shift requests', () => {
  it('asks to swap a shift with a colleague', async () => {
    const { user } = renderApp('/requests/shift')

    const form = await screen.findByRole('form', { name: 'Shift Request' })
    await pickDate(user, /^Date/, nextWeekday())
    await waitFor(() => {
      expect(within(form).getByRole('textbox', { name: 'Swap From' })).toHaveTextContent(
        'Morning Work',
      )
    })
    await choose(user, 'Swap To', /^Kaleem Murtaza/)
    await user.type(
      within(form).getByRole('textbox', { name: /Description/ }),
      'Swapping for a training day',
    )
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    // Earlier tests' toasts may still be on screen, so check the new row.
    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    expect(await screen.findByRole('cell', { name: 'Kaleem Murtaza' })).toBeVisible()
  })

  it('waits for the colleague’s consent before approving a swap', async () => {
    const { user } = renderApp('/requests/shift?tab=approvals')

    await openAction(user, 'RQ-SFT-0142', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Shift Request Approve/Reject' })
    await within(dialog).findByText('Sadia Rehman')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect(await within(dialog).findByText(/Waiting for Laiba Shah.s consent/)).toBeVisible()
  })

  it('changes the schedule when a roster change is approved', async () => {
    const record = shiftRequests.find('srq_7')
    if (!record) throw new Error('Seed request srq_7 missing')
    const { user } = renderApp('/requests/shift?tab=approvals')

    await openAction(user, 'RQ-SFT-0147', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Shift Request Approve/Reject' })
    await within(dialog).findByText('Kaleem Murtaza')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )

    await waitFor(() => {
      const entry = scheduleEntries
        .all()
        .find((item) => item.employeeId === 'em_kaleem' && item.date === record.payload.date)
      expect(entry).toMatchObject({
        rosterGroupId: 'rg_morning',
        clockIn: '09:00',
        clockOut: '17:00',
      })
    })
  })
})
