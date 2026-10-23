import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/test-utils'

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

    expect(await screen.findByText(/has 22 enrolled employees/)).toBeInTheDocument()
    expect(await screen.findByText('Hybrid Work')).toBeVisible()
  })
})

describe('Roster group dialog', () => {
  it('adds a group whose working days follow "Apply For All"', async () => {
    const { user, router } = renderApp('/roster')

    await user.click(await screen.findByRole('button', { name: 'Add New' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Roster Group' })
    expect(router.state.location.search).toMatchObject({ dialog: 'add' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Group Title' }), 'Night Shift')
    fireEvent.change(within(dialog).getByLabelText('Clock In', { selector: 'input' }), {
      target: { value: '22:00' },
    })
    fireEvent.change(within(dialog).getByLabelText('Clock Out', { selector: 'input' }), {
      target: { value: '06:00' },
    })
    expect(within(dialog).getByRole('status', { name: 'Defined minutes' })).toHaveTextContent(
      '480 minutes',
    )

    await user.click(within(dialog).getByRole('checkbox', { name: 'Apply For All' }))
    expect(within(dialog).getByLabelText('Monday clock in')).toHaveValue('22:00')
    expect(within(dialog).getByLabelText('Monday clock in')).toBeDisabled()
    expect(
      within(dialog).getByRole('status', { name: 'Friday defined minutes' }),
    ).toHaveTextContent('480 minutes')
    expect(
      within(dialog).getByRole('status', { name: 'Sunday defined minutes' }),
    ).toHaveTextContent('Day off')

    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Roster group “Night Shift” created')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Add Roster Group' })).not.toBeInTheDocument()
    expect(await screen.findByText('Night Shift')).toBeVisible()
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
    expect(within(dialog).getAllByText('4:15 PM').length).toBeGreaterThan(0)
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

    // Sort by name, A to Z.
    await user.click(within(dialog).getByRole('button', { name: 'Name' }))
    const active = within(dialog).getByRole('table', { name: 'Active enrollments' })
    expect(await within(active).findByText('Areeba Hameed')).toBeVisible()
    expect(within(active).getAllByRole('row')[1]).toHaveTextContent('Areeba Hameed')

    await user.click(within(dialog).getByRole('button', { name: 'Enroll New Employee' }))
    await user.click(await within(dialog).findByRole('checkbox', { name: /Imran Butt/ }))
    expect(within(dialog).getByRole('checkbox', { name: /Dr Kamal/ })).toBeDisabled()
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
    expect(await within(left).findByText('Areeba Hameed')).toBeVisible()
    expect(within(left).getByText('Talha Aziz')).toBeVisible()
  })
})
