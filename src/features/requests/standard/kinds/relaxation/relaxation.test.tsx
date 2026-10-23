import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format, isWeekend } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { attendanceEdits, dayId } from '@/mocks/attendance/db'
import { standardRequests } from '@/mocks/requests/standard'
import { requestStandardCancel } from '@/mocks/requests/standard/engine'
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

/** A weekday a week or more ahead: Shelley works Morning Work (09:00–17:00) that day. */
function nextWorkday(): Date {
  let date = addDays(new Date(), 9)
  while (isWeekend(date)) date = addDays(date, 1)
  return date
}

describe('Relaxation (the shared standard request pages)', () => {
  it('lists my requests and everyone’s, and keeps a new one inside the shift', async () => {
    const { user } = renderApp('/requests/relaxation')

    expect(await screen.findByRole('heading', { name: 'Relaxation Requests' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'RLX-0006' })).toBeVisible()
    expect(screen.queryByRole('cell', { name: 'RLX-0001' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('cell', { name: /^\d+h/ }).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'All Requests' }))
    expect(await screen.findByRole('cell', { name: 'RLX-0001' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'My Requests' }))
    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Relaxation Request' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the date')).toBeVisible()
    expect(within(dialog).getByText('Choose the start time')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    const date = nextWorkday()
    await pickDate(user, /^Date/, date)
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox', { name: 'Time Slot' })).toHaveValue(
        'Morning Work (09:00 AM - 05:00 PM)',
      )
    })

    // Before the shift starts: refused.
    fireEvent.change(within(dialog).getByLabelText(/^Start Time/), { target: { value: '07:00' } })
    fireEvent.change(within(dialog).getByLabelText(/^End Time/), { target: { value: '08:00' } })
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'School meeting.')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('Choose a time inside the shift (09:00 AM - 05:00 PM)'),
    ).toBeVisible()

    // The last four hours of the shift: accepted.
    fireEvent.change(within(dialog).getByLabelText(/^Start Time/), { target: { value: '13:00' } })
    fireEvent.change(within(dialog).getByLabelText(/^End Time/), { target: { value: '17:00' } })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await screen.findAllByText('Request submitted')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(
        standardRequests
          .all()
          .find(
            (record) =>
              record.kind === 'relaxation' &&
              record.employeeId === 'em_shelley' &&
              record.payload.date === format(date, 'yyyy-MM-dd'),
          ),
      ).toMatchObject({
        status: 'pending',
        payload: { startTime: '13:00', endTime: '17:00', slotName: 'Morning Work' },
      })
    })
  }, 30_000)

  it('approves with a reason, relaxes the attendance day, and undoes it on cancellation', async () => {
    const { user } = renderApp('/requests/relaxation?tab=approvals')

    expect(await screen.findByRole('heading', { name: 'Relaxation Approvals' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Approved' })).not.toBeInTheDocument()
    await openAction(user, 'RLX-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Relaxation Approve/Reject' })
    expect((await within(dialog).findAllByText('Sadia Rehman')).length).toBeGreaterThan(0)

    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    expect(await within(dialog).findByText('Give a reason for approval')).toBeVisible()
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Reason for Approval/ }),
      'Appointment letter seen.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    expect((await screen.findAllByText('Request approved')).length).toBeGreaterThan(0)

    const record = standardRequests.find('rlx_0001')
    expect(record?.status).toBe('completed')
    const date = String(record?.payload.date)
    expect(attendanceEdits.find(dayId('em_sadia', date))?.relaxationReason).toMatch(/RLX-0001/)

    // Sadia asks to cancel it; approving the cancellation takes the relaxation off the day.
    if (record) {
      standardRequests.update(
        record.id,
        requestStandardCancel(
          { settingsType: 'relaxation' },
          record,
          'The appointment moved.',
          new Date().toISOString(),
        ),
      )
    }
    await user.click(screen.getByRole('tab', { name: 'Cancellations' }))
    await openAction(user, 'RLX-0001', 'Approve/Reject Cancellation')
    const cancel = await screen.findByRole('dialog', {
      name: 'Relaxation Cancellation Approve/Reject',
    })
    await user.click(within(cancel).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('rlx_0001')?.status).toBe('cancelled')
    })
    expect(attendanceEdits.find(dayId('em_sadia', date))?.relaxationReason).toBeUndefined()
  }, 30_000)

  it('shows a delegated request’s flow under the Relaxation title', async () => {
    const { user } = renderApp('/requests/relaxation?tab=approvals&view=delegates')

    await openAction(user, 'RLX-0002', 'Flow')
    const dialog = await screen.findByRole('dialog', { name: 'Relaxation Request Flow' })
    expect(within(dialog).getAllByText('Bilal Ahmed').length).toBeGreaterThan(0)
  })
})
