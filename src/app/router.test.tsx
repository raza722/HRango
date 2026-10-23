import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp, setViewportWidth } from '@/test/test-utils'

/** The time inputs share their label text with the "Clock In" select, so pick by type. */
function timeInput(label: string): HTMLElement {
  const input = screen.getAllByLabelText(label).find((el) => el.getAttribute('type') === 'time')
  if (!input) throw new Error(`No time input labelled ${label}`)
  return input
}

describe('routing and auth gate', () => {
  it('sends signed-out visitors to /login and remembers where they were going', async () => {
    const { router } = renderApp('/warning/policy?page=2', { signedIn: false })

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ redirect: '/warning/policy?page=2' })
  })

  it('shows the 404 page for unknown URLs', async () => {
    renderApp('/no-such-page')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    const drawer = await screen.findByRole('dialog', { name: 'Main navigation' })
    await user.click(within(drawer).getByRole('link', { name: 'Performance' }))

    expect(
      await screen.findByRole('heading', { name: 'Performance', level: 1 }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Main navigation' })).not.toBeInTheDocument()
    })
  })
})

describe('Warning → Policy, end to end', () => {
  it('creates a policy through the form, the mock API and the refreshed table', async () => {
    const { user, router } = renderApp('/warning/policy')

    // Seeded table (rows 1–5 of 7, as in the design).
    const table = await screen.findByRole('table', { name: 'Warning policies' })
    expect(await within(table).findAllByRole('row')).toHaveLength(6) // header + 5
    expect(screen.getByText('Showing 1–5 of 7')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title of Warning Policy'), 'Night shift grace')
    await user.type(screen.getByLabelText('Total Grace Minutes'), '120')
    fireEvent.change(timeInput('Clock In'), { target: { value: '21:00' } })
    fireEvent.change(timeInput('Clock Out'), { target: { value: '23:30' } })
    await user.type(screen.getByLabelText('Minutes'), '10')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Policy saved')).toBeInTheDocument()
    // The table jumps to the last page, where the new policy is listed.
    await waitFor(() => {
      expect(screen.getByText('Showing 6–8 of 8')).toBeInTheDocument()
    })
    expect(router.state.location.search).toMatchObject({ page: 2 })
    expect(within(table).getByText('Night shift grace')).toBeInTheDocument()
    // The form is cleared for the next policy.
    expect(screen.getByLabelText('Title of Warning Policy')).toHaveValue('')
  })

  it('shows validation errors without calling the API', async () => {
    const { user } = renderApp('/warning/policy')
    await screen.findByRole('table', { name: 'Warning policies' })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Enter at least 2 characters')).toBeInTheDocument()
    expect(screen.getByText('Total grace minutes is required')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–5 of 7')).toBeInTheDocument()
  })
})
