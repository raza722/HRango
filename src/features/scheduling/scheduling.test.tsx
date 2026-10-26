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

/** The first scheduled Morning Work shift of a person on the board. */
async function firstShift(name: string) {
  const [shift] = await screen.findAllByRole('button', {
    name: new RegExp(`^${name}, .*: Morning Work`),
  })
  if (!shift) throw new Error(`No shift for ${name}`)
  return shift
}

describe('Scheduling board', () => {
  it('opens on "My" with the signed-in person and the Active Status box', async () => {
    const { router, user } = renderApp('/scheduling?view=week')

    expect(await screen.findByRole('heading', { name: 'Scheduling', level: 1 })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'My' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('rowheader', { name: /Shelley Kannes/ })).toBeVisible()
    expect(
      screen.getAllByRole('rowheader').filter((cell) => cell.textContent !== 'Planned Hours'),
    ).toHaveLength(1)
    expect(screen.getByRole('status', { name: 'Your active status' })).toBeVisible()
    // My has no admin toolbar.
    expect(screen.queryByRole('button', { name: 'Apply Default Shift' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Scheduling' })).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('tab', { name: 'All' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ scope: 'all' })
    })
    expect(await screen.findByRole('button', { name: 'Apply Default Shift' })).toBeVisible()
    expect(await screen.findByText(/Showing 1 to 10 of \d+ employees/)).toBeVisible()
  })

  it('views a shift and deletes it from the cell actions', async () => {
    const { user } = renderApp('/scheduling?scope=all&view=week')

    await user.click(await firstShift('Omar Siddiqui'))
    await user.click(await screen.findByRole('button', { name: /^View Omar Siddiqui/ }))
    const view = await screen.findByRole('dialog', { name: 'View Scheduling' })
    expect(await within(view).findByText('Morning Work')).toBeVisible()
    expect(within(view).getByText(/Lunch Break/)).toBeVisible()
    await user.click(within(view).getByRole('button', { name: 'Cancel' }))

    const shift = await firstShift('Omar Siddiqui')
    const label = shift.getAttribute('aria-label') ?? ''
    await user.click(shift)
    await user.click(await screen.findByRole('button', { name: /^Delete Omar Siddiqui/ }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText(/Rest Days will not be Deleted/)).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))

    expect(await screen.findByText('Shift deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    })
  })

  it('selects several shifts in multiselect mode and deletes them together', async () => {
    const { user } = renderApp('/scheduling?scope=all&view=week')

    await screen.findAllByRole('button', { name: /^Omar Siddiqui, / })
    await user.click(screen.getByRole('button', { name: 'Enable/Disable Multiselect' }))
    const shifts = screen.getAllByRole('button', { name: /^Omar Siddiqui, .*: Morning Work/ })
    await user.click(shifts[0]!)
    await user.click(shifts[1]!)
    expect(shifts[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 selected')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Multi Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect(await screen.findByText('2 shifts deleted')).toBeInTheDocument()
  })

  it('swaps a shift with another person through the Swap dialog', async () => {
    const { user } = renderApp('/scheduling?scope=all&view=week')

    await user.click(await firstShift('Shelley Kannes'))
    await user.click(await screen.findByRole('button', { name: /^Swap Shelley Kannes/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Swap Shift' })
    await choose(user, 'Swap with', 'Bilal Ahmed (Id-005)')
    expect(within(dialog).getByText(/trade places|moves to them/)).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Swap' }))
    expect(await screen.findByText(/Shifts swapped|Shift moved/)).toBeInTheDocument()
  })

  it('leaves out the actions the user has no permission for', async () => {
    renderApp('/scheduling?scope=all&view=week')
    useAuthStore.getState().setSession({
      token: useAuthStore.getState().token ?? '',
      user: {
        ...DEMO_USER,
        permissions: [{ code: 'scheduling.schedules.view', scope: 'company' }],
      },
    })

    await firstShift('Omar Siddiqui')
    expect(screen.queryByRole('button', { name: 'Apply Default Shift' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Enable/Disable Multiselect' }),
    ).not.toBeInTheDocument()
  })
})

describe('Scheduling dialogs', () => {
  it('creates a schedule from a time slot in two steps, replacing planned shifts', async () => {
    const { user } = renderApp('/scheduling?scope=all&view=week')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Scheduling' })
    await user.click(within(dialog).getByRole('button', { name: 'Next' }))
    expect(await within(dialog).findByText('Select a time slot')).toBeVisible()

    await choose(user, 'Time Slot', /^Morning Work/)
    await user.click(within(dialog).getByRole('button', { name: 'Next' }))

    const review = await screen.findByRole('dialog', { name: 'Create Scheduling, review' })
    expect(within(review).getByText(/days? for each employee/)).toBeVisible()

    await user.click(within(review).getByRole('button', { name: 'Save' }))
    expect(await within(review).findByText('Select at least one employee')).toBeVisible()

    await user.click(await within(review).findByRole('checkbox', { name: 'Select Kashif Raza' }))
    await user.click(within(review).getByRole('button', { name: 'Save' }))
    // Kashif already works these days: the API refuses (409) until "replace" is ticked.
    expect(await within(review).findByRole('alert')).toHaveTextContent(/already have a shift/)

    await user.click(
      within(review).getByRole('checkbox', { name: 'Replace shifts already planned' }),
    )
    await user.click(within(review).getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText(/^Schedule saved: \d+ shifts? added, \d+ replaced/),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('creates a schedule from a time roster for its enrolled members', async () => {
    const { user } = renderApp('/scheduling?scope=all&view=week')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Scheduling' })
    await user.click(within(dialog).getByRole('radio', { name: 'Time Roster' }))
    await choose(user, 'Time Roster', 'Part Time')
    await user.click(within(dialog).getByRole('button', { name: 'Next' }))

    const review = await screen.findByRole('dialog', { name: 'Create Scheduling, review' })
    expect(within(review).getByText(/everyone enrolled in the roster/)).toBeVisible()
    await user.click(within(review).getByRole('button', { name: 'Save' }))
    // Nobody is enrolled in Part Time, so nothing is planned.
    expect(await screen.findByText(/^Schedule saved: 0 shifts added/)).toBeVisible()
  })

  it('applies the default shift to chosen employees', async () => {
    const { user } = renderApp('/scheduling?scope=all&view=week')

    await user.click(await screen.findByRole('button', { name: 'Apply Default Shift' }))
    const dialog = await screen.findByRole('dialog', { name: 'Apply Default Shift' })
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Replace shifts already planned' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Next' }))

    const pick = await screen.findByRole('dialog', { name: 'Select Employees' })
    await user.click(await within(pick).findByRole('checkbox', { name: 'Select Laiba Shah' }))
    expect(within(pick).getByRole('button', { name: 'Remove Laiba Shah' })).toBeVisible()
    await user.click(within(pick).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/^Default shift applied/)).toBeInTheDocument()
  })

  it('deletes a date range for everyone after confirming', async () => {
    const { user } = renderApp('/scheduling?scope=all&view=week')

    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Scheduling' })
    expect(within(dialog).getByRole('checkbox', { name: 'Delete for All Employees' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect(
      await screen.findByText(/^\d+ shifts? deleted$|^There was nothing to delete in that range$/),
    ).toBeInTheDocument()
  })
})
