import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { MOCK_TOKEN_PREFIX } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

const card = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) })

describe('Configuration', () => {
  it('links to the setup screens, grouped by what they configure', async () => {
    renderApp('/configuration')

    expect(await screen.findByRole('heading', { name: 'Configuration' })).toBeVisible()
    for (const section of ['Assets', 'Requests', 'Checklists', 'Module settings']) {
      expect(screen.getByRole('heading', { name: section })).toBeVisible()
    }

    const links: [string, string][] = [
      ['Company Assets', '/assets/company-assets'],
      ['Asset Types', '/assets/types'],
      ['Request Restriction', '/requests/settings/restrictions'],
      ['Delegation', '/requests/settings/delegation'],
      ['Request Flows', '/requests/settings/flows'],
      ['Off Boarding Checklist', '/settings/off-boarding/checklist'],
      ['Attendance Settings', '/attendance/settings'],
      ['Leave Settings', '/leaves/settings/general'],
      ['Payroll Settings', '/payroll/settings/general'],
      ['Control Panel', '/settings/control-panel'],
    ]
    for (const [name, href] of links) {
      expect(card(name)).toHaveAttribute('href', href)
    }
  })

  it('opens a screen from its card', async () => {
    const { user } = renderApp('/configuration')
    await user.click(await screen.findByRole('link', { name: /^Asset Types/ }))
    expect(
      await screen.findByRole('heading', { name: 'Asset Types', level: 1 }, { timeout: 15_000 }),
    ).toBeVisible()
  })

  it('shows only the screens the user may view', async () => {
    renderApp('/configuration')
    act(() => {
      useAuthStore.getState().setSession({
        token: `${MOCK_TOKEN_PREFIX}test`,
        user: {
          ...DEMO_USER,
          permissions: [
            { code: 'requests.settings.flows.view', scope: 'company' },
            // Scheduling's settings live on the Attendance Settings page too.
            { code: 'scheduling.settings.rest_days.view', scope: 'company' },
          ],
        },
      })
    })

    expect(await screen.findByRole('link', { name: /^Request Flows/ })).toBeVisible()
    expect(card('Attendance Settings')).toBeVisible()
    expect(screen.queryByRole('link', { name: /^Delegation/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Company Assets/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Assets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Checklists' })).not.toBeInTheDocument()
  })
})
