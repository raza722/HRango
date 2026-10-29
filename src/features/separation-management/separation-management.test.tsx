import { act, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { server } from '@/mocks/node'
import { apiPath, MOCK_TOKEN_PREFIX } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

/** Records the query string of each call to a list, then lets the mock answer it. */
function watch(path: string) {
  const calls: URLSearchParams[] = []
  server.use(
    http.get(apiPath(path), ({ request }) => {
      calls.push(new URL(request.url).searchParams)
    }),
  )
  return calls
}

const card = (name: string) => screen.getByRole('link', { name: new RegExp(`^${name}`) })

describe('Separation Management', () => {
  it('links to each exit screen, grouped, with how many wait', async () => {
    const exits = watch('/offboarding/end-of-employment')
    const clearances = watch('/assets/clearance-forms')
    // Two settlements wait to be calculated (pending) and three to be closed (open).
    const settlementStatuses: (string | null)[] = []
    server.use(
      http.get(apiPath('/payroll/final-settlements'), ({ request }) => {
        const status = new URL(request.url).searchParams.get('status')
        settlementStatuses.push(status)
        const total = status === 'pending' ? 2 : status === 'open' ? 3 : 0
        return HttpResponse.json({ data: [], meta: { page: 1, pageSize: 1, total, totalPages: 1 } })
      }),
    )
    renderApp('/separation-management')

    expect(await screen.findByRole('heading', { name: 'Separation Management' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Exit process' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Former employees' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeVisible()

    // Each link opens the list its count is of: every pending resignation, the pending exits.
    expect(card('Resignation Requests')).toHaveAttribute('href', '/requests/resignation?scope=all')
    expect(card('End of Employment')).toHaveAttribute('href', '/end-of-employment/pending')
    expect(card('Asset Clearance Form')).toHaveAttribute('href', '/assets/clearance-form')
    expect(card('Final Settlement')).toHaveAttribute('href', '/payroll/final-settlement')
    expect(card('Rehire')).toHaveAttribute('href', '/end-of-employment/completed')
    expect(card('Off Boarding Checklist')).toHaveAttribute(
      'href',
      '/settings/off-boarding/checklist',
    )

    // The count is the list's total for what still waits on someone: for settlements, both
    // the pending and the open ones.
    expect(await within(card('Final Settlement')).findByText('5 to settle')).toBeVisible()
    expect(settlementStatuses.toSorted()).toEqual(['open', 'pending'])
    expect(
      await within(card('End of Employment')).findByText(/^\d+ pending$/, {}, { timeout: 5000 }),
    ).toBeVisible()
    expect(await within(card('Resignation Requests')).findByText(/^\d+ pending$/)).toBeVisible()
    expect(await within(card('Asset Clearance Form')).findByText(/^\d+ in progress$/)).toBeVisible()
    expect(exits[0]?.get('status')).toBe('pending')
    expect(exits[0]?.get('pageSize')).toBe('1')
    expect(clearances[0]?.get('status')).toBe('in_progress')
    // Rehire and the checklist have no count.
    expect(within(card('Rehire')).queryByText(/\d/)).not.toBeInTheDocument()
  })

  it('shows only the screens the user may view, and asks for no other count', async () => {
    const exits = watch('/offboarding/end-of-employment')
    renderApp('/separation-management')
    act(() => {
      useAuthStore.getState().setSession({
        token: `${MOCK_TOKEN_PREFIX}test`,
        user: {
          ...DEMO_USER,
          permissions: [
            { code: 'assets.clearance.view', scope: 'company' },
            { code: 'offboarding.settings.checklist.view', scope: 'company' },
          ],
        },
      })
    })

    expect(await screen.findByRole('link', { name: /^Asset Clearance Form/ })).toBeVisible()
    expect(card('Off Boarding Checklist')).toBeVisible()
    expect(screen.queryByRole('link', { name: /^End of Employment/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Final Settlement/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Resignation Requests/ })).not.toBeInTheDocument()
    // A section with no screen left is dropped.
    expect(screen.queryByRole('heading', { name: 'Former employees' })).not.toBeInTheDocument()
    expect(exits).toHaveLength(0)
  })

  it('says so when the user may view none of its screens', async () => {
    renderApp('/separation-management')
    act(() => {
      useAuthStore.getState().setSession({
        token: `${MOCK_TOKEN_PREFIX}test`,
        user: {
          ...DEMO_USER,
          permissions: [{ code: 'leaves.settings.general.view', scope: 'company' }],
        },
      })
    })

    expect(
      await screen.findByText(/You don’t have access to any of the screens in Separation/),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: /^Rehire/ })).not.toBeInTheDocument()
  })
})
