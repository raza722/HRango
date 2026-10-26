import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { MOCK_TOKEN_PREFIX } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

describe('Warning overview', () => {
  it('shows the change log grouped by day, with details per entry', async () => {
    const { user } = renderApp('/warning')
    await screen.findByRole('table', { name: 'Warning policies' })

    await user.click(screen.getByRole('button', { name: 'History' }))
    const dialog = await screen.findByRole('dialog', { name: 'History' })
    expect(await within(dialog).findByText(/^Today - /)).toBeInTheDocument()
    expect(within(dialog).getByText(/^Yesterday - /)).toBeInTheDocument()
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(7)
    // The audit log cannot be deleted.
    expect(within(dialog).queryByRole('button', { name: 'Delete All' })).not.toBeInTheDocument()

    const firstEntry = 'Actions for Policy updated — Grace (Total Grace Minutes)'
    await user.click(within(dialog).getByRole('button', { name: firstEntry }))
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('menuitem', { name: 'View' }))
    expect(within(dialog).getByText('Shelley Kannes')).toBeInTheDocument()
    expect(within(dialog).getByText('480 → 600')).toBeInTheDocument()
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
    for (const name of ['Sr #', 'Policy Name', 'Status']) {
      await user.click(within(policyGroup).getByRole('checkbox', { name }))
    }
    expect(
      within(policyGroup).getByRole('checkbox', { name: 'Title of Warning Policy' }),
    ).toBeDisabled()
  })

  it('hides the buttons the user has no permission for', async () => {
    renderApp('/warning')
    act(() => {
      useAuthStore.getState().setSession({
        token: `${MOCK_TOKEN_PREFIX}test`,
        user: {
          ...DEMO_USER,
          permissions: [
            { code: 'warning.settings.policies.view', scope: 'company' },
            { code: 'warning.settings.penalties.view', scope: 'company' },
          ],
        },
      })
    })
    const table = await screen.findByRole('table', { name: 'Warning policies' })
    await within(table).findAllByRole('row')
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add Form' })).not.toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument()
  })
})

describe('Warning → Policy, end to end', () => {
  it('creates a policy and shows a duplicate title next to the field', async () => {
    const { user } = renderApp('/warning/policy')
    await screen.findByRole('table', { name: 'Warning policies' })

    await user.type(screen.getByLabelText('Title of Warning Policy'), 'Late')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findAllByText('A warning policy with this title already exists.'),
    ).not.toHaveLength(0)

    await user.clear(screen.getByLabelText('Title of Warning Policy'))
    await user.type(screen.getByLabelText('Title of Warning Policy'), 'Night shift late')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Policy saved')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByLabelText('Title of Warning Policy')).toHaveValue('')
    })
  })
})

describe('Warning → Penalty, end to end', () => {
  it("adds a penalty to a policy's penalties and lists it", async () => {
    const { user } = renderApp('/warning/penalty?edit=4')
    await screen.findByRole('table', { name: 'Penalties' })
    expect(screen.getByText('Showing 1–5 of 6')).toBeInTheDocument()
    expect(await screen.findByText(/Penalties of/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Penalty' }))
    expect(screen.getByLabelText('Count')).toHaveValue('1')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Penalties saved')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Showing 1–5 of 7')).toBeInTheDocument()
    })
  })
})
