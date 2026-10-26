import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

/** Opens a Radix select by its label and picks an option. */
async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Signs in with only these permission codes (the API sends them with the user). */
function withPermissions(codes: string[]) {
  useAuthStore.getState().setSession({
    token: useAuthStore.getState().token ?? '',
    user: { ...DEMO_USER, permissions: codes.map((code) => ({ code, scope: 'company' })) },
  })
}

describe('Roster list', () => {
  it('lists the roster groups with their enrolled counts', async () => {
    renderApp('/roster')

    const table = await screen.findByRole('table', { name: 'Roster groups' })
    const hybrid = (await within(table).findByText('Hybrid Work')).closest('tr')
    expect(hybrid).not.toBeNull()
    expect(within(hybrid!).getByText('22')).toBeVisible()
    expect(within(hybrid!).getByRole('switch', { name: 'Hybrid Work is active' })).toBeChecked()
    expect(screen.getByText('Showing 1 to 5 of 5 entries')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Roster' })).toHaveAttribute('aria-current', 'page')
  })

  it('refuses to delete a group that still has enrolled employees', async () => {
    const { user } = renderApp('/roster')

    await user.click(await screen.findByRole('button', { name: 'Delete Hybrid Work' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    )

    expect(
      await screen.findByText(/Employees are enrolled in this roster group/),
    ).toBeInTheDocument()
    expect(await screen.findByText('Hybrid Work')).toBeVisible()
  })

  it('hides the actions the user has no permission for', async () => {
    renderApp('/roster')
    withPermissions(['roster.groups.view', 'roster.enrolments.view'])

    expect(await screen.findByRole('button', { name: 'View Hybrid Work' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enroll employees in Hybrid Work' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add New' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Hybrid Work' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Hybrid Work' })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Hybrid Work is active' })).toBeDisabled()
  })
})

describe('Roster group dialog', () => {
  it('adds a group whose working days follow the time slot of "Apply For All"', async () => {
    const { user, router } = renderApp('/roster')

    await user.click(await screen.findByRole('button', { name: 'Add New' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Roster Group' })
    expect(router.state.location.search).toMatchObject({ dialog: 'add' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Group Title' }), 'Night Shift')
    await choose(user, 'Time Slot', /Swing Shift Doctors/)
    expect(within(dialog).getByRole('status', { name: 'Defined minutes' })).toHaveTextContent(
      '510 minutes',
    )

    await user.click(within(dialog).getByRole('checkbox', { name: 'Apply For All' }))
    expect(within(dialog).getByRole('combobox', { name: 'Monday time slot' })).toBeDisabled()
    expect(within(dialog).getByRole('combobox', { name: 'Monday time slot' })).toHaveTextContent(
      /Swing Shift Doctors/,
    )
    expect(
      within(dialog).getByRole('status', { name: 'Friday defined minutes' }),
    ).toHaveTextContent('510 minutes')
    expect(
      within(dialog).getByRole('status', { name: 'Sunday defined minutes' }),
    ).toHaveTextContent('Day off')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Roster group “Night Shift” created')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Add Roster Group' })).not.toBeInTheDocument()
    expect(await screen.findByText('Night Shift')).toBeVisible()
  })

  it('wants a time slot on every working day', async () => {
    const { user } = renderApp('/roster?dialog=add')

    const dialog = await screen.findByRole('dialog', { name: 'Add Roster Group' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Group Title' }), 'Half week')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect((await within(dialog).findAllByText('Select a time slot')).length).toBe(5)
  })

  it('shows a group read-only in View', async () => {
    const { user } = renderApp('/roster')

    await user.click(await screen.findByRole('button', { name: 'View Hybrid Work' }))
    const dialog = await screen.findByRole('dialog', { name: 'View' })

    expect(dialog).toHaveAccessibleDescription('Hybrid Work')
    expect(
      within(dialog).getByRole('status', { name: 'Monday defined minutes' }),
    ).toHaveTextContent('120 minutes')
    expect(
      within(dialog).getByRole('status', { name: 'Sunday defined minutes' }),
    ).toHaveTextContent('65 minutes')
    expect(within(dialog).getAllByText(/4:15 PM/).length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText(/Hybrid Evening/).length).toBeGreaterThan(0)
  })
})

describe('Enrollment dialog', () => {
  it('pages the enrolled employees, enrolls one more and discontinues one', async () => {
    const { user } = renderApp('/roster')

    await user.click(await screen.findByRole('button', { name: 'Enroll employees in Hybrid Work' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Enroll Employee in “Hybrid Work” Roster',
    })
    expect(await within(dialog).findByText('Showing 1 to 10 of 22 entries')).toBeVisible()
    const active = within(dialog).getByRole('table', { name: 'Active enrollments' })
    expect(within(active).getAllByRole('row')[1]).toHaveTextContent('Areeba Hameed')

    // Someone already on a roster for those dates is refused by the API (409).
    await user.click(within(dialog).getByRole('button', { name: 'Enroll New Employee' }))
    await user.click(await within(dialog).findByRole('checkbox', { name: /Dr Kamal/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText(/already on a roster for these dates/),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('checkbox', { name: /Dr Kamal/ }))
    // Typing searches the server (`q`); the list then holds only the matches.
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search employees' }), 'Imran')
    await waitFor(() => {
      expect(within(dialog).queryByRole('checkbox', { name: /Dr Kamal/ })).not.toBeInTheDocument()
    })
    await user.click(await within(dialog).findByRole('checkbox', { name: /Imran Butt/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Imran Butt enrolled')).toBeInTheDocument()
    expect(await within(dialog).findByText('Showing 1 to 10 of 23 entries')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Actions for Areeba Hameed' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Discontinue' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discontinue' }),
    )
    expect(await screen.findByText('Areeba Hameed moved to Discontinued')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('tab', { name: 'Discontinued' }))
    const left = await within(dialog).findByRole('table', { name: 'Discontinued enrollments' })
    await waitFor(() => {
      expect(within(left).getByText('Areeba Hameed')).toBeVisible()
    })
    expect(within(left).getByText('Talha Aziz')).toBeVisible()
  })
})
