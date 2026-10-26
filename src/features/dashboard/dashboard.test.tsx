import { screen, waitFor, within } from '@testing-library/react'
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

const tile = (label: string) => {
  const figures = screen.getByRole('list', { name: 'Key figures' })
  const item = within(figures)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(label))
  if (!item) throw new Error(`No tile ${label}`)
  return item
}

describe('Dashboard', () => {
  it('shows the HR dashboard figures, and an empty state for figures the API lacks', async () => {
    renderApp('/')

    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
    await waitFor(() => {
      expect(within(tile('Headcount')).getByText('248')).toBeVisible()
    })
    expect(within(tile('Present today')).getByText('221')).toBeVisible()
    expect(within(tile('On leave')).getByText('14')).toBeVisible()
    expect(within(tile('Open positions')).getByText('Not available yet')).toBeVisible()
  })

  it('falls back to the employee dashboard, which has no headcount', async () => {
    renderAs('/', ['dashboard.employee.view'])

    await screen.findByRole('list', { name: 'Key figures' })
    await waitFor(() => {
      expect(within(tile('Present today')).getByText('1')).toBeVisible()
    })
    expect(within(tile('Headcount')).getByText('Not on your dashboard')).toBeVisible()
    // No warning permission: no policy card and no count.
    expect(screen.queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument()
    expect(within(tile('Warning policies')).getByText('No access')).toBeVisible()
  })
})
