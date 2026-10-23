import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format, nextMonday } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { currentLeaveSettings, leavePolicies, leaveTypes } from '@/mocks/leaves/db'
import { standardRequests } from '@/mocks/requests/standard'
import { balanceOf } from '@/mocks/requests/standard/kinds/leave'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks the day, moving months if needed. */
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

async function openAction(user: UserEvent, row: string, action: string | RegExp) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${row}` }))
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

describe('Leaves', () => {
  it('opens on My Leaves, with the sub menu and the Settings tabs', async () => {
    const { user } = renderApp('/leaves')

    expect(await screen.findByRole('heading', { name: 'My Leaves' })).toBeVisible()
    const menu = screen.getByRole('navigation', { name: 'Leaves' })
    expect(within(menu).getByRole('link', { name: 'My Leaves' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(menu).getByRole('link', { name: 'Leave Applications' })).toBeVisible()
    expect(within(menu).getByRole('link', { name: 'Leave Encashment' })).toHaveAttribute(
      'href',
      '/payroll/leave-encashment',
    )

    await user.click(within(menu).getByRole('link', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeVisible()
    const tabs = screen.getByRole('navigation', { name: 'Leave settings' })
    expect(within(tabs).getByRole('link', { name: 'General Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(tabs).getByRole('link', { name: 'Leave Types' })).toBeVisible()
    expect(within(tabs).getByRole('link', { name: 'Leave Policies' })).toBeVisible()
    expect(await screen.findByRole('combobox', { name: /^Leave Final Approval By/ })).toBeVisible()
  })

  it('lists my leaves and applies for one after checking the fields and the balance', async () => {
    const { user } = renderApp('/leaves/my-leaves')

    // Shelley's seeded requests, as Requests → Leave has them.
    expect(await screen.findByRole('cell', { name: 'Casual Leaves' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Rosters' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Applied On' })).toBeVisible()
    expect(screen.getAllByRole('cell', { name: 'Approved' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Status: All Requests' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: '+ Apply Leave' }))
    const dialog = await screen.findByRole('dialog', { name: 'Apply Leave' })
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(await within(dialog).findByText('Choose the leave type')).toBeVisible()
    expect(within(dialog).getByText('Choose the leave date')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    // Casual: 8 a year, one day approved → 7 available (the Requests → Leave entitlement).
    await choose(user, /^Leave Type/, /Casual Leaves/)
    expect(within(dialog).getByRole('textbox', { name: 'Available Balance' })).toHaveValue('7')

    await pickDate(user, /^Leave Date/, nextMonday(addDays(new Date(), 6)))
    await waitFor(() => {
      expect(within(dialog).getByText('Selected Days').nextElementSibling).toHaveTextContent('1')
    })
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Family matter.')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    expect((await screen.findAllByText('Leave applied')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(shelleysLeave()).toHaveLength(4)
    })
    const saved = shelleysLeave().find((record) => record.payload.reason === 'Family matter.')
    expect(saved?.payload).toMatchObject({ leaveTypeId: 'lt_casual', count: 1, category: 'single' })
    expect(saved?.code).toBe('LV-0011')
  }, 30_000)

  it('views one of my applications and withdraws a pending one', async () => {
    const { user } = renderApp('/leaves/my-leaves')

    // LV-0008: Shelley's approved casual day.
    await openAction(user, 'LV-0008', 'View')
    const view = await screen.findByRole('dialog', { name: 'Leave Application' })
    expect(await within(view).findByText('Bank and passport office.')).toBeVisible()
    expect(within(view).getByRole('heading', { name: 'History' })).toBeVisible()
    expect(within(view).getByText(/Approved by HR Manager/)).toBeVisible()
    await user.click(within(view).getByRole('button', { name: 'Cancel' }))

    // LV-0007: the pending half day is withdrawn with a reason.
    await openAction(user, 'LV-0007', 'Cancel')
    const cancel = await screen.findByRole('dialog', { name: 'Withdraw Leave Application' })
    await user.click(within(cancel).getByRole('button', { name: 'Withdraw' }))
    expect(await within(cancel).findByText('Give the reason for cancellation')).toBeVisible()
    await user.type(
      within(cancel).getByRole('textbox', { name: /^Reason for Cancellation/ }),
      'Appointment moved.',
    )
    await user.click(within(cancel).getByRole('button', { name: 'Withdraw' }))

    expect(await screen.findByText('Cancellation recorded')).toBeInTheDocument()
    await waitFor(() => {
      expect(standardRequests.find('lv_0007')?.status).toBe('cancelled')
    })
    expect(standardRequests.find('lv_0007')?.cancelReason).toBe('Appointment moved.')
  }, 30_000)

  it('approves and rejects applications from Leave Applications', async () => {
    const { user } = renderApp('/leaves/applications')

    expect(await screen.findByRole('heading', { name: 'Leave Applications' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Employees' })).toBeVisible()
    expect((await screen.findAllByText('Sadia Rehman')).length).toBeGreaterThan(0)

    await openAction(user, 'LV-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Leave Approve/Reject' })
    expect(within(dialog).getByText('Total Leaves')).toBeVisible()
    expect(within(dialog).getByText('Availed Leaves')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('lv_0001')?.status).toBe('completed')
    })
    expect(balanceOf('em_sadia', 'lt_casual', standardRequests.all())).toMatchObject({
      availed: 2,
      pending: 0,
    })
    const history = standardRequests.find('lv_0001')?.history ?? []
    expect(history.at(-1)?.status).toBe('Approved by HR Manager (Final Authority)')

    // Rejecting needs a reason.
    await openAction(user, 'LV-0002', 'Approve/Reject')
    const second = await screen.findByRole('dialog', { name: 'Leave Approve/Reject' })
    await user.click(within(second).getByRole('button', { name: 'Reject' }))
    expect(await within(second).findByText('Give a reason for rejecting')).toBeVisible()
    await user.type(within(second).getByRole('textbox', { name: /^Remarks/ }), 'Project deadline.')
    await user.click(within(second).getByRole('button', { name: 'Reject' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(standardRequests.find('lv_0002')?.status).toBe('rejected')
    })
  }, 30_000)

  it('saves the general settings', async () => {
    const { user } = renderApp('/leaves/settings/general')

    const approvalBy = await screen.findByRole('combobox', { name: /^Leave Final Approval By/ })
    expect(approvalBy).toHaveTextContent('HR Manager')
    expect(screen.getByRole('combobox', { name: /^Approve Leave on Status/ })).toHaveTextContent(
      'Approved',
    )
    const save = screen.getByRole('button', { name: 'Save Changes' })
    expect(save).toBeDisabled()

    await choose(user, /^Leave Final Approval By/, 'Line Manager')
    const deadline = screen.getByRole('switch', { name: 'Post Leave Application Deadline' })
    expect(deadline).toBeChecked()
    await user.click(deadline)
    await user.click(save)

    expect(await screen.findByText('Settings saved')).toBeInTheDocument()
    expect(currentLeaveSettings()).toMatchObject({
      finalApprovalBy: 'line-manager',
      postDeadline: false,
    })
  })

  it('creates a leave type with its dependent fields and refuses to delete one in use', async () => {
    const { user } = renderApp('/leaves/settings/leave-types')

    // The list as drawn: Type, No. of Leaves, Leave Encashment and Status switches, the pencil.
    expect(await screen.findByRole('cell', { name: 'Sick Leave' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'No. of Leaves' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Leave Encashment' })).toBeVisible()
    expect(screen.getByRole('switch', { name: 'Leave encashment for Annual Leave' })).toBeChecked()
    const probation = screen.getByRole('switch', { name: 'Status of Probation Leave' })
    expect(probation).not.toBeChecked()
    await user.click(probation)
    await waitFor(() => {
      expect(leaveTypes.find('lt_probation')?.active).toBe(true)
    })

    await user.click(screen.getByRole('link', { name: '+ Add New' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Leave Types' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the title')).toBeVisible()
    expect(within(dialog).getByText('Enter the short code')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Study Leave')
    await user.type(within(dialog).getByRole('textbox', { name: 'Short Code' }), 'stl')
    await user.type(within(dialog).getByRole('textbox', { name: 'No of Leaves Allowed' }), '5')

    // The dependent fields appear under their box.
    expect(
      within(dialog).queryByRole('textbox', { name: /^Back Date Leave Limit in Days/ }),
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Can Apply for Back Date' }))
    await user.type(
      await within(dialog).findByRole('textbox', { name: /^Back Date Leave Limit in Days/ }),
      '3',
    )
    await user.click(within(dialog).getByRole('checkbox', { name: 'Attachment Required' }))
    expect(
      await within(dialog).findByRole('combobox', { name: /^Do When Attachment is Required/ }),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose what to do')).toBeVisible()
    await choose(user, /^Do When Attachment is Required/, 'Refuse the application')

    // Pre Condition and Balance Settings, as drawn.
    expect(within(dialog).getByRole('combobox', { name: /^Marital Status/ })).toBeVisible()
    expect(within(dialog).getByRole('checkbox', { name: 'Can Apply in Probation' })).toBeVisible()
    expect(within(dialog).getByRole('checkbox', { name: 'Pro Rated' })).toBeVisible()
    expect(within(dialog).getByRole('textbox', { name: /^Accumulative Count/ })).toBeVisible()
    await user.click(within(dialog).getByRole('switch', { name: 'Balance According to: Flat' }))
    expect(await within(dialog).findByRole('heading', { name: 'Experience Slabs' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Add at least one slab')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 minimum months' }), '0')
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 maximum months' }), '600')
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 balance' }), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Leave type created')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Study Leave' })).toBeVisible()
    const created = leaveTypes.all().find((type) => type.title === 'Study Leave')
    expect(created).toMatchObject({
      shortCode: 'STL',
      leavesAllowed: 5,
      backDate: true,
      backDateLimitDays: 3,
      attachmentRequired: true,
      attachmentRule: 'refuse',
      balanceBasis: 'experience',
    })
    expect(created?.experienceSlabs).toEqual([{ minMonths: 0, maxMonths: 600, balance: 5 }])

    // Sick Leave has applications: Delete in its popup is refused by the server.
    await user.click(screen.getByRole('button', { name: 'Edit Sick Leave' }))
    const edit = await screen.findByRole('dialog', { name: 'Edit Leave Type' })
    expect(within(edit).getByRole('textbox', { name: 'Title' })).toHaveValue('Sick Leave')
    await user.click(within(edit).getByRole('button', { name: 'Delete' }))
    await confirmYes(user)
    expect(await screen.findByText(/cannot be deleted/)).toBeInTheDocument()
    expect(leaveTypes.find('lt_sick')).toBeDefined()
    // The popup stays open; the type is still listed once it is closed.
    expect(within(edit).getByRole('textbox', { name: 'Title' })).toHaveValue('Sick Leave')
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('cell', { name: 'Sick Leave' })).toBeVisible()
  }, 40_000)

  it('creates an employee level policy and enrolls someone in it', async () => {
    const { user } = renderApp('/leaves/settings/policies')

    // The list as drawn: Leave Policy, Enroll Employee, Policy Level, the two switches, the pencil.
    expect(await screen.findByRole('cell', { name: 'Leave Distribution Policy' })).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Half leave & Short leave' })).toBeVisible()
    expect(screen.getAllByRole('cell', { name: 'Company Level Policy' })).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Enroll Employee' })).toBeVisible()
    expect(screen.getByRole('switch', { name: 'Leave Distribution Policy in force' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Edit Leave Distribution Policy' })).toBeVisible()

    await user.click(screen.getByRole('link', { name: '+ Add New' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Policy' })
    await user.click(within(dialog).getByRole('button', { name: 'Add Policy' }))
    expect(await within(dialog).findByText('Choose the policy')).toBeVisible()
    expect(within(dialog).getByText('Enter the title')).toBeVisible()
    expect(
      within(dialog).getByText(
        'Company level Policy will apply to all the employees of your company.',
      ),
    ).toBeVisible()

    await choose(user, /^Policy \*/, 'Half leave & Short leave')
    await user.type(within(dialog).getByRole('textbox', { name: 'Title *' }), 'Interns Short Leave')
    await user.click(within(dialog).getByRole('switch', { name: 'Employee Level Policy' }))
    expect(within(dialog).getByRole('switch', { name: 'Company Level Policy' })).not.toBeChecked()
    expect(
      within(dialog).getByText(
        'Employee level Policy will apply to the employees you enroll in it.',
      ),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('switch', { name: 'Allow short day leave' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add Policy' }))

    expect(await screen.findByText('Policy created')).toBeInTheDocument()
    const row = await screen.findByRole('row', { name: /Interns Short Leave/ })
    expect(within(row).getByRole('cell', { name: 'Employee Level Policy' })).toBeVisible()
    const created = leavePolicies.all().find((policy) => policy.title === 'Interns Short Leave')
    expect(created).toMatchObject({
      kind: 'half-short',
      level: 'employee',
      allowHalfDay: true,
      allowShortLeave: true,
      enforced: true,
      active: true,
      enrolledIds: [],
    })

    // Enroll Employee: the count of an employee level policy opens the picker.
    await user.click(
      within(row).getByRole('button', { name: /Enroll employees in Interns Short Leave/ }),
    )
    const enroll = await screen.findByRole('dialog', { name: 'Enroll Employee' })
    await user.click(within(enroll).getByRole('combobox', { name: 'Employees' }))
    await user.click(await screen.findByRole('option', { name: /Maryam Javed/ }))
    await user.keyboard('{Escape}')
    await user.click(within(enroll).getByRole('button', { name: 'Enroll' }))

    expect(await screen.findByText('Enrollment saved')).toBeInTheDocument()
    expect(
      leavePolicies.all().find((policy) => policy.title === 'Interns Short Leave')?.enrolledIds,
    ).toEqual(['em_maryam'])
    expect(
      await screen.findByRole('button', {
        name: 'Enroll employees in Interns Short Leave (1 enrolled)',
      }),
    ).toBeVisible()
  }, 40_000)
})
