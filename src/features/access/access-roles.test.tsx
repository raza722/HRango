import { configure, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import { PERMISSION_CATALOGUE } from '@/mocks/access/catalogue'
import { accessRoles } from '@/mocks/access/db'
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

async function refusal(call: Promise<unknown>) {
  try {
    await call
  } catch (error) {
    if (error instanceof ApiError) return { status: error.status, message: error.message }
    throw error
  }
  throw new Error('The call was not refused')
}

/** Opens a module of the permission editor and returns it. */
async function openModule(user: UserEvent, name: string) {
  const region = await screen.findByRole('region', { name }, { timeout: 15_000 })
  await user.click(within(region).getByRole('button', { name: new RegExp(`^${name}`) }))
  return region
}

describe('Settings → User Group Permissions', { timeout: 60_000 }, () => {
  it('lists the roles with their counts and system badge, retired ones on request', async () => {
    const { user, router } = renderApp('/settings/user-group-permissions')

    expect(
      await screen.findByRole(
        'heading',
        { name: 'User Group Permissions', level: 1 },
        { timeout: 15_000 },
      ),
    ).toBeVisible()
    const table = await screen.findByRole('table', { name: 'Roles' })
    for (const header of ['Role', 'Users', 'Permissions', 'Updated']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    const hr = (await within(table).findByRole('link', { name: 'HR Manager' })).closest('tr')!
    expect(hr).toHaveTextContent('System')
    const cells = within(hr).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('1')
    expect(cells[2]).toHaveTextContent(String(accessRoles.find('6')?.permissions.length))
    const recruiter = within(table).getByRole('link', { name: 'Recruiter' }).closest('tr')!
    expect(recruiter).not.toHaveTextContent('System')
    expect(within(recruiter).getAllByRole('cell')[1]).toHaveTextContent('2')
    expect(within(table).queryByRole('link', { name: 'IT Support' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Include retired' }))
    const retired = (await within(table).findByRole('link', { name: 'IT Support' })).closest('tr')!
    expect(retired).toHaveTextContent('Retired')
    expect(router.state.location.search).toMatchObject({ retired: true })

    await user.type(screen.getByRole('searchbox', { name: 'Search roles' }), 'support{Enter}')
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(2)
    })
    expect(within(table).getByRole('link', { name: 'IT Support' })).toBeVisible()
  })

  it('adds a role after checking its name, then opens it', async () => {
    const { user, router } = renderApp('/settings/user-group-permissions')

    await user.click(await screen.findByRole('button', { name: '+ Add Role' }, { timeout: 15_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Role' })
    await user.click(within(dialog).getByRole('button', { name: 'Add Role' }))
    expect(await within(dialog).findByText('Enter a name.')).toBeVisible()

    const name = within(dialog).getByRole('textbox', { name: /^Name/ })
    await user.type(name, 'hr manager')
    await user.click(within(dialog).getByRole('button', { name: 'Add Role' }))
    expect(await within(dialog).findByText('Another role has this name.')).toBeVisible()

    await user.clear(name)
    await user.type(name, 'Auditor')
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Description' }),
      'Reads the books once a year.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add Role' }))

    expect(await screen.findByRole('heading', { name: 'Auditor', level: 1 })).toBeVisible()
    const role = accessRoles.all().find((row) => row.name === 'Auditor')
    expect(role).toMatchObject({ isSystem: false, isActive: true, permissions: [] })
    expect(router.state.location.pathname).toBe(
      `/settings/user-group-permissions/${role?.id ?? ''}`,
    )
    expect(await screen.findByText('No unsaved changes')).toBeVisible()
  })

  it('ticks permissions with scopes and selected units, selects a screen, and saves them all', async () => {
    const { user } = renderApp('/settings/user-group-permissions/11')

    const payroll = await openModule(user, 'Payroll')
    expect(
      within(payroll).getByRole('checkbox', { name: 'Select all in Payroll' }),
    ).toHaveAttribute('aria-checked', 'mixed')
    // Sensitive ticks are marked, with the hint written under them.
    const slips = within(payroll).getByRole('checkbox', { name: 'Pay Slips: View' })
    expect(slips.closest('li')).toHaveTextContent('Sensitive')
    expect(slips.closest('li')).toHaveTextContent('With the Company scope: everyone’s pay slips.')

    await user.click(slips)
    const scope = within(payroll).getByRole('combobox', { name: 'Scope of Pay Slips: View' })
    expect(scope).toHaveValue('company')
    await user.selectOptions(scope, 'selected_units')
    expect(screen.getByText('1 unsaved change')).toBeVisible()

    // Selected units needs a unit: said before anything is sent.
    await user.click(screen.getByRole('button', { name: 'Save Permissions' }))
    expect(
      await screen.findByText('1 tick with Selected units needs at least one unit.'),
    ).toBeVisible()
    expect(
      within(payroll).getByText('Choose at least one branch, department or location.'),
    ).toBeVisible()

    await user.click(within(payroll).getByRole('combobox', { name: 'Units of Pay Slips: View' }))
    await user.click(await screen.findByRole('option', { name: /^Lahore Head Office/ }))
    await user.keyboard('{Escape}')

    // Select all of one screen.
    const sheet = within(payroll).getByRole('checkbox', { name: 'Select all: Salary Sheet' })
    expect(sheet).toHaveAttribute('aria-checked', 'false')
    await user.click(sheet)
    expect(sheet).toHaveAttribute('aria-checked', 'true')
    expect(within(payroll).getByRole('checkbox', { name: 'Salary Sheet: Print' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByText('4 unsaved changes')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Save Permissions' }))
    expect(await screen.findByText('Finance Viewer: 7 permissions saved')).toBeInTheDocument()
    expect(await screen.findByText('No unsaved changes')).toBeVisible()
    const saved = accessRoles.find('11')?.permissions ?? []
    expect(saved).toHaveLength(7)
    expect(saved.find((tick) => tick.code === 'payroll.payslips.view')).toEqual({
      code: 'payroll.payslips.view',
      scope: 'selected_units',
      units: [{ unitType: 'branch', unitId: 'br_lhr_ho' }],
    })
    expect(saved.find((tick) => tick.code === 'payroll.salary_sheet.print')?.scope).toBe('company')
  })

  it('searches the catalogue and shows ticked ones only', async () => {
    const { user, router } = renderApp('/settings/user-group-permissions/8')

    await user.type(
      await screen.findByRole('searchbox', { name: 'Search permissions' }, { timeout: 15_000 }),
      'salary sheet{Enter}',
    )
    const payroll = await screen.findByRole('region', { name: 'Payroll' })
    expect(within(payroll).getAllByRole('checkbox', { name: /^Salary Sheet: / })).toHaveLength(3)
    expect(screen.queryByRole('region', { name: 'Requests' })).not.toBeInTheDocument()
    expect(router.state.location.search).toMatchObject({ q: 'salary sheet' })

    await user.clear(screen.getByRole('searchbox', { name: 'Search permissions' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), '{Enter}')
    await user.click(screen.getByRole('button', { name: 'Ticked only' }))
    const requests = await screen.findByRole('region', { name: 'Requests' })
    expect(within(requests).getAllByRole('checkbox', { checked: true }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('region', { name: 'Payroll' })).not.toBeInTheDocument()
  })

  it('asks before leaving with unsaved ticks', async () => {
    const { user, router } = renderApp('/settings/user-group-permissions/11')

    const assets = await openModule(user, 'Assets')
    await user.click(within(assets).getByRole('checkbox', { name: 'Company Assets: View' }))
    expect(screen.getByRole('tab', { name: /Permissions/ })).toHaveTextContent('1')

    await user.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'User Group Permissions' }),
    )
    const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(ask).getByRole('button', { name: 'Keep editing' }))
    expect(router.state.location.pathname).toBe('/settings/user-group-permissions/11')
    expect(screen.getByText('1 unsaved change')).toBeVisible()

    await user.click(
      within(screen.getByRole('main')).getByRole('link', { name: 'User Group Permissions' }),
    )
    await confirm(user, 'Discard your changes?', 'Discard')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/settings/user-group-permissions')
    })
    expect(accessRoles.find('11')?.permissions).toHaveLength(3)
  })

  it('keeps Company Administrator’s ticks fixed', async () => {
    renderApp('/settings/user-group-permissions/1')
    expect(
      await screen.findByText(
        'Company Administrator always holds every permission. Copy it to make a role you can change.',
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible()
    expect(screen.getByRole('checkbox', { name: 'Select all in Payroll' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save Permissions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retire' })).not.toBeInTheDocument()
    signIn()
    const role = await accessApi.role('1')
    expect(role.permissions).toHaveLength(PERMISSION_CATALOGUE.length)
    expect((await refusal(accessApi.saveRolePermissions('1', [], role.rowVersion))).status).toBe(
      409,
    )
  })

  it('copies a role under a new name', async () => {
    const { user } = renderApp('/settings/user-group-permissions/6')

    await user.click(await screen.findByRole('button', { name: 'Copy' }, { timeout: 15_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Copy HR Manager' })
    const name = within(dialog).getByRole('textbox', { name: /^New Name/ })
    expect(name).toHaveValue('Copy of HR Manager')
    await user.clear(name)
    await user.type(name, 'Line Manager')
    await user.click(within(dialog).getByRole('button', { name: 'Copy Role' }))
    expect(await within(dialog).findByText('Another role has this name.')).toBeVisible()

    await user.clear(name)
    await user.type(name, 'HR Manager (Karachi)')
    await user.click(within(dialog).getByRole('button', { name: 'Copy Role' }))

    expect(
      await screen.findByRole('heading', { name: 'HR Manager (Karachi)', level: 1 }),
    ).toBeVisible()
    const copy = accessRoles.all().find((role) => role.name === 'HR Manager (Karachi)')
    expect(copy?.isSystem).toBe(false)
    expect(copy?.permissions).toEqual(accessRoles.find('6')?.permissions)
    // A copy is not a system role: it can be retired and deleted.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  it('retires and restores a role', async () => {
    const { user } = renderApp('/settings/user-group-permissions')

    await rowAction(user, 'Actions for Finance Viewer', 'Retire')
    await confirm(user, 'Retire Finance Viewer?', 'Retire Role')
    expect(await screen.findByText('Finance Viewer retired')).toBeInTheDocument()
    expect(accessRoles.find('11')?.isActive).toBe(false)
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Finance Viewer' })).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('checkbox', { name: 'Include retired' }))
    await rowAction(user, 'Actions for Finance Viewer', 'Restore')
    await confirm(user, 'Restore Finance Viewer?', 'Restore Role')
    expect(await screen.findByText('Finance Viewer restored')).toBeInTheDocument()
    expect(accessRoles.find('11')?.isActive).toBe(true)
  })

  it('refuses to delete a system role or a role people hold, and deletes an unused one', async () => {
    const { user } = renderApp('/settings/user-group-permissions')

    // A system role offers no Delete (nor Retire).
    await user.click(
      await screen.findByRole('button', { name: 'Actions for HR Manager' }, { timeout: 15_000 }),
    )
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Retire' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // A role people hold: Delete explains, and offers Retire instead.
    await rowAction(user, 'Actions for Payroll Officer', 'Delete')
    const refusedDialog = await screen.findByRole('alertdialog', {
      name: 'Payroll Officer can’t be deleted',
    })
    expect(refusedDialog).toHaveTextContent('2 people hold Payroll Officer')
    await user.click(within(refusedDialog).getByRole('button', { name: 'Retire Instead' }))
    await confirm(user, 'Retire Payroll Officer?', 'Retire Role')
    expect(await screen.findByText('Payroll Officer retired')).toBeInTheDocument()

    // The API refuses both too.
    signIn()
    const hr = await accessApi.role('6')
    expect(await refusal(accessApi.deleteRole('6', hr.rowVersion))).toEqual({
      status: 409,
      message: 'System roles can’t be deleted.',
    })
    const officer = await accessApi.role('9')
    expect((await refusal(accessApi.deleteRole('9', officer.rowVersion))).message).toBe(
      '2 people have Payroll Officer, so it can’t be deleted. Take it away from them or retire it.',
    )
    expect((await refusal(accessApi.setRoleRetired('6', true, hr.rowVersion))).status).toBe(409)

    // Nobody holds Finance Viewer: it goes.
    await rowAction(user, 'Actions for Finance Viewer', 'Delete')
    await confirm(user, 'Delete Finance Viewer?', 'Delete Role')
    expect(await screen.findByText('Finance Viewer deleted')).toBeInTheDocument()
    expect(accessRoles.find('11')).toBeUndefined()
  })

  it('lists the people who hold a role and its history', async () => {
    const { user } = renderApp('/settings/user-group-permissions/9?tab=users')

    const table = await screen.findByRole(
      'table',
      { name: 'People with Payroll Officer' },
      { timeout: 15_000 },
    )
    expect(await within(table).findByRole('link', { name: 'Omer Farooq' })).toBeVisible()
    expect(within(table).getByRole('link', { name: 'Hina Raza' })).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'History' }))
    const changes = await screen.findByRole('list', { name: 'Changes' })
    expect(changes).toHaveTextContent('Permissions changed')
    expect(changes).toHaveTextContent('76 permissions')
  })
})
