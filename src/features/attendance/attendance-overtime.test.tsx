import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { differenceInCalendarMonths, format, parse } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { attendanceEdits, dayId } from '@/mocks/attendance/db'
import {
  overtimePolicies,
  overtimeSettingsStore,
  recentWorkday,
} from '@/mocks/attendance/overtime-db'
import { standardRequests } from '@/mocks/requests/standard'
import { renderApp } from '@/test/test-utils'

import { dayLabel } from './utils/overtime-format'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks the day, moving months if needed. */
async function pickDate(user: UserEvent, label: string | RegExp, date: string) {
  const day = parse(date, 'yyyy-MM-dd', new Date())
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(day, new Date())
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(day, 'MMMM do, yyyy')) }))
}

async function openAction(user: UserEvent, row: string, action: string | RegExp) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${row}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

const confirmYes = async (user: UserEvent) => {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
  )
}

const overtimeNav = () => screen.getByRole('navigation', { name: 'Overtime' })

/** The overtime requests of the shared request table. */
const overtimeRequests = () => standardRequests.all().filter((record) => record.kind === 'overtime')
const payloadOf = (id: string) =>
  standardRequests.find(id)?.payload as
    { overtimeDate: string; appliedMinutes: number; approvedMinutes: number | null } | undefined

describe('Attendance Overtime', () => {
  it('opens on My Overtime under the Attendance sub menu and switches between the inner tabs', async () => {
    const { user } = renderApp('/attendance/overtime')

    expect(await screen.findByRole('heading', { name: 'My Overtime' })).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: 'Attendance' })).getByRole('link', {
        name: 'Overtime',
      }),
    ).toHaveAttribute('aria-current', 'page')
    expect(within(overtimeNav()).getByRole('link', { name: 'My Overtime' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(within(overtimeNav()).getByRole('link', { name: 'Applications' }))
    expect(await screen.findByRole('heading', { name: 'Overtime Applications' })).toBeVisible()
    await user.click(within(overtimeNav()).getByRole('link', { name: 'Bulk Applications' }))
    expect(await screen.findByRole('heading', { name: 'Bulk Applications' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'OT-0010' })).toBeVisible()
    await user.click(within(overtimeNav()).getByRole('link', { name: 'Bulk Overtime' }))
    expect(await screen.findByRole('heading', { name: 'Bulk Overtime' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Bulk Save' })).toBeVisible()
    await user.click(within(overtimeNav()).getByRole('link', { name: 'Overtime Policy' }))
    expect(await screen.findByRole('heading', { name: 'Overtime Policy' })).toBeVisible()
    await user.click(within(overtimeNav()).getByRole('link', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { name: 'Overtime Settings' })).toBeVisible()
    expect(within(overtimeNav()).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(overtimeNav()).getByRole('link', { name: 'My Overtime' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('lists my overtime and applies through POST /requests/overtime, once per day', async () => {
    const date = recentWorkday(11)
    const { user } = renderApp('/attendance/overtime')

    expect(await screen.findByRole('heading', { name: 'My Overtime' })).toBeVisible()
    expect((await screen.findAllByRole('cell', { name: 'Meet Deadline' })).length).toBe(3)
    expect(screen.getByRole('columnheader', { name: 'Applied overtime minutes' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Approved' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Pending' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Rejected' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: '+ Apply Overtime' }))
    const dialog = await screen.findByRole('dialog', { name: 'Apply for Overtime' })
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(await within(dialog).findByText('Choose the department')).toBeVisible()
    expect(within(dialog).getByText('Choose the date')).toBeVisible()
    expect(within(dialog).getByText('Enter the start time')).toBeVisible()
    expect(within(dialog).getByText('Enter the end time')).toBeVisible()
    expect(within(dialog).getByText('Enter the overtime hours')).toBeVisible()

    await choose(user, /^Department/, 'Human Resource Management')
    await pickDate(user, /^Date/, date)
    fireEvent.change(within(dialog).getByLabelText(/^Start Time/), { target: { value: '18:00' } })
    fireEvent.change(within(dialog).getByLabelText(/^End Time/), { target: { value: '21:00' } })
    const hours = within(dialog).getByRole('textbox', { name: /^Overtime Hours/ })
    await user.type(hours, '4')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(
      await within(dialog).findByText('At most 3h 00m, the time between the two clocks'),
    ).toBeVisible()
    await user.clear(hours)
    await user.type(hours, '2')
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason for Overtime/ }), 'Audit')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    expect(await screen.findByText('Overtime applied')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: `6:00pm, ${dayLabel(date)}` })).toBeVisible()
    const created = overtimeRequests().find(
      (record) => record.employeeId === 'em_shelley' && payloadOf(record.id)?.overtimeDate === date,
    )
    expect(created?.status).toBe('pending')
    expect(created?.payload).toMatchObject({
      departmentId: 'dep_human-resource-management',
      startTime: '18:00',
      endTime: '21:00',
      appliedMinutes: 120,
      reason: 'Audit',
    })

    // One request per person and day: the API's refusal lands on Date.
    await user.click(screen.getByRole('button', { name: '+ Apply Overtime' }))
    const again = await screen.findByRole('dialog', { name: 'Apply for Overtime' })
    await choose(user, /^Department/, 'Human Resource Management')
    await pickDate(user, /^Date/, date)
    fireEvent.change(within(again).getByLabelText(/^Start Time/), { target: { value: '18:00' } })
    fireEvent.change(within(again).getByLabelText(/^End Time/), { target: { value: '20:00' } })
    await user.type(within(again).getByRole('textbox', { name: /^Overtime Hours/ }), '1')
    await user.click(within(again).getByRole('button', { name: 'Apply' }))
    expect(await within(again).findByText('One overtime request per day')).toBeVisible()
    expect(
      overtimeRequests().filter(
        (record) =>
          record.employeeId === 'em_shelley' && payloadOf(record.id)?.overtimeDate === date,
      ),
    ).toHaveLength(1)
  }, 30_000)

  it('approves through /requests/approvals within the daily policy, rejects with a reason, and filters Unapproved', async () => {
    const { user } = renderApp('/attendance/overtime?tab=applications')

    expect(await screen.findByRole('heading', { name: 'Overtime Applications' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Employees' })).toBeVisible()
    expect((await screen.findAllByText('Omer Farooq')).length).toBeGreaterThan(0)
    // Haroon's request waits for his line manager first, so it has not reached the HR manager.
    expect(screen.queryByRole('button', { name: 'Actions for OT-0004' })).not.toBeInTheDocument()

    // Unapproved: what waits for your decision.
    await user.click(screen.getByRole('button', { name: 'Unapproved' }))
    expect(screen.getByRole('button', { name: 'Unapproved' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await screen.findByRole('button', { name: 'Actions for OT-0005' })).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Actions for OT-0007' })).not.toBeInTheDocument()
    })

    await openAction(user, 'OT-0006', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Overtime Approve/Reject' })
    const minutes = within(dialog).getByRole('textbox', { name: /^Approved Minutes/ })
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Approve' })).toBeEnabled()
    })
    await user.clear(minutes)
    await user.type(minutes, '300')
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    expect(await within(dialog).findByText('Overtime caps a day at 240 minutes')).toBeVisible()
    await user.clear(minutes)
    await user.type(minutes, '240')
    expect(await within(dialog).findByText(/180–240 slab \(Full Day\)/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    expect(await screen.findByText('Approved 240 minutes for Omer Farooq')).toBeInTheDocument()
    const omer = standardRequests.find('ot_0006')
    expect(omer?.status).toBe('completed')
    expect(payloadOf('ot_0006')?.approvedMinutes).toBe(240)
    // The time sheet's Approved Overtime reads the same minutes.
    expect(
      attendanceEdits.find(dayId('em_omer', payloadOf('ot_0006')?.overtimeDate ?? ''))
        ?.approvedOvertimeMinutes,
    ).toBe(240)

    // Rejecting needs a reason.
    await openAction(user, 'OT-0005', 'Approve/Reject')
    const second = await screen.findByRole('dialog', { name: 'Overtime Approve/Reject' })
    await waitFor(() => {
      expect(within(second).getByRole('button', { name: 'Reject' })).toBeEnabled()
    })
    await user.click(within(second).getByRole('button', { name: 'Reject' }))
    expect(await within(second).findByText('Give a reason for rejecting')).toBeVisible()
    await user.type(within(second).getByRole('textbox', { name: /^Remarks/ }), 'Not needed.')
    await user.click(within(second).getByRole('button', { name: 'Reject' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('ot_0005')?.status).toBe('rejected')
    })
    expect(await screen.findByText('No overtime requests match.')).toBeVisible()
  }, 40_000)

  it('files a bulk request per person, and Bulk Save edits and approves the sheet', async () => {
    const date = recentWorkday(1)
    const { user } = renderApp('/attendance/overtime?tab=bulk-overtime')

    expect(await screen.findByRole('heading', { name: 'Bulk Overtime' })).toBeVisible()
    expect((await screen.findAllByText('Haroon Jalani')).length).toBeGreaterThan(0)
    // Your own pending request is not on the sheet.
    expect(screen.queryByRole('cell', { name: 'OT-0002' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Bulk Overtime Request' })
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await within(dialog).findByText('Choose at least one employee')).toBeVisible()
    expect(within(dialog).getByText('Choose the department')).toBeVisible()
    expect(within(dialog).getByText('Give the reason for overtime')).toBeVisible()

    await user.click(within(dialog).getByRole('combobox', { name: /^Select Employees/ }))
    await user.click(await screen.findByRole('option', { name: /Laiba Shah/ }))
    await user.click(await screen.findByRole('option', { name: /Kaleem Murtaza/ }))
    await user.click(await screen.findByRole('option', { name: /Sadia Rehman/ }))
    await user.keyboard('{Escape}')
    await choose(user, /^Department/, 'Human Resource Management')
    await pickDate(user, /^Date/, date)
    fireEvent.change(within(dialog).getByLabelText(/^Start Time/), { target: { value: '18:00' } })
    fireEvent.change(within(dialog).getByLabelText(/^End Time/), { target: { value: '20:00' } })
    await user.type(within(dialog).getByRole('textbox', { name: /^Overtime Hours/ }), '2')
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Reason for Overtime/ }),
      'Audit week',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    // Sadia already has overtime that day: refused, the other two are filed.
    expect(await screen.findByText('Filed 2 overtime requests; 1 refused')).toBeInTheDocument()
    expect(
      await within(dialog).findByText('Sadia Rehman: One overtime request per day'),
    ).toBeVisible()
    const filed = overtimeRequests().filter((record) => payloadOf(record.id)?.overtimeDate === date)
    const laiba = filed.find((record) => record.employeeId === 'em_laiba')
    const kaleem = filed.find((record) => record.employeeId === 'em_kaleem')
    expect(laiba?.createdById).toBe('em_shelley')
    expect(payloadOf(kaleem?.id ?? '')?.appliedMinutes).toBe(120)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    // Laiba: fewer applied minutes, approved in full; Kaleem: approved in part; Haroon waits
    // for his line manager, so his approval is refused.
    const laibaApplied = await screen.findByRole('textbox', {
      name: 'Applied overtime minutes for Laiba Shah',
    })
    await user.clear(laibaApplied)
    await user.type(laibaApplied, '100')
    await user.type(screen.getByRole('textbox', { name: 'Approved minutes for Laiba Shah' }), '100')
    await user.type(
      screen.getByRole('textbox', { name: 'Approved minutes for Kaleem Murtaza' }),
      '90',
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Approved minutes for Haroon Jalani' }),
      '60',
    )
    await user.click(screen.getByRole('button', { name: 'Bulk Save' }))

    expect(
      await screen.findByText('Bulk Save: 1 updated, 2 approved, 1 refused'),
    ).toBeInTheDocument()
    expect(standardRequests.find(laiba?.id ?? '')?.status).toBe('completed')
    expect(payloadOf(laiba?.id ?? '')).toMatchObject({ appliedMinutes: 100, approvedMinutes: 100 })
    expect(standardRequests.find(kaleem?.id ?? '')?.status).toBe('completed')
    expect(payloadOf(kaleem?.id ?? '')?.approvedMinutes).toBe(90)
    expect(standardRequests.find('ot_0004')?.status).toBe('pending')
    expect(await screen.findByText('This request is not waiting for your decision.')).toBeVisible()

    await user.click(within(overtimeNav()).getByRole('link', { name: 'Bulk Applications' }))
    expect(await screen.findByRole('cell', { name: laiba?.code ?? '' })).toBeVisible()
  }, 60_000)

  it('creates an overtime policy with leave and full-day slabs, and refuses to delete one in use', async () => {
    const { user } = renderApp('/attendance/overtime?tab=policy')

    expect(await screen.findByRole('heading', { name: 'Overtime Policy' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'New Overtime' })).toBeVisible()
    expect(screen.getAllByRole('cell', { name: 'August 26, 2024' })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Overtime Policy Create' })
    expect(within(dialog).getByText('No Record Found')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the policy name')).toBeVisible()
    expect(within(dialog).getByText('Create at least one slab')).toBeVisible()
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Night Shift Overtime')

    // A leave slab: the leave type is required.
    await user.click(within(dialog).getByRole('button', { name: '+ Create' }))
    const slab = await screen.findByRole('dialog', { name: 'Slab Create' })
    await user.type(within(slab).getByRole('textbox', { name: /^Minimum Minutes/ }), '30')
    await user.type(within(slab).getByRole('textbox', { name: /^Maximum Minutes/ }), '20')
    await user.click(within(slab).getByRole('button', { name: 'Save' }))
    expect(await within(slab).findByText('More than the minimum minutes')).toBeVisible()
    expect(within(slab).getByText('Choose the encashment type')).toBeVisible()
    const max = within(slab).getByRole('textbox', { name: /^Maximum Minutes/ })
    await user.clear(max)
    await user.type(max, '90')
    await choose(user, /^Encashment Type/, 'Sick Leave')
    await user.click(within(slab).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Slab Create' })).not.toBeInTheDocument()
    })

    // A full-day slab: no leave type.
    await user.click(within(dialog).getByRole('button', { name: '+ Create' }))
    const second = await screen.findByRole('dialog', { name: 'Slab Create' })
    await user.click(within(second).getByRole('checkbox', { name: 'Full Day' }))
    expect(within(second).getByRole('combobox', { name: /^Encashment Type/ })).toBeDisabled()
    await user.type(within(second).getByRole('textbox', { name: /^Minimum Minutes/ }), '91')
    await user.type(within(second).getByRole('textbox', { name: /^Maximum Minutes/ }), '240')
    await user.click(within(second).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Slab Create' })).not.toBeInTheDocument()
    })

    expect(within(dialog).getByRole('cell', { name: 'Sick Leave' })).toBeVisible()
    expect(within(dialog).getByRole('cell', { name: 'Full Day' })).toBeVisible()
    await openAction(user, 'slab 1', 'View')
    const view = await screen.findByRole('dialog', { name: 'Slab View' })
    expect(within(view).getByRole('textbox', { name: /^Maximum Minutes/ })).toHaveValue('90')
    expect(within(view).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await user.click(within(view).getByRole('button', { name: 'Cancel' }))

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Overtime policy created')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Night Shift Overtime' })).toBeVisible()
    const created = overtimePolicies.all().find((item) => item.name === 'Night Shift Overtime')
    expect(created?.period).toBe('daily')
    expect(created?.isActive).toBe(true)
    expect(created?.slabs).toMatchObject([
      { minMinutes: 30, maxMinutes: 90, encashmentType: 'leave', leaveTypeId: 'lt_sick' },
      { minMinutes: 91, maxMinutes: 240, encashmentType: 'full_day', leaveTypeId: null },
    ])

    // "Overtime" is what the seeded approvals fell under: the mock refuses to delete it.
    await openAction(user, 'Overtime', 'Delete')
    await confirmYes(user)
    expect(
      await screen.findByText(
        '4 approved overtime requests fell under this policy. Make it inactive instead.',
      ),
    ).toBeInTheDocument()
    expect(overtimePolicies.find('otp_daily')).toBeDefined()

    await openAction(user, 'Night Shift Overtime', 'Delete')
    await confirmYes(user)
    expect(await screen.findByText('Overtime policy deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(overtimePolicies.all().some((item) => item.name === 'Night Shift Overtime')).toBe(
        false,
      )
    })
  }, 40_000)

  it('saves the overtime settings with the encashment shift in minutes', async () => {
    const { user } = renderApp('/attendance/overtime?tab=settings')

    expect(await screen.findByRole('heading', { name: 'Overtime Settings' })).toBeVisible()
    const before = overtimeSettingsStore.find('settings')?.rowVersion
    const checkIn = await screen.findByRole('switch', { name: 'Overtime Applicable on Check-in' })
    expect(checkIn).not.toBeChecked()
    await user.click(checkIn)
    const hours = screen.getByRole('textbox', { name: 'Shift Hours for Overtime Encashment' })
    expect(hours).toHaveValue('8')
    await user.clear(hours)
    await user.type(hours, '30')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('At most 24 hours')).toBeVisible()
    await user.clear(hours)
    await user.type(hours, '7.5')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Overtime settings saved')).toBeInTheDocument()
    const saved = overtimeSettingsStore.find('settings')
    expect(saved?.overtimeOnCheckIn).toBe(true)
    expect(saved?.encashmentShiftMinutes).toBe(450)
    expect(saved?.rowVersion).not.toBe(before)
  })
})
