import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp, setViewportWidth } from '@/test/test-utils'

/** The time inputs share their label text with the "Clock In" select, so pick by type. */

describe('routing and auth gate', () => {
  it('sends signed-out visitors to /login and remembers where they were going', async () => {
    const { router } = renderApp('/warning/policy?page=2', { signedIn: false })

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ redirect: '/warning/policy?page=2' })
  })

  it('shows the 404 page for unknown URLs, inside the shell with its own title', async () => {
    renderApp('/no-such-page')
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }, { timeout: 15_000 }),
    ).toBeInTheDocument()
    // Signed in: the sidebar and top bar are there, and the page is the shell's main region.
    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { name: 'Page not found' })).toBeVisible()
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    await waitFor(() => {
      expect(document.title).toBe('Page not found | hRango')
    })
  })

  it('shows the 404 page signed out in a main region of its own', async () => {
    renderApp('/no-such-page', { signedIn: false })
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }, { timeout: 15_000 }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: /Back to dashboard/ }),
    ).toBeVisible()
  })

  it('opens the Warning overview with both lists inside the shell', async () => {
    const { router, user } = renderApp('/warning')

    expect(await screen.findByRole('heading', { name: 'Policy', level: 1 })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Warning policies' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Penalties' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Warning' })).toHaveAttribute('aria-current', 'page')

    // "+ Add Form" on the Penalty card leads to the penalty form.
    const [, penaltyAddForm] = screen.getAllByRole('link', { name: 'Add Form' })
    await user.click(penaltyAddForm!)
    expect(
      await screen.findByRole('heading', { name: 'Warning Policy', level: 1 }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/warning/penalty')
  })
})

describe('phone layout', () => {
  it('uses the drawer, stacked policy cards and a compact pager at 375px', async () => {
    setViewportWidth(375)
    const { user } = renderApp('/warning/policy')

    const list = await screen.findByRole('list', { name: 'Warning policies' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    // Pager keeps its accessible names even though the words are icons here.
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = await screen.findByRole('dialog', { name: 'Main navigation' })
    // Performance is a tree: open it, then follow one of its pages.
    await user.click(within(drawer).getByRole('button', { name: /^Performance/ }))
    await user.click(await within(drawer).findByRole('link', { name: 'Overview' }))

    expect(
      await screen.findByRole('heading', { name: 'Performance Overview', level: 1 }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Main navigation' })).not.toBeInTheDocument()
    })
  })
})

describe('Warning → Policy, end to end', () => {
  // The full create flow (save, duplicate title, refreshed table) is in features/warning; here the
  // page opens inside the app shell and validates before anything is sent.
  it('opens the policy form and validates before calling the API', async () => {
    const { user } = renderApp('/warning/policy')
    await screen.findByRole('table', { name: 'Warning policies' })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Enter at least 2 characters')).toBeInTheDocument()
  })
})
