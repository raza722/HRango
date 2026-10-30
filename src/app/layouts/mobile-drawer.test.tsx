import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { renderApp, setViewportWidth } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

describe('phone menu drawer', { timeout: 60_000 }, () => {
  afterEach(() => {
    setViewportWidth(1024)
  })

  it('has its close button beside the brand and closes back to the menu button', async () => {
    setViewportWidth(375)
    const { user } = renderApp('/')
    const open = await screen.findByRole('button', { name: 'Open menu' }, { timeout: 15_000 })
    await user.click(open)
    const drawer = await screen.findByRole('dialog', { name: 'Main navigation' })
    // One close button, in the brand row with the company link (not laid over it).
    const close = within(drawer).getByRole('button', { name: 'Close menu' })
    expect(within(drawer).queryByRole('button', { name: 'Close' })).toBeNull()
    expect(close.parentElement).toBe(
      within(drawer).getByRole('link', { name: / - go to dashboard$/ }).parentElement,
    )
    await user.click(close)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Main navigation' })).toBeNull()
    })
    await waitFor(() => {
      expect(open).toHaveFocus()
    })
  })
})
