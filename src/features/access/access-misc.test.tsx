import { configure, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { apiPath } from '@/mocks/utils'
import { renderApp, setViewportWidth } from '@/test/test-utils'

import { createUserFormSchema, overrideFormSchema, tickErrors } from './schemas/access-forms.schema'
import { passwordIssue } from './schemas/password.schema'
import { countChanges, draftOf } from './utils/permission-tree'

configure({ asyncUtilTimeout: 4000 })

describe('Access: errors, phone width and the screens around it', { timeout: 60_000 }, () => {
  it('shows the API error with Try again (never an empty list), then the accounts', async () => {
    let fail = true
    server.use(
      http.get(apiPath('/access/users'), () =>
        fail
          ? HttpResponse.json({ message: 'The access service is down.' }, { status: 500 })
          : undefined,
      ),
    )
    const { user } = renderApp('/settings/system-users')

    const alert = await screen.findByRole('alert', {}, { timeout: 15_000 })
    expect(within(alert).getByText('The access service is down.')).toBeVisible()
    expect(
      screen.queryByText('No accounts yet. + Add User adds the first one.'),
    ).not.toBeInTheDocument()

    fail = false
    await user.click(within(alert).getByRole('button', { name: /Try again/ }))
    expect(await screen.findByRole('link', { name: 'Administrator' })).toBeVisible()
  })

  it('says when the role or the catalogue cannot be read', async () => {
    server.use(
      http.get(apiPath('/access/permissions'), () =>
        HttpResponse.json({ message: 'Catalogue unavailable.' }, { status: 503 }),
      ),
    )
    renderApp('/settings/user-group-permissions/6')
    const alert = await screen.findByRole('alert', {}, { timeout: 15_000 })
    expect(alert).toHaveTextContent('Could not load the permission catalogue')
    expect(alert).toHaveTextContent('Catalogue unavailable.')
  })

  it('says when an account does not exist', async () => {
    renderApp('/settings/system-users/999')
    expect(
      await screen.findByRole('heading', { name: 'Account not found' }, { timeout: 15_000 }),
    ).toBeVisible()
  })

  it('stacks the lists into cards at phone width', async () => {
    setViewportWidth(375)
    renderApp('/settings/system-users')
    const list = await screen.findByRole('list', { name: 'System users' }, { timeout: 15_000 })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(screen.queryByRole('table', { name: 'System users' })).not.toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Actions for Bilal Ahmed' })).toBeVisible()
  })

  it('opens the role editor at phone width', async () => {
    setViewportWidth(375)
    const { user } = renderApp('/settings/user-group-permissions/10')
    const recruitment = await screen.findByRole(
      'region',
      { name: 'Recruitment' },
      { timeout: 15_000 },
    )
    await user.click(within(recruitment).getByRole('button', { name: /^Recruitment/ }))
    expect(
      within(recruitment).getByRole('combobox', { name: 'Scope of Offers: View' }),
    ).toHaveValue('selected_units')
    expect(screen.getByRole('button', { name: 'Save Permissions' })).toBeVisible()
  })

  it('sends Control Panel → Users to System Users', async () => {
    const { router } = renderApp('/settings/control-panel/users')
    expect(
      await screen.findByRole('heading', { name: 'System Users', level: 1 }, { timeout: 15_000 }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/settings/system-users')
  })

  it('still lists the roles in Request Flows, now from the Access mock', async () => {
    const { user } = renderApp('/requests/settings/flows')

    await user.click(await screen.findByRole('button', { name: 'Create' }, { timeout: 15_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Request Flow Create' })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Node, row 1' }), [
      'Role',
    ])
    await user.click(within(dialog).getByRole('combobox', { name: 'Role, row 1' }))
    const options = await screen.findAllByRole('option')
    const names = options.map((option) => option.textContent)
    for (const role of ['Company Administrator', 'HR Manager', 'HR Officer', 'Line Manager']) {
      expect(names).toContain(role)
    }
    expect(names).toContain('Payroll Officer')
    // Retired roles are not offered.
    expect(names).not.toContain('IT Support')
    await waitFor(() => {
      expect(options.length).toBeGreaterThanOrEqual(7)
    })
  })
})

describe('Access schemas', () => {
  const account = {
    email: 'new.person@topedge.tech',
    displayName: '',
    employeeId: null,
    isActive: true,
    isSystemAdmin: false,
    companyIds: ['co_topedge'],
    roleIds: [],
    password: 'Strong#Pass1',
    confirm: 'Strong#Pass1',
  }
  const messages = (result: {
    success: boolean
    error?: { issues: readonly { path: PropertyKey[]; message: string }[] }
  }) =>
    Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
    )

  it('checks the password rules', () => {
    expect(passwordIssue('Strong#Pass1')).toBeNull()
    expect(passwordIssue('weakpass')).toBe(
      'The password needs an uppercase and a lowercase letter, a number and a symbol.',
    )
    expect(passwordIssue('Ab1!')).toBe('The password needs at least 8 characters.')
  })

  it('checks a new account', () => {
    expect(createUserFormSchema.safeParse(account).success).toBe(true)
    expect(
      messages(
        createUserFormSchema.safeParse({
          ...account,
          email: 'x@y',
          companyIds: [],
          confirm: 'Other#Pass1',
        }),
      ),
    ).toEqual({
      email: 'Enter a valid email address, like name@company.com.',
      companyIds: 'Choose at least one company.',
      confirm: 'The passwords don’t match.',
    })
  })

  it('needs a scope on a grant and a reason on every override', () => {
    expect(
      messages(
        overrideFormSchema.safeParse({
          code: 'payroll.reports.view',
          effect: 'grant',
          scope: '',
          reason: '',
        }),
      ),
    ).toEqual({ reason: 'Say why, for the history.', scope: 'Choose how far the grant reaches.' })
    expect(
      overrideFormSchema.safeParse({
        code: 'payroll.reports.view',
        effect: 'deny',
        scope: '',
        reason: 'Audit',
      }).success,
    ).toBe(true)
  })

  it('finds ticks without units and counts changes', () => {
    expect(
      tickErrors([
        { code: 'a.b.view', scope: 'selected_units', units: [] },
        { code: 'a.b.edit', scope: 'company', units: [] },
      ]),
    ).toEqual({ 'a.b.view': 'Choose at least one branch, department or location.' })
    const saved = draftOf([
      {
        code: 'a.b.view',
        module: 'A',
        screen: 'B',
        actionCode: 'view',
        label: 'B: View',
        isSensitive: false,
        scope: 'company',
        units: [],
      },
    ])
    expect(countChanges(saved, saved)).toBe(0)
    expect(
      countChanges(
        saved,
        new Map([
          ['a.b.view', { scope: 'own', units: [] }],
          ['a.b.edit', { scope: 'company', units: [] }],
        ]),
      ),
    ).toBe(2)
    expect(countChanges(saved, new Map())).toBe(1)
  })
})
