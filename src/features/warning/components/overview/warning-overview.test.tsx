import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/test-utils'

function timeInput(label: string): HTMLElement {
  const input = screen.getAllByLabelText(label).find((el) => el.getAttribute('type') === 'time')
  if (!input) throw new Error(`No time input labelled ${label}`)
  return input
}

describe('Warning overview', () => {
  it('shows the change log grouped by day, deletes an entry and clears it all', async () => {
    const { user } = renderApp('/warning')
    await screen.findByRole('table', { name: 'Warning policies' })

    await user.click(screen.getByRole('button', { name: 'History' }))
    const dialog = await screen.findByRole('dialog', { name: 'History' })
    expect(await within(dialog).findByText(/^Today - /)).toBeInTheDocument()
    expect(within(dialog).getByText(/^Yesterday - /)).toBeInTheDocument()
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(7)

    // View expands the details; Delete removes the entry.
    const firstEntry = 'Actions for Policy updated — Grace'
    await user.click(within(dialog).getByRole('button', { name: firstEntry }))
    await user.click(await screen.findByRole('menuitem', { name: 'View' }))
    expect(within(dialog).getByText('Shelley Kannes')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: firstEntry }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await waitFor(() => {
      expect(within(dialog).getAllByRole('listitem')).toHaveLength(6)
    })

    await user.click(within(dialog).getByRole('button', { name: 'Delete All' }))
    await user.click(await screen.findByRole('button', { name: 'Delete All', hidden: false }))
    expect(await within(dialog).findByText('No changes recorded yet.')).toBeInTheDocument()
  })

  it('hides a column chosen in Column Preferences, but never the last one', async () => {
    const { user } = renderApp('/warning')
    const table = await screen.findByRole('table', { name: 'Warning policies' })
    expect(within(table).getByRole('columnheader', { name: 'Time Span' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Column preferences' }))
    const panel = await screen.findByRole('dialog', { name: 'Column Preferences' })
    const policyGroup = within(panel).getByRole('group', { name: 'Warning Policy' })
    await user.click(within(policyGroup).getByRole('checkbox', { name: 'Time Span' }))

    expect(within(table).queryByRole('columnheader', { name: 'Time Span' })).not.toBeInTheDocument()

    // Turn off all but one; the last checkbox is then locked.
    for (const name of ['Sr #', 'Policy Name']) {
      await user.click(within(policyGroup).getByRole('checkbox', { name }))
    }
    expect(
      within(policyGroup).getByRole('checkbox', { name: 'Title of Warning Policy' }),
    ).toBeDisabled()
  })
})

describe('Warning → Penalty, end to end', () => {
  it('creates a penalty and lists it', async () => {
    const { user } = renderApp('/warning/penalty')
    await screen.findByRole('table', { name: 'Penalties' })
    expect(screen.getByText('Showing 1–5 of 6')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title of Warning Policy'), 'Night shift penalty')
    fireEvent.change(timeInput('From'), { target: { value: '21:00' } })
    fireEvent.change(timeInput('To'), { target: { value: '21:30' } })
    await user.type(screen.getByLabelText('Points'), '4')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Penalty saved')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Showing 6–7 of 7')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Title of Warning Policy')).toHaveValue('')
  })
})
