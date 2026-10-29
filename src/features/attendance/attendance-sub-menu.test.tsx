import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/test-utils'

const subMenu = () => screen.getByRole('navigation', { name: 'Attendance' })

describe('Attendance sub menu', () => {
  it('opens Attendance Insights, Scheduling and Official Visits beside the sub menu', async () => {
    const { user, router } = renderApp('/attendance/settings')

    expect(await screen.findByRole('navigation', { name: 'Attendance' })).toBeVisible()

    // Attendance Insights: the overview grid, still under /attendance.
    await user.click(within(subMenu()).getByRole('link', { name: 'Attendance Insights' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/insights')
    })
    expect(await screen.findByRole('heading', { name: 'Attendance Insights' })).toBeVisible()
    expect(within(subMenu()).getByRole('link', { name: 'Attendance Insights' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(await screen.findByRole('table', { name: /Attendance by day/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Download' })).toBeVisible()

    // Scheduling: the scheduling board.
    await user.click(within(subMenu()).getByRole('link', { name: 'Scheduling' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/scheduling')
    })
    expect(await screen.findByRole('heading', { name: 'Scheduling' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Show' })).toBeVisible()
    expect(screen.getByRole('status', { name: 'Your active status' })).toBeVisible()
    expect(within(subMenu()).getByRole('link', { name: 'Scheduling' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Official Visits: the request type's Requests / Approvals pages.
    await user.click(within(subMenu()).getByRole('link', { name: 'Official Visits' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/official-visits')
    })
    expect(
      await screen.findByRole('heading', { name: 'Official Visit Requests' }, { timeout: 8_000 }),
    ).toBeVisible()
    expect(within(subMenu()).getByRole('link', { name: 'Official Visits' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(await screen.findByRole('cell', { name: 'OV-0003' }, { timeout: 8_000 })).toBeVisible()

    // Its tabs keep it inside Attendance.
    await user.click(screen.getByRole('tab', { name: 'Approvals' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/official-visits')
    })
    expect(router.state.location.search).toMatchObject({ tab: 'approvals' })
  }, 30_000)

  it('reaches the sub menu pages from Attendance Overview and the Time Sheet', async () => {
    const { user, router } = renderApp('/attendance/overview')

    await user.click(
      await screen.findByRole('button', { name: 'More attendance pages' }, { timeout: 15_000 }),
    )
    for (const name of ['Scheduling', 'Official Visits', 'Attendance Insights']) {
      expect(await screen.findByRole('menuitem', { name })).toBeVisible()
    }
    await user.click(screen.getByRole('menuitem', { name: 'Overtime' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/overtime')
    })

    await router.navigate({ to: '/attendance/time-sheet' })
    await user.click(
      await screen.findByRole('button', { name: 'More attendance pages' }, { timeout: 15_000 }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Scheduling' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/scheduling')
    })
  }, 60_000)
})
