import { configure, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import { accessAudit, accessOverrides, accessSessions, accessUsers } from '@/mocks/access/db'
import { renderApp, signIn } from '@/test/test-utils'

import { accessApi } from './api/access.api'

configure({ asyncUtilTimeout: 4000 })

async function rowAction(user: UserEvent, name: string, action: string) {
  await user.click(await screen.findByRole('button', { name }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

async function confirm(user: UserEvent, title: string | RegExp, button: string) {
  const dialog = await screen.findByRole('alertdialog', { name: title })
  await user.click(within(dialog).getByRole('button', { name: button }))
}

const liveSessions = (userId: string) =>
  accessSessions.all().filter((session) => session.userAccountId === userId && !session.revokedAt)
    .length

/** The field errors of a refused call. */
async function refusal(call: Promise<unknown>) {
  try {
    await call
  } catch (error) {
    if (error instanceof ApiError)
      return { status: error.status, fields: error.fieldErrors, message: error.message }
    throw error
  }
  throw new Error('The call was not refused')
}

describe('Settings → System Users', { timeout: 60_000 }, () => {
  it('lists the accounts and filters them by status, role, search and employees who left', async () => {
    const { user, router } = renderApp('/settings/system-users')

    expect(
      await screen.findByRole('heading', { name: 'System Users', level: 1 }, { timeout: 15_000 }),
    ).toBeVisible()
    const table = await screen.findByRole('table', { name: 'System users' })
    for (const header of ['User', 'Linked Employee', 'Roles', 'Last Login', 'Status']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(await within(table).findByRole('link', { name: 'Administrator' })).toBeVisible()
    const admin = within(table).getByRole('link', { name: 'Administrator' }).closest('tr')!
    expect(admin).toHaveTextContent('System admin')
    expect(admin).toHaveTextContent('Company Administrator')
    expect(admin).toHaveTextContent('None')
    expect(screen.getByText('Showing 1–10 of 13')).toBeVisible()

    // Disabled only.
    await user.click(screen.getByRole('button', { name: 'Disabled' }))
    expect(await within(table).findByRole('link', { name: 'Faisal Khan' })).toBeVisible()
    await waitFor(() => {
      expect(within(table).queryByRole('link', { name: 'Administrator' })).not.toBeInTheDocument()
    })
    expect(router.state.location.search).toMatchObject({ status: 'disabled' })
    await user.click(screen.getByRole('button', { name: 'All' }))

    // A role.
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(await screen.findByRole('option', { name: /^Recruiter/ }))
    expect(await within(table).findByRole('link', { name: 'Laiba Shah' })).toBeVisible()
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(3)
    })
    expect(within(table).getByRole('link', { name: 'Sadia Rehman' })).toBeVisible()
    expect(router.state.location.search).toMatchObject({ roleId: '10' })

    // Employees who left: Nida Hassan's account is still on.
    await user.click(screen.getByRole('button', { name: /Clear filters/ }))
    await user.click(screen.getByRole('combobox', { name: 'Employee' }))
    await user.click(await screen.findByRole('option', { name: 'Employee has left' }))
    expect(await within(table).findByRole('link', { name: 'Nida Hassan' })).toBeVisible()
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(2)
    })
    expect(
      within(table).getByRole('link', { name: 'Nida Hassan' }).closest('tr'),
    ).toHaveTextContent('Left')

    // No employee linked, then a search.
    await user.click(screen.getByRole('combobox', { name: 'Employee' }))
    await user.click(await screen.findByRole('option', { name: 'No employee linked' }))
    expect(await within(table).findByRole('link', { name: 'Administrator' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Clear filters/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'omer{Enter}')
    expect(await within(table).findByRole('link', { name: 'Omer Farooq' })).toBeVisible()
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(2)
    })
    expect(router.state.location.search).toMatchObject({ q: 'omer' })
  })

  it('checks a new account first (email, password rules), refuses a used email, then adds it', async () => {
    const { user, router } = renderApp('/settings/system-users?dialog=create')

    const dialog = await screen.findByRole('dialog', { name: 'Add User' }, { timeout: 15_000 })
    // Every problem at once, before anything is sent.
    await user.click(within(dialog).getByRole('button', { name: 'Add User' }))
    expect(await within(dialog).findByText('Enter an email address.')).toBeVisible()
    expect(within(dialog).getByText('Enter a password.')).toBeVisible()
    expect(within(dialog).getByText('Type the password again.')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: /^Email/ }), 'not-an-email')
    await user.type(within(dialog).getByLabelText(/^Initial Password/), 'short1')
    await user.type(within(dialog).getByLabelText(/^Confirm Password/), 'short2')
    await user.click(within(dialog).getByRole('button', { name: 'Add User' }))
    expect(
      await within(dialog).findByText('Enter a valid email address, like name@company.com.'),
    ).toBeVisible()
    expect(
      within(dialog).getByText(
        'The password needs at least 8 characters, an uppercase and a lowercase letter and a symbol.',
      ),
    ).toBeVisible()
    expect(within(dialog).getByText('The passwords don’t match.')).toBeVisible()
    // The rules list says which are met.
    const rules = within(dialog).getByRole('list', { name: 'Password rules' })
    expect(within(rules).getByText(/A number/)).toHaveTextContent('(met)')

    // An email another account uses: the API's answer lands on Email.
    const email = within(dialog).getByRole('textbox', { name: /^Email/ })
    await user.clear(email)
    await user.type(email, 'Sara.Khan@topedge.tech')
    const password = within(dialog).getByLabelText(/^Initial Password/)
    await user.clear(password)
    await user.type(password, 'Welcome#2026')
    const again = within(dialog).getByLabelText(/^Confirm Password/)
    await user.clear(again)
    await user.type(again, 'Welcome#2026')
    await user.click(within(dialog).getByRole('combobox', { name: /^Roles/ }))
    await user.click(await screen.findByRole('option', { name: /^Recruiter/ }))
    await user.keyboard('{Escape}')
    await user.click(within(dialog).getByRole('button', { name: 'Add User' }))
    expect(await within(dialog).findByText('Another account uses this email.')).toBeVisible()

    await user.clear(email)
    await user.type(email, 'new.recruiter@topedge.tech')
    await user.type(within(dialog).getByRole('textbox', { name: 'Display Name' }), 'New Recruiter')
    await user.click(within(dialog).getByRole('button', { name: 'Add User' }))

    expect(await screen.findByRole('heading', { name: 'New Recruiter', level: 1 })).toBeVisible()
    const created = accessUsers.all().find((row) => row.email === 'new.recruiter@topedge.tech')
    expect(created).toMatchObject({ roleIds: ['10'], companyIds: ['co_topedge'], isActive: true })
    expect(router.state.location.pathname).toBe(`/settings/system-users/${created?.id ?? ''}`)
    expect(
      accessAudit.all().some((row) => row.entityId === created?.id && row.actionName === 'Created'),
    ).toBe(true)
  })

  it('asks before making someone a system admin', async () => {
    const { user } = renderApp('/settings/system-users?edit=5')
    const dialog = await screen.findByRole('dialog', { name: 'Edit User' }, { timeout: 15_000 })
    await user.click(await within(dialog).findByRole('switch', { name: /^System Admin/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await confirm(user, 'Make Laiba Shah a system admin?', 'Make System Admin')
    expect(await screen.findByText('Laiba Shah saved')).toBeInTheDocument()
    expect(accessUsers.find('5')?.isSystemAdmin).toBe(true)
  })

  it('edits an account’s roles all at once', async () => {
    const { user } = renderApp('/settings/system-users/8')

    expect(
      await screen.findByRole('heading', { name: 'Bilal Ahmed', level: 1 }, { timeout: 15_000 }),
    ).toBeVisible()
    const held = await screen.findByRole('list', { name: 'Roles of this account' })
    expect(within(held).getByRole('link', { name: 'Line Manager' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Edit Roles' }))
    await user.click(await screen.findByRole('checkbox', { name: /Recruiter/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Line Manager/ }))
    expect(screen.getByText('2 roles ticked')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save Roles' }))

    expect(await screen.findByText('Bilal Ahmed’s roles saved')).toBeInTheDocument()
    expect(accessUsers.find('8')?.roleIds).toEqual(['2', '10'])
    const after = await screen.findByRole('list', { name: 'Roles of this account' })
    expect(within(after).getByRole('link', { name: 'Recruiter' })).toBeVisible()
    expect(within(after).queryByRole('link', { name: 'Line Manager' })).not.toBeInTheDocument()
  })

  it('disables an account with a confirm that says its sessions end, and enables it again', async () => {
    const { user } = renderApp('/settings/system-users?q=sara')

    expect(liveSessions('9')).toBe(2)
    await rowAction(user, 'Actions for Sara Khan', 'Disable')
    const dialog = await screen.findByRole('alertdialog', { name: 'Disable Sara Khan’s account?' })
    expect(dialog).toHaveTextContent('every session they have open ends now')
    await user.click(within(dialog).getByRole('button', { name: 'Disable Account' }))

    expect(await screen.findByText('Sara Khan’s account is disabled')).toBeInTheDocument()
    expect(accessUsers.find('9')?.isActive).toBe(false)
    expect(liveSessions('9')).toBe(0)
    const row = (await screen.findByRole('link', { name: 'Sara Khan' })).closest('tr')!
    await waitFor(() => {
      expect(row).toHaveTextContent('Disabled')
    })

    await rowAction(user, 'Actions for Sara Khan', 'Enable')
    await confirm(user, 'Enable Sara Khan’s account?', 'Enable Account')
    expect(await screen.findByText('Sara Khan’s account is enabled')).toBeInTheDocument()
    expect(accessUsers.find('9')?.isActive).toBe(true)
  })

  it('offers no Disable on your own account, and the API refuses it and your last admin role', async () => {
    const { user } = renderApp('/settings/system-users?q=shelley')
    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Actions for Shelley Kannes' },
        { timeout: 15_000 },
      ),
    )
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Change Password' })).toBeVisible()
    expect(within(menu).queryByRole('menuitem', { name: 'Disable' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    signIn()
    const me = await accessApi.user('2')
    expect((await refusal(accessApi.setUserActive('2', false, me.rowVersion))).message).toBe(
      'You can’t disable your own account.',
    )
    const roles = await refusal(accessApi.setUserRoles('2', [], me.rowVersion))
    expect(roles.status).toBe(422)
    expect(roles.fields.roleIds).toBe(
      'HR Manager is your last role that can assign roles: you can’t remove it from yourself.',
    )
    // A stale rowVersion is a 409.
    expect((await refusal(accessApi.setUserRoles('2', ['6', '8'], 'old'))).status).toBe(409)
  })

  it('shows effective permissions grouped by module with their sources and denials', async () => {
    const { user } = renderApp('/settings/system-users/6?tab=permissions')

    const payroll = await screen.findByRole(
      'list',
      { name: 'Payroll permissions' },
      { timeout: 15_000 },
    )
    const slips = within(payroll).getByText('Pay Slips: View').closest('li')!
    expect(slips).toHaveTextContent('Own, Company')
    expect(slips).toHaveTextContent('Payroll Officer')
    expect(slips).toHaveTextContent('Employee')
    expect(within(slips).getByText('Sensitive')).toBeVisible()
    // The denial shows in its module with the reason, and is not held.
    const denied = within(payroll).getByText('Monthly Payroll: Close').closest('li')!
    expect(denied).toHaveTextContent('Denied')
    expect(denied).toHaveTextContent('Closing a payroll needs Hina Raza’s sign-off.')

    await user.type(
      screen.getByRole('searchbox', { name: 'Search permissions' }),
      'vouchers{Enter}',
    )
    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Dashboards permissions' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('list', { name: 'Payroll permissions' })).toHaveTextContent(
      'Vouchers: Approve',
    )
  })

  it('adds a denial override with its reason, shows it, and removes it', async () => {
    const { user } = renderApp('/settings/system-users/9?tab=overrides')

    const table = await screen.findByRole(
      'table',
      { name: 'Sara Khan’s overrides' },
      { timeout: 15_000 },
    )
    expect(await within(table).findByText('Reports: View')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '+ Add Override' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Override' })
    await user.click(within(dialog).getByRole('button', { name: 'Save Override' }))
    expect(await within(dialog).findByText('Choose a permission.')).toBeVisible()
    expect(within(dialog).getByText('Say why, for the history.')).toBeVisible()

    await user.click(within(dialog).getByRole('combobox', { name: /^Permission/ }))
    await user.type(await screen.findByRole('searchbox'), 'approvals: approve')
    await user.click(await screen.findByRole('option', { name: /^Approvals: Approve/ }))
    await user.click(within(dialog).getByRole('combobox', { name: /^Effect/ }))
    await user.click(await screen.findByRole('option', { name: 'Deny' }))
    expect(within(dialog).queryByRole('combobox', { name: /^Scope/ })).not.toBeInTheDocument()
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Reason/ }),
      'On leave this month.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save Override' }))

    expect(await screen.findByText('Denied: Approvals: Approve')).toBeInTheDocument()
    const row = (await within(table).findByText('Approvals: Approve')).closest('tr')!
    expect(row).toHaveTextContent('Deny')
    expect(row).toHaveTextContent('Every scope')
    expect(row).toHaveTextContent('On leave this month.')
    expect(
      accessOverrides
        .all()
        .find((item) => item.userAccountId === '9' && item.code === 'requests.approvals.approve'),
    ).toMatchObject({ effect: 'deny', scope: null })

    // The denial wins over Line Manager on the Permissions tab.
    signIn()
    const held = await accessApi.effectivePermissions('9')
    expect(held.some((permission) => permission.code === 'requests.approvals.approve')).toBe(false)
    expect(held.find((permission) => permission.code === 'payroll.reports.view')?.sources).toEqual([
      'Grant',
    ])

    await user.click(
      within(row).getByRole('button', { name: 'Remove override: Approvals: Approve' }),
    )
    await confirm(user, 'Remove the denial of Approvals: Approve?', 'Remove Override')
    expect(await screen.findByText('Override removed: Approvals: Approve')).toBeInTheDocument()
    await waitFor(() => {
      expect(within(table).queryByText('Approvals: Approve')).not.toBeInTheDocument()
    })
  })

  it('ends one session, then all of them', async () => {
    const { user } = renderApp('/settings/system-users/9?tab=sessions')

    const table = await screen.findByRole(
      'table',
      { name: 'Sara Khan’s sessions' },
      { timeout: 15_000 },
    )
    expect(await within(table).findByText('Samsung Internet on Android')).toBeVisible()
    for (const header of ['Device', 'IP Address', 'Signed In', 'Last Seen']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(screen.getByText('2 sessions signed in now')).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: 'End session on Samsung Internet on Android' }),
    )
    await confirm(user, 'End the session on Samsung Internet on Android?', 'End Session')
    expect(await screen.findByText('Signed out: Samsung Internet on Android')).toBeInTheDocument()
    expect(await screen.findByText('1 session signed in now')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'End All' }))
    await confirm(user, 'End all of Sara Khan’s sessions?', 'End All Sessions')
    expect(await screen.findByText('1 session of Sara Khan ended')).toBeInTheDocument()
    expect(await screen.findByText('Sara Khan is not signed in anywhere.')).toBeVisible()
    expect(liveSessions('9')).toBe(0)

    // Ended too: both are listed, as ended.
    await user.click(screen.getByRole('button', { name: 'Ended too' }))
    expect(await screen.findByText('2 sessions')).toBeVisible()
  })

  it('sets someone’s password with the rules, which signs them out', async () => {
    const { user } = renderApp('/settings/system-users/3')

    await user.click(
      await screen.findByRole('button', { name: 'Set Password' }, { timeout: 15_000 }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Set Kaleem Murtaza’s password' })
    expect(dialog).toHaveTextContent('signs Kaleem Murtaza out on every device')
    await user.type(within(dialog).getByLabelText(/^New Password/), 'password')
    await user.type(within(dialog).getByLabelText(/^Confirm Password/), 'Password')
    await user.click(within(dialog).getByRole('button', { name: 'Set Password' }))
    expect(
      await within(dialog).findByText(
        'The password needs an uppercase and a lowercase letter, a number and a symbol.',
      ),
    ).toBeVisible()
    expect(within(dialog).getByText('The passwords don’t match.')).toBeVisible()

    const fresh = within(dialog).getByLabelText(/^New Password/)
    await user.clear(fresh)
    await user.type(fresh, 'Kaleem@2026!')
    const again = within(dialog).getByLabelText(/^Confirm Password/)
    await user.clear(again)
    await user.type(again, 'Kaleem@2026!')
    await user.click(within(dialog).getByRole('button', { name: 'Show new password' }))
    expect(within(dialog).getByLabelText(/^New Password/)).toHaveAttribute('type', 'text')
    expect(liveSessions('3')).toBe(1)
    await user.click(within(dialog).getByRole('button', { name: 'Set Password' }))

    expect(await screen.findByText('New password set for Kaleem Murtaza')).toBeInTheDocument()
    expect(accessUsers.find('3')?.password).toBe('Kaleem@2026!')
    expect(liveSessions('3')).toBe(0)
  })

  it('changes your own password on your account, checking the current one', async () => {
    const { user } = renderApp('/settings/system-users/2')

    await user.click(
      await screen.findByRole('button', { name: 'Change Password' }, { timeout: 15_000 }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Change Password' })
    await user.type(within(dialog).getByLabelText(/^Current Password/), 'Wrong#Pass1')
    await user.type(within(dialog).getByLabelText(/^New Password/), 'Shelley#2027')
    await user.type(within(dialog).getByLabelText(/^Confirm New Password/), 'Shelley#2027')
    await user.click(within(dialog).getByRole('button', { name: 'Change Password' }))
    expect(await within(dialog).findByText('That isn’t your current password.')).toBeVisible()

    const current = within(dialog).getByLabelText(/^Current Password/)
    await user.clear(current)
    await user.type(current, 'Demo@1234')
    await user.click(within(dialog).getByRole('button', { name: 'Change Password' }))
    expect(await screen.findByText('Your password is changed')).toBeInTheDocument()
    // The newest session (this one) stays; the phone's ends.
    const mine = accessSessions.all().filter((session) => session.userAccountId === '2')
    expect(mine.find((session) => session.id === '1')?.revokedAt).toBeNull()
    expect(mine.find((session) => session.id === '2')?.revokedAt).not.toBeNull()
  })

  it('keeps the account history', async () => {
    renderApp('/settings/system-users/5?tab=history')
    const changes = await screen.findByRole('list', { name: 'Changes' }, { timeout: 15_000 })
    expect(within(changes).getByText('Roles changed')).toBeVisible()
    expect(changes).toHaveTextContent('Recruiter, Employee')
    expect(changes).toHaveTextContent('Shelley Kannes')
  })
})
