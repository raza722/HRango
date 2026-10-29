import { configure, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { payrolls } from '@/mocks/payroll/db'
import { renderApp, setViewportWidth } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

/** The first whole-app render can be slow when every test file runs at once. */
const FIRST_LOAD = { timeout: 15_000 }

const menu = () => screen.getByRole('navigation', { name: 'Payroll' })
const entry = (name: string | RegExp) => within(menu()).getByRole('link', { name })
const tabs = () => screen.getByRole('navigation', { name: 'Payroll Settings' })

/** Opens the settings page and waits for the Payroll menu. */
async function openSettings() {
  const view = renderApp('/payroll/settings/general')
  expect(await screen.findByRole('navigation', { name: 'Payroll' }, FIRST_LOAD)).toBeVisible()
  return view
}

/** `name` is the open entry, and only it. */
function expectCurrent(name: string | RegExp) {
  const current = entry(name)
  expect(current).toHaveAttribute('aria-current', 'page')
  const others = within(menu())
    .getAllByRole('link')
    .filter((link) => link !== current)
  expect(others).toHaveLength(6)
  for (const link of others) expect(link).not.toHaveAttribute('aria-current')
}

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name)
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

describe('Payroll Settings menu', { timeout: 60_000 }, () => {
  it('opens Pay Runs beside the menu, with the Monthly list and its actions', async () => {
    const { user, router } = await openSettings()

    await user.click(entry('Pay Runs'))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/pay-runs')
    })
    expect(await screen.findByRole('heading', { name: 'Pay Runs', level: 1 })).toBeVisible()
    await waitFor(() => {
      expectCurrent('Pay Runs')
    })
    const running = await rowOf('Head Office (Pakistan-PKR)')
    expect(within(running).getByText('Run')).toBeVisible()
    expect(within(await rowOf('Software (Pakistan-PKR)')).getByText('Closed')).toBeVisible()
    expect(within(await rowOf('Abdul (Pakistan-PKR)')).getByText('On Hold')).toBeVisible()

    // Its actions work beside the menu too.
    await user.click(
      within(running).getByRole('button', { name: 'On Hold, Head Office (Pakistan-PKR)' }),
    )
    expect(await screen.findByText('Payroll on hold')).toBeInTheDocument()
    await waitFor(() => {
      expect(payrolls.find('pr_6')?.status).toBe('on_hold')
    })
    expectCurrent('Pay Runs')
    await user.click(screen.getByRole('button', { name: '+ Create' }))
    expect(await screen.findByRole('dialog', { name: 'Payrolls Monthly' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/payroll/settings/pay-runs')
  })

  it('opens Payroll History with only the closed payrolls', async () => {
    const { user, router } = await openSettings()

    await user.click(entry('Payroll History'))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/history')
    })
    expect(await screen.findByRole('heading', { name: 'Payroll History', level: 1 })).toBeVisible()
    await waitFor(() => {
      expectCurrent('Payroll History')
    })
    const closed = await rowOf('Software (Pakistan-PKR)')
    const table = screen.getByRole('table', { name: 'Closed monthly payrolls' })
    const expected = payrolls
      .all()
      .filter((payroll) => payroll.kind === 'monthly' && payroll.status === 'closed')
    // The header row, then one row per closed payroll.
    expect(within(table).getAllByRole('row')).toHaveLength(expected.length + 1)
    expect(within(table).queryByText('Head Office (Pakistan-PKR)')).not.toBeInTheDocument()
    expect(within(table).queryByText('Abdul (Pakistan-PKR)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Create' })).not.toBeInTheDocument()

    // Salary Sheet still opens the payroll's sheet.
    await user.click(
      within(closed).getByRole('button', { name: 'Salary Sheet, Software (Pakistan-PKR)' }),
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/salary-sheet')
    })
    expect(router.state.location.search).toMatchObject({ payrollId: 'pr_7' })
  })

  it('opens Appraisal with Performance → Appraisals beside the menu', async () => {
    const { user, router } = await openSettings()

    await user.click(entry('Appraisal'))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/appraisal')
    })
    expect(await screen.findByRole('heading', { name: 'Appraisals' })).toBeVisible()
    await waitFor(() => {
      expectCurrent('Appraisal')
    })
  })

  it('opens Loans with Loan & Advances, its tabs staying beside the menu', async () => {
    const { user, router } = await openSettings()

    await user.click(entry('Loans'))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/loans')
    })
    expect(await screen.findByRole('heading', { name: 'Loan & Advances' })).toBeVisible()
    expect(await screen.findByRole('cell', { name: 'RQ-LA-0006' })).toBeVisible()
    await waitFor(() => {
      expectCurrent('Loans')
    })

    await user.click(screen.getByRole('tab', { name: 'Approvals' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'approvals' })
    })
    expect(router.state.location.pathname).toBe('/payroll/settings/loans')

    // Settings keeps its sub page in the URL here as well.
    await user.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(await screen.findByRole('table', { name: 'Loan & Advances Types' })).toBeVisible()
    await user.click(await screen.findByRole('tab', { name: 'Categories' }))
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'settings', section: 'categories' })
    })
    expect(router.state.location.pathname).toBe('/payroll/settings/loans')
    expectCurrent('Loans')
  })

  it('highlights Compensation \\ Deductions and Benefits on their tabs', async () => {
    const { user, router } = await openSettings()
    expectCurrent('Payroll Settings')

    await user.click(entry(/^Compensation/))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/pay-components')
    })
    await waitFor(() => {
      expectCurrent(/^Compensation/)
    })
    expect(within(tabs()).getByRole('link', { name: 'Pay Components' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(entry('Benefits'))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/rewards')
    })
    await waitFor(() => {
      expectCurrent('Benefits')
    })
    expect(within(tabs()).getByRole('link', { name: 'Rewards' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // The other tabs belong to Payroll Settings.
    await user.click(within(tabs()).getByRole('link', { name: 'Tax' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/tax')
    })
    await waitFor(() => {
      expectCurrent('Payroll Settings')
    })
    await user.click(within(tabs()).getByRole('link', { name: 'Pay Components' }))
    await waitFor(() => {
      expectCurrent(/^Compensation/)
    })
  })

  it('folds into a dropdown on narrow screens', async () => {
    setViewportWidth(375)
    const { user, router } = renderApp('/payroll/settings/general')

    await user.click(
      await screen.findByRole('button', { name: 'Payroll section: Payroll Settings' }, FIRST_LOAD),
    )
    expect(await screen.findAllByRole('menuitem')).toHaveLength(7)
    expect(screen.getByRole('menuitem', { name: 'Payroll Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('menuitem', { name: 'Compensation \\ Deductions' })).toHaveAttribute(
      'href',
      '/payroll/settings/pay-components',
    )
    await user.click(screen.getByRole('menuitem', { name: 'Loans' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/loans')
    })
    expect(await screen.findByRole('heading', { name: 'Loan & Advances' })).toBeVisible()

    await user.click(await screen.findByRole('button', { name: 'Payroll section: Loans' }))
    expect(await screen.findByRole('menuitem', { name: 'Loans' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await user.click(screen.getByRole('menuitem', { name: 'Payroll History' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/payroll/settings/history')
    })
    expect(
      await screen.findByRole('button', { name: 'Payroll section: Payroll History' }),
    ).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Payroll History', level: 1 })).toBeVisible()
  })
})
