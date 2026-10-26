import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

/** Renders as a user who holds only these permission codes (as the API's `/auth/me` sends them). */
function renderAs(path: string, codes: string[]) {
  const result = renderApp(path)
  useAuthStore.getState().setSession({
    token: useAuthStore.getState().token ?? '',
    user: { ...DEMO_USER, permissions: codes.map((code) => ({ code, scope: 'company' })) },
  })
  return result
}

/** Opens a Radix select by its label and picks an option. */
async function choose(user: UserEvent, label: string, option: string) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('Settings navigation', () => {
  it('opens the Control Panel from /settings with the Settings sub-menu expanded', async () => {
    const { router } = renderApp('/settings')

    expect(
      await screen.findByRole('heading', { name: 'General Settings', level: 1 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/settings/control-panel/general')

    const sidebar = screen.getByRole('navigation', { name: 'Main' })
    expect(within(sidebar).getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(within(sidebar).getByRole('link', { name: 'Control Panel' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(sidebar).getByRole('link', { name: 'Biometric Devices' })).toBeInTheDocument()

    const panel = screen.getByRole('navigation', { name: 'Control Panel' })
    expect(within(panel).getByRole('link', { name: 'General Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

describe('Branches', () => {
  it('validates, then creates a branch under a location and area', async () => {
    const { user, router } = renderApp('/settings/control-panel/branches')

    const table = await screen.findByRole('table', { name: 'Branches' })
    expect(await within(table).findByRole('link', { name: 'Lahore Head Office' })).toBeVisible()

    await user.click(screen.getByRole('link', { name: 'Add Branch' }))
    expect(await screen.findByRole('heading', { name: 'Branch Create', level: 1 })).toBeVisible()
    expect(
      await screen.findByRole('group', { name: 'Branch location on the map' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter the branch name')).toBeVisible()
    expect(screen.getByText('Select a location')).toBeVisible()
    // Records belong to the active company: there is no Company field.
    expect(screen.queryByRole('combobox', { name: 'Company' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Area' })).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Gulberg Annex')
    await choose(user, 'Location', 'Lahore')
    await choose(user, 'Area', 'Gulberg')
    // A new branch starts at its location's coordinates.
    expect(await screen.findByDisplayValue('31.5136')).toBe(
      screen.getByRole('textbox', { name: 'Latitude' }),
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('link', { name: 'Gulberg Annex' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/settings/control-panel/branches')
    expect(await screen.findByText('Branch “Gulberg Annex” created')).toBeInTheDocument()
  })

  it('asks before leaving a form with unsaved changes', async () => {
    const { user, router } = renderApp('/settings/control-panel/branches/new')

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Draft branch')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(router.state.location.pathname).toBe('/settings/control-panel/branches/new')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Draft branch')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }),
    )
    expect(await screen.findByRole('table', { name: 'Branches' })).toBeInTheDocument()
  })
})

describe('Job titles', () => {
  it('requires Max Head Count once Limit Head Count is ticked and reports duplicates', async () => {
    const { user } = renderApp('/settings/control-panel/job-titles/new')

    expect(await screen.findByRole('heading', { name: 'Job Title', level: 1 })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Max Head Count' })).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'HR Manager')
    await user.click(screen.getByRole('checkbox', { name: 'Limit Head Count' }))
    const maxHeadCount = await screen.findByRole('textbox', { name: 'Max Head Count' })

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter the maximum head count')).toBeVisible()

    await user.type(maxHeadCount, '3')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    // "HR Manager" already exists: the API's field error lands on Name.
    // (The same text is also the error toast.)
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
        'A job title with this name already exists.',
      )
    })
  })
})

describe('Locations', () => {
  it('puts a location back when the API refuses to delete it', async () => {
    const { user } = renderApp('/settings/control-panel/locations')

    const table = await screen.findByRole('table', { name: 'Locations' })
    await user.click(await within(table).findByRole('button', { name: 'Actions for Lahore' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )

    expect(
      await screen.findByText('This location has branches. Move or delete them first'),
    ).toBeInTheDocument()
    expect(await within(table).findByRole('link', { name: 'Lahore' })).toBeVisible()
  })
})

describe('Permissions', () => {
  it('shows a list read-only without create / edit / delete codes', async () => {
    renderAs('/settings/control-panel/branches', ['organisation.branches.view'])

    const table = await screen.findByRole('table', { name: 'Branches' })
    expect(await within(table).findByText('Lahore Head Office')).toBeVisible()
    expect(
      within(table).queryByRole('link', { name: 'Lahore Head Office' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add Branch' })).not.toBeInTheDocument()
    expect(
      within(table).queryByRole('button', { name: 'Actions for Lahore Head Office' }),
    ).not.toBeInTheDocument()

    // The Control Panel menu keeps only what the user may open (plus pages with no API).
    const panel = screen.getByRole('navigation', { name: 'Control Panel' })
    expect(within(panel).getByRole('link', { name: 'Branch' })).toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: 'Location' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: 'General Settings' })).not.toBeInTheDocument()
  })

  it('offers only the actions held', async () => {
    const { user } = renderAs('/settings/control-panel/job-titles', [
      'organisation.job_titles.view',
      'organisation.job_titles.delete',
    ])

    const table = await screen.findByRole('table', { name: 'Job titles' })
    await user.click(await within(table).findByRole('button', { name: 'Actions for Accountant' }))
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows General Settings without Save to a user who may only view them', async () => {
    renderAs('/settings/control-panel/general', ['organisation.general.view'])

    expect(
      await screen.findByRole('heading', { name: 'General Settings', level: 1 }),
    ).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Top Edge Technologies')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })
})
