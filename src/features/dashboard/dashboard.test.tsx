import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { openings } from '@/mocks/recruitment/db'
import { warningPolicies } from '@/mocks/warning-policies/handlers'
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

describe('Dashboard', { timeout: 60_000 }, () => {
  it('shows the HR dashboard figures, each opening its list', async () => {
    const { user, router } = renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }, { timeout: 15_000 }),
    ).toBeVisible()
    await waitFor(() => {
      expect(within(tile('Headcount')).getByText('248')).toBeVisible()
    })
    expect(within(tile('Present today')).getByText('221')).toBeVisible()
    expect(within(tile('On leave')).getByText('14')).toBeVisible()

    // Open positions: Recruitment's open job openings.
    const open = openings.all().filter((opening) => opening.status === 'open').length
    await waitFor(() => {
      expect(within(tile('Open positions')).getByText(String(open))).toBeVisible()
    })
    // Only the active warning policies count (the seed has an inactive one).
    const active = warningPolicies.all().filter((policy) => policy.isActive).length
    expect(active).toBeLessThan(warningPolicies.all().length)
    await waitFor(() => {
      expect(within(tile('Active warning policies')).getByText(String(active))).toBeVisible()
    })

    expect(screen.getByRole('link', { name: 'Headcount: 248' })).toHaveAttribute(
      'href',
      '/talent-management',
    )
    expect(screen.getByRole('link', { name: 'On leave: 14' })).toHaveAttribute(
      'href',
      '/leaves/applications',
    )
    await user.click(screen.getByRole('link', { name: `Open positions: ${String(open)}` }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/recruitment/openings')
    })
  })

  it('falls back to the employee dashboard, which has no headcount', async () => {
    renderAs('/', ['dashboard.employee.view'])

    await screen.findByRole('list', { name: 'Key figures' }, { timeout: 15_000 })
    await waitFor(() => {
      expect(within(tile('Present today')).getByText('1')).toBeVisible()
    })
    expect(within(tile('Headcount')).getByText('Not on your dashboard')).toBeVisible()
    // A tile without a figure opens nothing.
    expect(screen.queryByRole('link', { name: /^Headcount/ })).not.toBeInTheDocument()
    // No warning or recruitment permission: no policy card and no counts.
    expect(screen.queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument()
    expect(within(tile('Active warning policies')).getByText('No access')).toBeVisible()
    expect(within(tile('Open positions')).getByText('No access')).toBeVisible()
  })
})
