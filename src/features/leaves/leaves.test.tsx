import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format, nextMonday } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import {
  currentLeaveSettings,
  leavePolicies,
  leaveRequests,
  leaveTypeStore,
} from '@/mocks/leaves/db'
import { leaveRequestHandlers } from '@/mocks/leaves/handlers'
import { balanceOf } from '@/mocks/leaves/rules'
import { server } from '@/mocks/node'
import { apiPath } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
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

/** Signs in a user who holds only these permission codes (the backend's `/auth/me`). */
function renderAs(path: string, codes: string[]) {
  const result = renderApp(path)
  useAuthStore.getState().setSession({
    token: useAuthStore.getState().token ?? '',
    user: {
      ...DEMO_USER,
      employeeId: 'em_shelley',
      permissions: codes.map((code) => ({ code, scope: 'company' })),
    },
  })
  return result
}

describe('Leaves', () => {
  beforeEach(() => {
    // Apply, Cancel and Approve/Reject go to the requests API; answer them over the Leaves mock.
    server.use(...leaveRequestHandlers)
  })

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

  it('lists my leaves and applies for one through the requests API', async () => {
    const { user } = renderApp('/leaves/my-leaves')

    expect(await screen.findByRole('cell', { name: 'Bank and passport office.' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Applied On' })).toBeVisible()
    expect(screen.queryByRole('columnheader', { name: 'Rosters' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('cell', { name: 'Approved' }).length).toBeGreaterThan(0)
    // The counts come from /leaves/applications/counts.
    await user.click(screen.getByRole('button', { name: 'Status: All Requests' }))
    expect(await screen.findByRole('menuitemradio', { name: 'All Requests (3)' })).toBeVisible()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: '+ Apply Leave' }))
    const dialog = await screen.findByRole('dialog', { name: 'Apply Leave' })
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(await within(dialog).findByText('Choose the leave type')).toBeVisible()
    expect(within(dialog).getByText('Choose the leave date')).toBeVisible()
    expect(within(dialog).getByText('Give the reason')).toBeVisible()

    // The balance is the ledger's allotment less approved and pending days.
    await choose(user, /^Leave Type/, /Casual Leaves/)
    const year = new Date().getFullYear()
    const available = balanceOf('em_shelley', 'lt_casual', year).available
    expect(within(dialog).getByRole('textbox', { name: 'Available Balance' })).toHaveValue(
      String(available),
    )

    const day = nextMonday(addDays(new Date(), 6))
    await pickDate(user, /^Leave Date/, day)
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Family matter.')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))

    expect((await screen.findAllByText('Leave applied')).length).toBeGreaterThan(0)
    const saved = leaveRequests.all().find((row) => row.reason === 'Family matter.')
    expect(saved).toMatchObject({
      employeeId: 'em_shelley',
      leaveTypeId: 'lt_casual',
      fromDate: format(day, 'yyyy-MM-dd'),
      toDate: format(day, 'yyyy-MM-dd'),
      days: 1,
      status: 'pending',
    })
    expect(await screen.findByRole('cell', { name: 'Family matter.' })).toBeVisible()
  }, 30_000)

  it('shows the server’s refusal on the field it names', async () => {
    // The backend answers a broken rule with the field to fix (lv.usp_leave_request_check).
    server.use(
      http.post(apiPath('/requests/leave'), () =>
        HttpResponse.json(
          {
            message: 'The start date is further ahead than this leave type allows.',
            code: 'VALIDATION_FAILED',
            fieldErrors: {
              fromDate: 'The start date is further ahead than this leave type allows.',
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { user } = renderApp('/leaves/my-leaves')
    await user.click(await screen.findByRole('button', { name: '+ Apply Leave' }))
    const dialog = await screen.findByRole('dialog', { name: 'Apply Leave' })
    await choose(user, /^Leave Type/, /Casual Leaves/)
    await pickDate(user, /^Leave Date/, nextMonday(addDays(new Date(), 6)))
    await user.type(within(dialog).getByRole('textbox', { name: /^Reason/ }), 'Trip.')
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }))
    expect(
      await within(dialog).findByText(
        'The start date is further ahead than this leave type allows.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('dialog', { name: 'Apply Leave' })).toBeVisible()
  }, 30_000)

  it('views one of my applications and withdraws a pending one', async () => {
    const { user } = renderApp('/leaves/my-leaves')

    await openAction(user, 'RQ-LV-0006', 'View')
    const view = await screen.findByRole('dialog', { name: 'Leave Application' })
    expect(await within(view).findByText('Bank and passport office.')).toBeVisible()
    expect(within(view).getByText('Total Leaves')).toBeVisible()
    expect(await within(view).findByRole('heading', { name: 'History' })).toBeVisible()
    await user.click(within(view).getByRole('button', { name: 'Cancel' }))

    await openAction(user, 'RQ-LV-0007', 'Cancel')
    const cancel = await screen.findByRole('dialog', { name: 'Withdraw Leave Application' })
    await waitFor(() => {
      expect(within(cancel).getByRole('button', { name: 'Withdraw' })).toBeEnabled()
    })
    await user.click(within(cancel).getByRole('button', { name: 'Withdraw' }))
    expect(await within(cancel).findByText('Give the reason for cancellation')).toBeVisible()
    await user.type(
      within(cancel).getByRole('textbox', { name: /^Reason for Cancellation/ }),
      'Appointment moved.',
    )
    await user.click(within(cancel).getByRole('button', { name: 'Withdraw' }))

    expect(await screen.findByText('Cancellation recorded')).toBeInTheDocument()
    expect(leaveRequests.find('lv_0007')).toMatchObject({
      status: 'cancelled',
      cancelReason: 'Appointment moved.',
    })
  }, 30_000)

  it('approves and rejects applications, and filters to subordinates', async () => {
    const { user } = renderApp('/leaves/applications')

    expect(await screen.findByRole('heading', { name: 'Leave Applications' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Employees' })).toBeVisible()
    expect((await screen.findAllByText('Sadia Rehman')).length).toBeGreaterThan(0)

    await openAction(user, 'RQ-LV-0001', 'Approve/Reject')
    const dialog = await screen.findByRole('dialog', { name: 'Leave Approve/Reject' })
    expect(await within(dialog).findByText('Total Leaves')).toBeVisible()
    expect(within(dialog).getByText('Availed Leaves')).toBeVisible()
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Approve' })).toBeEnabled()
    })
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(leaveRequests.find('lv_0001')?.status).toBe('approved')
    })

    // Rejecting needs a reason.
    await openAction(user, 'RQ-LV-0002', 'Approve/Reject')
    const second = await screen.findByRole('dialog', { name: 'Leave Approve/Reject' })
    await waitFor(() => {
      expect(within(second).getByRole('button', { name: 'Reject' })).toBeEnabled()
    })
    await user.click(within(second).getByRole('button', { name: 'Reject' }))
    expect(await within(second).findByText('Give a reason for rejecting')).toBeVisible()
    await user.type(within(second).getByRole('textbox', { name: /^Remarks/ }), 'Project deadline.')
    await user.click(within(second).getByRole('button', { name: 'Reject' }))
    await confirmYes(user)
    await waitFor(() => {
      expect(leaveRequests.find('lv_0002')?.status).toBe('rejected')
    })

    // Subordinates: Shelley's direct and indirect reports, not her own leave.
    await user.click(screen.getByRole('button', { name: 'Subordinates' }))
    expect(screen.getByRole('button', { name: 'Subordinates' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(await screen.findByRole('button', { name: 'Actions for RQ-LV-0003' })).toBeVisible()
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Actions for RQ-LV-0006' }),
      ).not.toBeInTheDocument()
    })
  }, 40_000)

  it('saves the general settings with the row version', async () => {
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
    expect(deadline).not.toBeChecked()
    await user.click(deadline)
    await user.click(save)

    expect(await screen.findByText('Settings saved')).toBeInTheDocument()
    expect(currentLeaveSettings()).toMatchObject({
      finalApprovalBy: 'line_manager',
      postDeadline: true,
    })
    expect(currentLeaveSettings().rowVersion).not.toBeNull()
  })

  it('creates a leave type with its dependent fields and refuses to delete one in use', async () => {
    const { user } = renderApp('/leaves/settings/leave-types')

    expect(await screen.findByRole('cell', { name: 'Sick Leave' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'No. of Leaves' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Leave Encashment' })).toBeVisible()
    expect(screen.getByRole('switch', { name: 'Leave encashment for Annual Leave' })).toBeChecked()
    const probation = screen.getByRole('switch', { name: 'Status of Probation Leave' })
    expect(probation).not.toBeChecked()
    await user.click(probation)
    await waitFor(() => {
      expect(leaveTypeStore.find('lt_probation')?.isActive).toBe(true)
    })

    await user.click(screen.getByRole('link', { name: '+ Add New' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Leave Types' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the title')).toBeVisible()
    expect(within(dialog).getByText('Enter the short code')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Study Leave')
    await user.type(within(dialog).getByRole('textbox', { name: 'Short Code' }), 'stl')
    await user.type(within(dialog).getByRole('textbox', { name: 'No of Leaves Allowed' }), '5')

    expect(
      within(dialog).queryByRole('textbox', { name: /^Back Date Leave Limit in Days/ }),
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Can Apply for Back Date' }))
    await user.type(
      await within(dialog).findByRole('textbox', { name: /^Back Date Leave Limit in Days/ }),
      '3',
    )
    await user.click(within(dialog).getByRole('checkbox', { name: 'Has Future Date Limit' }))
    await user.type(
      await within(dialog).findByRole('textbox', { name: /^Future Date Limit in Days/ }),
      '60',
    )
    await user.click(within(dialog).getByRole('checkbox', { name: 'Attachment Required' }))
    expect(
      await within(dialog).findByRole('combobox', { name: /^Do When Attachment is Required/ }),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose what to do')).toBeVisible()
    await choose(user, /^Do When Attachment is Required/, 'Refuse the application')

    expect(within(dialog).getByRole('combobox', { name: /^Marital Status/ })).toBeVisible()
    expect(within(dialog).getByRole('checkbox', { name: 'Can Apply in Probation' })).toBeVisible()
    await user.click(within(dialog).getByRole('switch', { name: 'Balance According to: Flat' }))
    expect(await within(dialog).findByRole('heading', { name: 'Experience Slabs' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Add at least one slab')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 minimum months' }), '0')
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 balance' }), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Leave type created')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Study Leave' })).toBeVisible()
    const created = leaveTypeStore.all().find((type) => type.title === 'Study Leave')
    expect(created).toMatchObject({
      shortCode: 'STL',
      allowance: 5,
      allowBackDate: true,
      backDateLimitDays: 3,
      hasFutureLimit: true,
      futureLimitDays: 60,
      attachmentRequired: true,
      attachmentRule: 'refuse',
      balanceBasis: 'experience',
    })
    expect(created?.experienceSlabs).toEqual([{ minMonths: 0, maxMonths: null, balance: 5 }])

    // Sick Leave has requests and ledger rows: Delete is refused by the server.
    await user.click(screen.getByRole('button', { name: 'Edit Sick Leave' }))
    const edit = await screen.findByRole('dialog', { name: 'Edit Leave Type' })
    expect(within(edit).getByRole('textbox', { name: 'Title' })).toHaveValue('Sick Leave')
    await user.click(within(edit).getByRole('button', { name: 'Delete' }))
    await confirmYes(user)
    expect(await screen.findByText(/Make it inactive instead/)).toBeInTheDocument()
    expect(leaveTypeStore.find('lt_sick')).toBeDefined()
    await user.click(within(edit).getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('cell', { name: 'Sick Leave' })).toBeVisible()
  }, 40_000)

  it('runs the allotment from Leave Types', async () => {
    const { user } = renderApp('/leaves/settings/leave-types')
    await user.click(await screen.findByRole('link', { name: 'Allotment' }))
    const dialog = await screen.findByRole('dialog', { name: 'Allotment' })
    expect(within(dialog).getByRole('textbox', { name: /^Leave Year/ })).toHaveValue(
      String(new Date().getFullYear()),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Run' }))
    // The seed's year is allotted already: the run is idempotent.
    expect(await screen.findByText(/^Allotted 0 balances/)).toBeInTheDocument()
  })

  it('creates policies, with leave types and enrolment', async () => {
    const { user } = renderApp('/leaves/settings/policies')

    expect(
      (await screen.findAllByRole('cell', { name: 'Leave Distribution Policy' })).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByRole('cell', { name: 'Company Level Policy' })).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Enroll Employee' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'No. of Leaves' })).toBeVisible()
    // Casual 8 + Sick 15 + Annual 14 + Unpaid 0.
    expect(screen.getByRole('cell', { name: '37' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Edit Leave Distribution Policy' })).toBeVisible()

    await user.click(screen.getByRole('link', { name: '+ Add New' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Policy' })
    await user.click(within(dialog).getByRole('button', { name: 'Add Policy' }))
    expect(await within(dialog).findByText('Choose the policy')).toBeVisible()
    expect(within(dialog).getByText('Enter the title')).toBeVisible()

    await choose(user, /^Policy \*/, 'Half leave & Short leave')
    await user.type(within(dialog).getByRole('textbox', { name: 'Title *' }), 'Interns Short Leave')
    await user.click(within(dialog).getByRole('switch', { name: 'Employee Level Policy' }))
    expect(within(dialog).getByRole('switch', { name: 'Company Level Policy' })).not.toBeChecked()
    await user.click(within(dialog).getByRole('switch', { name: 'Allow short day leave' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add Policy' }))

    expect(await screen.findByText('Policy created')).toBeInTheDocument()
    const row = await screen.findByRole('row', { name: /Interns Short Leave/ })
    expect(within(row).getByRole('cell', { name: 'Employee Level Policy' })).toBeVisible()
    expect(
      leavePolicies.all().find((policy) => policy.title === 'Interns Short Leave'),
    ).toMatchObject({
      policyKind: 'half_short',
      policyLevel: 'employee',
      allowHalfDay: true,
      allowShortLeave: true,
      isActive: true,
      types: [],
      enrolled: [],
    })

    await user.click(
      within(row).getByRole('button', { name: /Enroll employees in Interns Short Leave/ }),
    )
    const enroll = await screen.findByRole('dialog', { name: 'Enroll Employee' })
    await user.click(within(enroll).getByRole('combobox', { name: 'Employees' }))
    await user.click(await screen.findByRole('option', { name: /Maryam Javed/ }))
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(within(enroll).getByRole('button', { name: 'Enroll' })).toBeEnabled()
    })
    await user.click(within(enroll).getByRole('button', { name: 'Enroll' }))

    expect(await screen.findByText('Enrollment saved')).toBeInTheDocument()
    expect(
      leavePolicies
        .all()
        .find((policy) => policy.title === 'Interns Short Leave')
        ?.enrolled.map((item) => item.employeeId),
    ).toEqual(['em_maryam'])
    expect(
      await screen.findByRole('button', {
        name: 'Enroll employees in Interns Short Leave (1 enrolled)',
      }),
    ).toBeVisible()

    // A distribution policy lists its leave types with an allowance each.
    await user.click(screen.getByRole('link', { name: '+ Add New' }))
    const second = await screen.findByRole('dialog', { name: 'Add Policy' })
    await choose(user, /^Policy \*/, 'Leave Distribution Policy')
    await user.type(within(second).getByRole('textbox', { name: 'Title *' }), 'Interns Leave')
    await user.click(within(second).getByRole('switch', { name: 'Employee Level Policy' }))
    await user.click(within(second).getByRole('button', { name: 'Add Leave Type' }))
    await user.click(within(second).getByRole('combobox', { name: 'Leave type 1' }))
    await user.click(await screen.findByRole('option', { name: /Casual Leaves/ }))
    await user.type(within(second).getByRole('textbox', { name: 'Leave type 1 allowance' }), '4')
    await user.click(within(second).getByRole('button', { name: 'Add Policy' }))
    expect((await screen.findAllByText('Policy created')).length).toBeGreaterThan(0)
    expect(leavePolicies.all().find((policy) => policy.title === 'Interns Leave')?.types).toEqual([
      { leaveTypeId: 'lt_casual', allowance: 4 },
    ])
  }, 50_000)

  it('hides what the signed-in person has no permission code for', async () => {
    renderAs('/leaves/settings/leave-types', [
      'leaves.applications.view',
      'leaves.settings.types.view',
      'leaves.settings.policies.view',
    ])
    expect(await screen.findByRole('cell', { name: 'Sick Leave' })).toBeVisible()
    expect(screen.queryByRole('link', { name: '+ Add New' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Allotment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Sick Leave' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Status of Sick Leave' })).toBeDisabled()
    const tabs = screen.getByRole('navigation', { name: 'Leave settings' })
    expect(within(tabs).queryByRole('link', { name: 'General Settings' })).not.toBeInTheDocument()
  })

  it('hides Apply Leave from someone with no employee record', async () => {
    renderApp('/leaves/my-leaves')
    useAuthStore.getState().setSession({
      token: useAuthStore.getState().token ?? '',
      user: { ...DEMO_USER, employeeId: null },
    })
    expect(await screen.findByRole('heading', { name: 'My Leaves' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '+ Apply Leave' })).not.toBeInTheDocument()
  })
})
