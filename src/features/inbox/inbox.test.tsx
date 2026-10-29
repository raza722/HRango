import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

describe('Inbox', { timeout: 60_000 }, () => {
  it('shows unread notifications from /inbox and marks them all read', async () => {
    const { user } = renderApp('/settings/control-panel/general')

    const bell = await screen.findByRole(
      'button',
      { name: 'Notifications, 2 unread' },
      { timeout: 15_000 },
    )
    await user.click(bell)
    expect(await screen.findByText('3 late arrivals today')).toBeVisible()
    expect(screen.getByText('Policy updated')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
    })
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('opens a notification’s link and marks it read', async () => {
    const { user, router } = renderApp('/settings/control-panel/general')

    await user.click(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' }, { timeout: 15_000 }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /Leave request/ }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/requests/leave')
    })
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible()
  }, 60_000)

  it('keeps the messages menu empty (no chat in the API)', async () => {
    const { user } = renderApp('/settings/control-panel/general')

    await user.click(await screen.findByRole('button', { name: 'Messages' }, { timeout: 15_000 }))
    expect(await screen.findByText('No messages')).toBeVisible()
  })

  it('hides the bell without inbox.notifications.view', async () => {
    renderApp('/settings/control-panel/general')
    useAuthStore.getState().setSession({
      token: useAuthStore.getState().token ?? '',
      user: {
        ...DEMO_USER,
        permissions: [{ code: 'organisation.general.view', scope: 'company' }],
      },
    })

    expect(
      await screen.findByRole(
        'heading',
        { name: 'General Settings', level: 1 },
        { timeout: 15_000 },
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument()
  })
})
