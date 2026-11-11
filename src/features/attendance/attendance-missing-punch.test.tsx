import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/test-utils'

const subMenu = () => screen.getByRole('navigation', { name: 'Attendance' })
const requestButtons = () => screen.getAllByRole('button', { name: /^Request punch, / })
/** "Request punch, Daniel Brooks, 10-Nov-2026" → "Daniel Brooks". */
const personOf = (button: HTMLElement) =>
  (button.getAttribute('aria-label') ?? '').split(', ')[1] ?? ''

describe('Attendance → Missing Punch', () => {
  it('opens from the sub menu and lists the days missing a punch', async () => {
    const { user, router } = renderApp('/attendance/logs')
    await screen.findByRole('navigation', { name: 'Attendance' })
    await user.click(within(subMenu()).getByRole('link', { name: 'Missing Punch' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/missing-punch')
    })
    expect(await screen.findByRole('heading', { name: 'Missing Punch', level: 1 })).toBeVisible()
    expect(within(subMenu()).getByRole('link', { name: 'Missing Punch' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.queryByText(/Coming next/)).not.toBeInTheDocument()

    // All: everyone's days in the last 30, each with what is missing.
    await user.click(screen.getByRole('tab', { name: 'All' }))
    await waitFor(() => {
      expect(requestButtons().length).toBeGreaterThan(0)
    })
    expect(router.state.location.search).toMatchObject({ scope: 'all' })
    expect(screen.getAllByText(/^Check (In|Out)$/).length).toBeGreaterThanOrEqual(
      requestButtons().length,
    )
    expect(screen.getByText(/^\d+ days?$/)).toBeVisible()
  }, 30_000)

  it('asks for the missing punch with the day and the person filled in', async () => {
    const { user } = renderApp('/attendance/missing-punch?scope=all')
    await waitFor(() => {
      expect(requestButtons().length).toBeGreaterThan(0)
    })
    const first = requestButtons()[0]
    if (!first) throw new Error('No missing punch to ask for')
    const person = personOf(first)

    await user.click(first)
    const dialog = await screen.findByRole('dialog', { name: 'Punch Request Create' })
    expect(within(dialog).getByRole('combobox', { name: /^Employee/ })).toHaveTextContent(person)
    expect(within(dialog).getByRole('combobox', { name: /^Punch Type/ })).toHaveTextContent(
      /^Check (In|Out)$/,
    )
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Punch Request Create' })).not.toBeInTheDocument()
    })
  }, 30_000)

  it('searches by name as you type', async () => {
    const { user, router } = renderApp('/attendance/missing-punch?scope=all')
    await waitFor(() => {
      expect(requestButtons().length).toBeGreaterThan(0)
    })
    const person = personOf(requestButtons()[0] ?? document.body)
    const firstName = person.split(' ')[0] ?? person

    await user.type(screen.getByRole('searchbox', { name: 'Search missing punches' }), firstName)
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: firstName })
    })
    await waitFor(() => {
      expect(requestButtons().every((button) => personOf(button).includes(firstName))).toBe(true)
    })
  }, 30_000)
})
