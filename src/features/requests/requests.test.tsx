import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format, isWeekend, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { attendancePunches } from '@/mocks/attendance/db'
import { punchRequests, shiftRequests } from '@/mocks/requests/db'
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

async function confirmYes(user: UserEvent) {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

describe('Punch requests', () => {
  it('lists my requests and creates one with the day’s expected times', async () => {
    const { user } = renderApp('/requests')

    expect(
      await screen.findByRole('heading', { name: 'Punch Request', level: 1 }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'RQ-PCH-0001' })).toBeVisible()
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

    const day = lastWeekday()
    await pickDate(user, /^Date/, day)
    await waitFor(() => {
      expect(
        within(dialog).getByRole('textbox', { name: 'Expected Check In Time' }),
      ).toHaveTextContent('09:00 AM')
    })
    await choose(user, /^Punch Type/, 'Break Out')
    fireEvent.change(within(dialog).getByLabelText(/^Punch Time/), { target: { value: '13:10' } })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Request submitted')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'All (4)' })).toBeVisible()
    // Sent as the API's details: { punchDate, punchType, punchTime }.
    const saved = punchRequests.all().find((record) => record.code === 'RQ-PCH-0012')
    expect(saved?.payload).toMatchObject({
      date: format(day, 'yyyy-MM-dd'),
      punchType: 'break_out',
      punchTime: '13:10',
    })
  })

  it('approves a request and adds the punch to Attendance', async () => {
    const { user } = renderApp('/requests/punch?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Punch Approvals' })).toBeVisible()
    await openAction(user, 'RQ-PCH-0008', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Approve/Reject' })
    expect(await within(dialog).findByText('Omar Siddiqui')).toBeVisible()
    await user.type(within(dialog).getByRole('textbox', { name: 'Approval Remarks' }), 'Checked')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)

    expect(await screen.findByText('Request approved')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        attendancePunches
          .all()
          .some((punch) => punch.description.startsWith('Punch request RQ-PCH-0008')),
      ).toBe(true)
    })
    expect(punchRequests.find('prq_8')?.status).toBe('completed')
  })

  it('needs a reason to reject', async () => {
    const { user } = renderApp('/requests/punch?tab=approvals')

    await openAction(user, 'RQ-PCH-0004', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Approve/Reject' })
    await within(dialog).findByText('Laiba Shah')
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }))
    expect(await within(dialog).findByText('Give a reason for rejecting')).toBeVisible()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks to cancel an approved request and withdraws a pending one', async () => {
    const { user } = renderApp('/requests/punch')

    await openAction(user, 'RQ-PCH-0002', 'Cancel')
    const dialog = await screen.findByRole('dialog', { name: 'Cancel approved request' })
    await user.click(within(dialog).getByRole('button', { name: 'Send for approval' }))
    expect(await within(dialog).findByText('Give a reason for cancellation')).toBeVisible()
    await user.type(
      within(dialog).getByRole('textbox', { name: /Reason for Cancellation/ }),
      'Wrong day',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Send for approval' }))
    expect(await screen.findByText('Cancellation requested')).toBeInTheDocument()
    const row = (await screen.findByRole('cell', { name: 'RQ-PCH-0002' })).closest('tr')
    if (!row) throw new Error('Row RQ-PCH-0002 missing')
    expect(await within(row).findByText('Cancelling')).toBeVisible()

    // A pending request is withdrawn at once.
    await openAction(user, 'RQ-PCH-0001', 'Withdraw')
    const withdraw = await screen.findByRole('dialog', { name: 'Withdraw request' })
    expect(within(withdraw).getByText(/withdrawn at once/)).toBeVisible()
    await user.type(
      within(withdraw).getByRole('textbox', { name: /Reason for Withdrawing/ }),
      'Not needed',
    )
    await user.click(within(withdraw).getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => {
      expect(punchRequests.find('prq_1')?.status).toBe('cancelled')
    })
  })

  it('shows the requests passed on to me under Delegates and cancellations to decide', async () => {
    const { user } = renderApp('/requests/punch?tab=approvals')

    await user.click(await screen.findByRole('tab', { name: 'Delegates' }))
    expect(await screen.findByRole('cell', { name: 'RQ-PCH-0006' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Cancellations' }))
    expect(await screen.findByRole('cell', { name: 'RQ-PCH-0010' })).toBeVisible()
    // One cancellation waiting for me: counted once, under Pending, and the counts add up.
    const tabs = screen.getByRole('list', { name: 'Requests by status' })
    await waitFor(() => {
      expect(within(tabs).getByRole('button', { name: 'All (1)' })).toBeVisible()
    })
    expect(within(tabs).getByRole('button', { name: 'Pending (1)' })).toBeVisible()
    expect(within(tabs).getByRole('button', { name: 'Cancelling (0)' })).toBeVisible()
    await user.click(within(tabs).getByRole('button', { name: 'Cancelling (0)' }))
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'RQ-PCH-0010' })).not.toBeInTheDocument()
    })
    await user.click(within(tabs).getByRole('button', { name: 'Pending (1)' }))
    await openAction(user, 'RQ-PCH-0010', 'Approve/Reject Cancellation')
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Approve/Reject' })
    expect(await within(dialog).findByText(/asks to cancel this approved request/)).toBeVisible()
  })
})

describe('Shift requests', () => {
  it('asks to swap a shift with a colleague, who consents first', async () => {
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
    const saved = shiftRequests.all().find((record) => record.code === 'RQ-SFT-0008')
    expect(saved?.payload.swapWithId).toBe('em_kaleem')
    // The colleague is asked first; the approvers wait until they answer.
    expect(saved?.consents).toEqual([{ personId: 'em_kaleem', status: 'pending', remarks: null }])
    expect(saved?.flow.every((step) => step.status === 'waiting')).toBe(true)
  })

  it('keeps a swap out of Approvals until the colleague consents', async () => {
    const { user } = renderApp('/requests/shift?tab=approvals')

    expect(await screen.findByRole('cell', { name: 'RQ-SFT-0007' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'RQ-SFT-0002' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Consents' }))
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'RQ-SFT-0007' })).not.toBeInTheDocument()
    })
  })

  it('changes the schedule when a new time slot is approved', async () => {
    const record = shiftRequests.find('srq_7')
    if (!record) throw new Error('Seed request srq_7 missing')
    const { user } = renderApp('/requests/shift?tab=approvals')

    await openAction(user, 'RQ-SFT-0007', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Shift Request Approve/Reject' })
    await within(dialog).findByText('Kaleem Murtaza')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)

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
