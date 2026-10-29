import { configure, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

describe('account menu', { timeout: 60_000 }, () => {
  it('opens Change Password and gives focus back to the menu button when it closes', async () => {
    const { user } = renderApp('/')
    const account = await screen.findByRole(
      'button',
      { name: /^Account menu for / },
      { timeout: 15_000 },
    )
    await user.click(account)
    await user.click(await screen.findByRole('menuitem', { name: 'Change Password' }))
    expect(await screen.findByRole('dialog', { name: 'Change Password' })).toBeVisible()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Change Password' })).toBeNull()
    })
    await waitFor(() => {
      expect(account).toHaveFocus()
    })
  })
})
