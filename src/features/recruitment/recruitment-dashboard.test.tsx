import { configure, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import { apiPath } from '@/mocks/utils'
import { renderApp, setViewportWidth } from '@/test/test-utils'

import { choose } from './test-helpers'

configure({ asyncUtilTimeout: 4000 })

/** A tile's text (label, number and note). */
const tile = (label: string) =>
  within(screen.getByRole('list', { name: 'Recruitment in numbers' }))
    .getByText(label)
    .closest('li')

describe('Recruitment → Dashboard', { timeout: 60_000 }, () => {
  it('opens on the dashboard with the tiles, statistics, pipeline and lists', async () => {
    const { router } = renderApp('/recruitment')
    expect(
      await screen.findByRole('heading', { name: 'Recruitment Dashboard' }, { timeout: 15_000 }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/recruitment/dashboard')
    await waitFor(() => {
      // Openings 1, 2 and 6 are open, with 2 + 1 + 1 vacancies left.
      expect(tile('Total Openings')).toHaveTextContent('3 open now · 4 vacancies')
    })
    // Figures the year filter does not narrow say what they are of.
    expect(tile('Interviews')).toHaveTextContent('3 upcoming from today')
    expect(screen.getByRole('heading', { name: 'Upcoming Interviews (from today)' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Recent Activity (latest)' })).toBeVisible()

    expect(screen.getByRole('group', { name: /Job statistics/ })).toBeVisible()
    const pipeline = screen.getByRole('list', { name: 'Applications by stage' })
    for (const stage of ['Applied', 'Screening', 'Interview', 'Hired', 'Rejected']) {
      expect(within(pipeline).getByText(stage)).toBeVisible()
    }
    const upcoming = screen.getByRole('list', { name: 'Upcoming interviews' })
    expect(within(upcoming).getByText('Mehwish Iqbal').closest('a')).toHaveAttribute(
      'href',
      '/recruitment/interviews?view=%22803%22',
    )
    expect(within(upcoming).getByRole('link', { name: 'Email Mehwish Iqbal' })).toHaveAttribute(
      'href',
      'mailto:mehwish.iqbal@example.pk',
    )
    expect(screen.getByRole('list', { name: 'Recent activity' })).toBeVisible()
  })

  it('shows the statistics as a table, and the year and month go in the URL', async () => {
    const { user, router } = renderApp('/recruitment/dashboard')
    await user.click(
      await screen.findByRole(
        'button',
        { name: /Show Job statistics \d{4} as a table/ },
        { timeout: 15_000 },
      ),
    )
    const table = screen.getByRole('table', { name: /Job statistics/ })
    for (const header of ['Month', 'Applications', 'Shortlisted', 'Hired', 'Rejected']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(within(table).getAllByRole('row')).toHaveLength(13)

    await choose(user, 'Month', 'March')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ month: 3 })
    })
    expect(
      await screen.findByText('Applied in March ' + String(new Date().getFullYear())),
    ).toBeVisible()
    const last = String(new Date().getFullYear() - 1)
    await choose(user, 'Year', last)
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ month: 3, year: Number(last) })
    })
  })

  it('shows the API error with Try again', async () => {
    server.use(
      http.get(apiPath('/recruitment/dashboard'), () =>
        HttpResponse.json({ message: 'The dashboard is warming up.' }, { status: 503 }),
      ),
    )
    renderApp('/recruitment/dashboard')
    const alert = await screen.findByRole('alert', {}, { timeout: 15_000 })
    expect(within(alert).getByText('The dashboard is warming up.')).toBeVisible()
    expect(within(alert).getByRole('button', { name: /Try again/ })).toBeVisible()
  })

  it('lays the tiles out in one column at phone width', async () => {
    setViewportWidth(375)
    renderApp('/recruitment/dashboard')
    const tiles = await screen.findByRole(
      'list',
      { name: 'Recruitment in numbers' },
      { timeout: 15_000 },
    )
    expect(within(tiles).getAllByRole('listitem')).toHaveLength(6)
    expect(tiles).toHaveClass('grid-cols-1')
  })
})
