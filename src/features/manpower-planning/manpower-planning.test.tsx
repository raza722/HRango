import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format, startOfMonth } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  budgets,
  durations,
  openPositions,
  plans,
  positions,
  positionTitles,
} from '@/mocks/manpower-planning/db'
import { server } from '@/mocks/node'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function rowOf(text: string) {
  const cell = await screen.findByRole('cell', { name: text })
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${text}`)
  return row
}

async function openMenu(user: UserEvent, name: string, item: string) {
  await user.click(await screen.findByRole('button', { name }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

/** Opens a date box and picks a day of the current month. */
async function pickDay(user: UserEvent, label: string, day: number) {
  await user.click(screen.getByRole('button', { name: label }))
  const date = new Date(startOfMonth(new Date()).setDate(day))
  await user.click(
    await screen.findByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }),
  )
}

const sidebarLink = (name: string) => {
  const [link] = screen.getAllByRole('link', { name })
  if (!link) throw new Error(`No link ${name}`)
  return link
}

describe('Planning', () => {
  it('lists the plans and filters them', async () => {
    const { user } = renderApp('/manpower-planning/planning')

    expect(
      await screen.findByRole('heading', { name: 'Manpower Planning', level: 1 }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Employee Planning' })).toBeVisible()
    const apps = await rowOf('Apps Planning')
    expect(within(apps).getByText('50000')).toBeVisible()
    expect(within(apps).getByText('100000')).toBeVisible()
    expect(within(apps).getByText('2025')).toBeVisible()
    expect(within(apps).getByText('Approved')).toBeVisible()
    expect(within(apps).getByText('Current')).toBeInTheDocument()
    expect(within(apps).getByText('Hamza Ashraf')).toBeVisible()
    expect(screen.getByRole('cell', { name: 'Finance Planning' })).toBeVisible()

    await choose(user, 'Status', 'Pending')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Apps Planning' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('cell', { name: 'Finance Planning' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('cell', { name: 'Apps Planning' })).toBeVisible()

    // Planning Mode "Existing": plans that keep people already in post.
    await choose(user, 'Planning Mode', 'Existing')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Apps Planning' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('cell', { name: 'Finance Planning' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await choose(user, 'Plan year shown', '2024')
    expect(await screen.findByRole('cell', { name: 'Workforce Plan 2024' })).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Apps Planning' })).not.toBeInTheDocument()
    })

    // The page's filter button hides and shows the filter row.
    await user.click(screen.getByRole('button', { name: 'Hide filters' }))
    expect(screen.queryByRole('form', { name: 'Plan filters' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show filters' }))
    expect(screen.getByRole('form', { name: 'Plan filters' })).toBeVisible()
  })

  it('deletes a plan after the Delete Plan Year confirmation', async () => {
    const { user } = renderApp('/manpower-planning/planning')

    await openMenu(user, 'Actions for Finance Planning', 'Delete')
    const popup = await screen.findByRole('alertdialog', { name: 'Delete Plan Year' })
    expect(within(popup).getByText('Are you sure you want to Delete this plan?')).toBeVisible()
    await user.click(within(popup).getByRole('button', { name: 'Delete Plan Year' }))

    expect(await screen.findByText('Plan deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Finance Planning' })).not.toBeInTheDocument()
    })
    expect(plans.find('pl_finance')).toBeUndefined()
    // Its budget, still waiting, is withdrawn.
    expect(budgets.find('bg_fin_accountant')).toBeUndefined()
  })

  it('adds a plan with new and existing positions after checking it', async () => {
    const { user } = renderApp('/manpower-planning/planning')

    await user.click(await screen.findByRole('link', { name: 'Add New Plan' }))
    expect(await screen.findByRole('heading', { name: 'Add Planning', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Enter the title')).toBeVisible()
    expect(screen.getByText('Choose the plan year')).toBeVisible()
    expect(screen.getByText('Add at least one new or existing position')).toBeVisible()

    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Design Hiring')
    await choose(user, 'Plan Year', '2026')
    await user.click(screen.getByRole('button', { name: 'Add one new position' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Choose the position')).toBeVisible()
    expect(screen.getByText('Enter the max salary')).toBeVisible()

    // The employee position fills the line: place, group and salary range.
    await choose(user, 'Position, line 1', 'UI/UX Designer (12214)')
    expect(screen.getByRole('textbox', { name: 'Min salary, line 1' })).toHaveValue('30000')
    expect(screen.getByRole('textbox', { name: 'Max salary, line 1' })).toHaveValue('45000')
    expect(screen.getByRole('combobox', { name: 'Department, line 1' })).toHaveTextContent(
      'Mobile App',
    )
    expect(screen.getByRole('button', { name: 'Plan from, line 1' })).toHaveTextContent('Jan 2026')
    expect(screen.getByRole('button', { name: 'Plan to, line 1' })).toHaveTextContent('Dec 2026')
    const allowance = screen.getByRole('textbox', { name: 'Total allowance, line 1' })
    await user.clear(allowance)
    await user.type(allowance, '5000')
    expect(screen.getByLabelText('Total salary, line 1')).toHaveTextContent('50000')

    // Months outside the plan year are refused.
    await user.click(screen.getByRole('button', { name: 'Plan to, line 1' }))
    await user.click(await screen.findByRole('button', { name: 'Next year' }))
    await user.click(screen.getByRole('button', { name: 'Jan 2027' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Plan within 2026')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Plan to, line 1' }))
    await user.click(await screen.findByRole('button', { name: 'Previous year' }))
    await user.click(screen.getByRole('button', { name: 'Jun 2026' }))

    // An existing person, with the salary Payroll pays them.
    await user.click(screen.getByRole('button', { name: 'Add existing position' }))
    await choose(user, 'Employee, line 1', 'Maryam Javed')
    const salaryBox = screen.getByRole('textbox', { name: 'Monthly salary, line 1' })
    const salary = Number((salaryBox as HTMLInputElement).value)
    expect(salary).toBeGreaterThan(0)
    expect(screen.getByLabelText('Total Monthly Amount')).toHaveTextContent(String(50000 + salary))

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Plan submitted for approval')).toBeInTheDocument()
    const row = await rowOf('Design Hiring')
    expect(within(row).getByText('Pending')).toBeVisible()
    expect(within(row).getByText(String(50000 + salary))).toBeVisible()

    const plan = plans.all().find((item) => item.title === 'Design Hiring')
    expect(plan?.status).toBe('pending')
    // One budget for the position: the new designer (one vacancy) and Maryam, a UI/UX Designer.
    const asked = budgets.all().filter((item) => item.planId === plan?.id)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({
      title: 'UI/UX Designer',
      durationId: 'bd_2026',
      positions: 1,
      amount: 50000 * 6 + salary * 12,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'pending',
    })
  }, 60_000)

  it('imports the department’s positions and employees into a plan', async () => {
    const { user } = renderApp('/manpower-planning/planning/new')

    expect(await screen.findByRole('heading', { name: 'Add Planning', level: 1 })).toBeVisible()
    await choose(user, 'Plan Year', '2025')
    await user.click(screen.getByRole('button', { name: 'Import Existing Employees' }))
    expect(
      await screen.findByText('Choose the plan’s Department or Station to import its employees.'),
    ).toBeInTheDocument()

    await choose(user, 'Department', 'Finance')
    await user.click(screen.getByRole('button', { name: 'Import Positions' }))
    expect(await screen.findByText('2 positions imported')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Position, line 1' })).toHaveTextContent(
      /Accountant|Accounts/,
    )
    expect(screen.getByRole('combobox', { name: 'Position, line 2' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Import Existing Employees' }))
    expect(await screen.findByText('2 employees imported')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Employee, line 1' })).toHaveTextContent(
      /Hina Raza|Omer Farooq/,
    )
    // Nothing is planned twice.
    await user.click(screen.getByRole('button', { name: 'Import Positions' }))
    expect(
      await screen.findByText(
        'No employee positions match the plan’s Division, Station and Department.',
      ),
    ).toBeInTheDocument()
  })

  it('opens a plan’s details and approvals, keeps an approved plan read-only and edits a pending one', async () => {
    const { user } = renderApp('/manpower-planning/planning')

    await user.click(await screen.findByRole('button', { name: 'Approvals of Apps Planning' }))
    const approvals = await screen.findByRole('dialog', { name: 'Approvals: Apps Planning' })
    expect(await within(approvals).findByText('UI/UX Designer')).toBeVisible()
    expect(within(approvals).getByText('Active')).toBeVisible()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('link', { name: 'Details of Apps Planning' }))
    expect(await screen.findByRole('heading', { name: /Plan Details/, level: 1 })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Apps Planning')
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Back' }))

    await openMenu(user, 'Actions for Apps Planning', 'Edit')
    // The edit page waits for the plan and every lookup: slow when the whole suite runs at once.
    expect(
      await screen.findByText(
        'This plan has approved budgets, so it can no longer be edited.',
        {},
        { timeout: 15_000 },
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Back' }))

    await openMenu(user, 'Actions for Finance Planning', 'Edit')
    expect(await screen.findByRole('heading', { name: 'Edit Planning', level: 1 })).toBeVisible()
    const title = screen.getByRole('textbox', { name: 'Title' })
    expect(title).toHaveValue('Finance Planning')
    // Another 2025 plan has this title: the server's message lands under the field.
    await user.clear(title)
    await user.type(title, 'Apps Planning')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('A plan with this title already exists for 2025')).toBeVisible()
    await user.clear(title)
    await user.type(title, 'Finance Planning 2025')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Plan updated and sent for approval')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Finance Planning 2025' })).toBeVisible()
    // Fresh budgets replace the old one.
    expect(budgets.find('bg_fin_accountant')).toBeUndefined()
    expect(budgets.all().filter((item) => item.planId === 'pl_finance')).toHaveLength(1)
  }, 60_000)
})

describe('Budget Approvals', () => {
  it('approves a budget: its positions open and its plan is approved', async () => {
    const { user } = renderApp('/manpower-planning/budget-approvals')

    expect(await screen.findByRole('heading', { name: 'Budget Approvals', level: 1 })).toBeVisible()
    const row = await rowOf('Accountant')
    expect(within(row).getByText('Awaiting approval')).toBeVisible()
    expect(within(row).getByText('Pending')).toBeVisible()

    await openMenu(user, 'Actions for Accountant 2025', 'Approve')
    const popup = await screen.findByRole('alertdialog', { name: 'Approve Budget' })
    expect(within(popup).getByText(/2 open positions will be added/)).toBeVisible()
    await user.click(within(popup).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Budget approved')).toBeInTheDocument()

    await waitFor(() => {
      expect(budgets.find('bg_fin_accountant')?.status).toBe('active')
    })
    expect(plans.find('pl_finance')?.status).toBe('approved')
    const opened = openPositions.all().find((item) => item.budgetId === 'bg_fin_accountant')
    expect(opened).toMatchObject({ title: 'Accountant', totalPositions: 2, endDate: '2025-12-31' })

    // A decided budget cannot be decided again.
    await user.click(await screen.findByRole('button', { name: 'Actions for Accountant 2025' }))
    expect(await screen.findByRole('menuitem', { name: 'Approve' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.keyboard('{Escape}')

    // The positions are now open.
    await user.click(sidebarLink('Open Positions'))
    expect(await screen.findByRole('heading', { name: 'Open Positions', level: 1 })).toBeVisible()
    const open = await rowOf('Accountant')
    expect(within(open).getByText('02')).toBeVisible()
    expect(within(open).getByText('31 Dec 2025')).toBeVisible()
  })

  it('rejects a budget, and editing it on E-Budgeting sends it back', async () => {
    const { user } = renderApp('/manpower-planning/budget-approvals')

    await openMenu(user, 'Actions for Accountant 2025', 'Reject')
    const popup = await screen.findByRole('alertdialog', { name: 'Reject Budget' })
    await user.click(within(popup).getByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('Budget rejected')).toBeInTheDocument()
    await waitFor(() => {
      expect(budgets.find('bg_fin_accountant')?.status).toBe('rejected')
    })
    expect(plans.find('pl_finance')?.status).toBe('rejected')
    expect(openPositions.all().some((item) => item.budgetId === 'bg_fin_accountant')).toBe(false)

    await user.click(sidebarLink('E-Budgeting'))
    expect(await screen.findByRole('heading', { name: 'E-Budgeting' })).toBeVisible()
    const row = await rowOf('Accountant')
    expect(within(row).getByText('Rejected')).toBeVisible()
    await openMenu(user, 'Actions for Accountant 2025', 'Edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Budget' })
    const amount = within(dialog).getByRole('textbox', { name: 'Budget Amount' })
    await user.clear(amount)
    await user.click(within(dialog).getByRole('button', { name: 'Save Budget' }))
    expect(await within(dialog).findByText('Enter the budget amount')).toBeVisible()
    await user.type(amount, '3000000')
    await user.click(within(dialog).getByRole('button', { name: 'Save Budget' }))
    expect(await screen.findByText('Budget updated')).toBeInTheDocument()

    await waitFor(() => {
      expect(budgets.find('bg_fin_accountant')).toMatchObject({
        amount: 3000000,
        status: 'pending',
        decided: null,
      })
    })
    expect(plans.find('pl_finance')?.status).toBe('pending')
  })
})

describe('E-Budgeting', () => {
  it('lists the budgets, keeps approved ones and deletes a waiting one', async () => {
    const { user } = renderApp('/manpower-planning/e-budgeting')

    expect(await screen.findByRole('heading', { name: 'E-Budgeting' })).toBeVisible()
    const accounts = await rowOf('Accounts')
    for (const text of ['2024', '150000', '1 Jan 2024', '31 Dec 2024', 'Active']) {
      expect(within(accounts).getByText(text)).toBeVisible()
    }

    await openMenu(user, 'Actions for Accounts 2024', 'Edit')
    expect(
      await screen.findByText('This budget is approved, so it can no longer be changed.'),
    ).toBeInTheDocument()

    await openMenu(user, 'Actions for Accounts 2024', 'Delete')
    let popup = await screen.findByRole('alertdialog', { name: 'Delete Budget' })
    expect(within(popup).getByText('Are you sure you want to Delete this budget?')).toBeVisible()
    await user.click(within(popup).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('An approved budget cannot be deleted.')).toBeInTheDocument()
    expect(budgets.find('bg_wf_accounts')).toBeDefined()

    await openMenu(user, 'Actions for Accountant 2025', 'Delete')
    popup = await screen.findByRole('alertdialog', { name: 'Delete Budget' })
    await user.click(within(popup).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('Budget deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Accountant' })).not.toBeInTheDocument()
    })
    expect(budgets.find('bg_fin_accountant')).toBeUndefined()

    await user.type(screen.getByRole('searchbox', { name: 'Search budgets' }), 'Marketing')
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Accounts' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('cell', { name: 'Marketing' })).toBeVisible()
    const search = screen.getByRole('searchbox', { name: 'Search budgets' })
    await user.clear(search)
    await user.type(search, 'Nothing like this')
    expect(await screen.findByText('No budget matches your search.')).toBeVisible()
  })

  it('shows an error with a retry when the budgets cannot be loaded', async () => {
    server.use(
      http.get(apiPath('/manpower-planning/budgets'), () =>
        HttpResponse.json({ message: 'Down for maintenance' }, { status: 500 }),
      ),
    )
    renderApp('/manpower-planning/e-budgeting')

    expect(await screen.findByText('The budgets could not be loaded.')).toBeVisible()
    expect(screen.getByRole('button', { name: /Try again/ })).toBeVisible()
  })
})

describe('Open Positions', () => {
  const urls = URL as unknown as Record<string, unknown>
  afterEach(() => {
    delete urls.createObjectURL
    delete urls.revokeObjectURL
  })

  it('downloads a JD, edits a position and closes it', async () => {
    const files: Blob[] = []
    urls.createObjectURL = vi.fn((blob: Blob) => {
      files.push(blob)
      return 'blob:jd'
    })
    urls.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { user } = renderApp('/manpower-planning/open-positions')

    expect(await screen.findByRole('heading', { name: 'Open Positions', level: 1 })).toBeVisible()
    const accounts = await rowOf('Accounts')
    expect(within(accounts).getByText('05')).toBeVisible()
    expect(within(accounts).getByText('31 Dec 2024')).toBeVisible()

    await user.click(within(accounts).getByRole('button', { name: 'Download the JD of Accounts' }))
    await waitFor(() => {
      expect(click).toHaveBeenCalled()
    })
    const [file] = files
    if (!file) throw new Error('No JD file')
    const text = await file.text()
    expect(text).toContain('Job Description: Accounts')
    expect(text).toContain('Position Code 12213')

    await openMenu(user, 'Actions for Accounts', 'Edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Accounts' })
    const total = within(dialog).getByRole('textbox', { name: 'Total Positions' })
    await user.clear(total)
    await user.type(total, '0')
    await user.click(within(dialog).getByRole('button', { name: 'Save Position' }))
    expect(await within(dialog).findByText('Enter the total positions')).toBeVisible()
    await user.clear(total)
    await user.type(total, '6')
    await user.click(within(dialog).getByRole('button', { name: 'Save Position' }))
    expect(await screen.findByText('Open position updated')).toBeInTheDocument()
    expect(await within(await rowOf('Accounts')).findByText('06')).toBeVisible()

    await openMenu(user, 'Actions for Accounts', 'Close Position')
    expect(await screen.findByText('Position closed')).toBeInTheDocument()
    expect(await within(await rowOf('Accounts')).findByText('Closed')).toBeVisible()
    expect(openPositions.find('op_accounts')?.status).toBe('closed')
  })
})

describe('E-Budget Settings', () => {
  it('adds a budget duration with validation and makes it the current one', async () => {
    const { user } = renderApp('/manpower-planning/e-budget-settings')

    expect(await screen.findByRole('heading', { name: 'Employee Budget Settings' })).toBeVisible()
    expect(within(await rowOf('2025')).getByText('Current')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Budget Duration' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Budget Duration' })
    await user.click(within(dialog).getByRole('button', { name: 'Add Duration' }))
    expect(await within(dialog).findByText('Enter the budget duration')).toBeVisible()
    expect(within(dialog).getByText('Select the start date')).toBeVisible()
    expect(within(dialog).getByText('Select the end date')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: 'Enter Budget Duration' }), '2024')
    await pickDay(user, 'Select Start Date', 1)
    await pickDay(user, 'Select End Date', 28)
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'IsCurrentBudgetDurationPeriod' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add Duration' }))
    expect(
      await within(dialog).findByText('A budget duration with this name already exists'),
    ).toBeVisible()

    const name = within(dialog).getByRole('textbox', { name: 'Enter Budget Duration' })
    await user.clear(name)
    await user.type(name, '2027')
    await user.click(within(dialog).getByRole('button', { name: 'Add Duration' }))
    expect(await screen.findByText('Budget duration added')).toBeInTheDocument()
    await waitFor(() => {
      expect(durations.all().find((item) => item.name === '2027')?.isCurrent).toBe(true)
    })
    expect(durations.find('bd_2025')?.isCurrent).toBe(false)
    expect(within(await rowOf('2027')).getByText('Current')).toBeInTheDocument()

    // A plan year in use stays.
    await user.click(screen.getByRole('button', { name: 'Delete 2024' }))
    const popup = await screen.findByRole('alertdialog', { name: 'Delete Budget Duration' })
    await user.click(within(popup).getByRole('button', { name: 'Delete' }))
    expect(
      await screen.findByText(
        '2024 is the plan year of 1 plan and 3 budgets; it cannot be deleted.',
      ),
    ).toBeInTheDocument()
  })

  it('adds, deactivates and filters position titles', async () => {
    const { user } = renderApp('/manpower-planning/e-budget-settings?tab=position-title')

    expect(await screen.findByRole('cell', { name: 'Accounts' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Position Title' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await user.click(screen.getByRole('button', { name: 'Add New Position Title' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Position Title' })
    await user.click(within(dialog).getByRole('button', { name: 'Add Position' }))
    expect(await within(dialog).findByText('Enter the position title')).toBeVisible()
    const input = within(dialog).getByRole('textbox', { name: 'Position Title' })
    await user.type(input, 'accounts')
    await user.click(within(dialog).getByRole('button', { name: 'Add Position' }))
    expect(await within(dialog).findByText('This position title already exists')).toBeVisible()
    await user.clear(input)
    await user.type(input, 'Data Analyst')
    await user.click(within(dialog).getByRole('button', { name: 'Add Position' }))
    expect(await screen.findByText('Position title added')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Data Analyst' })).toBeVisible()

    await openMenu(user, 'Actions for Data Analyst', 'Deactivate')
    expect(await screen.findByText('Position title deactivated')).toBeInTheDocument()
    await choose(user, 'Status', 'Inactive')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Accounts' })).not.toBeInTheDocument()
    })
    expect(within(await rowOf('Data Analyst')).getByText('Inactive')).toBeVisible()
    expect(positionTitles.all().find((item) => item.title === 'Data Analyst')?.active).toBe(false)

    // A title an employee position uses cannot be deleted.
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await openMenu(user, 'Actions for Accountant', 'Delete')
    const popup = await screen.findByRole('alertdialog', { name: 'Delete Position Title' })
    await user.click(within(popup).getByRole('button', { name: 'Delete' }))
    expect(
      await screen.findByText(
        'Accountant is the title of 1 employee position; it cannot be deleted.',
      ),
    ).toBeInTheDocument()
  })

  it('saves an employee position with validation and uploads a sheet of them', async () => {
    const { user } = renderApp('/manpower-planning/e-budget-settings?tab=employee-position')

    expect(await screen.findByRole('heading', { name: 'Employee Position' })).toBeVisible()
    expect(await screen.findByText('12212')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Add Employee Position' }))
    const dialog = await screen.findByRole('dialog', { name: 'Employee Position' })
    await user.click(within(dialog).getByRole('button', { name: 'Save Position' }))
    for (const message of [
      'Choose the station',
      'Choose the employee group',
      'Enter the maximum salary',
      'Choose the position title',
    ]) {
      expect(await within(dialog).findByText(message)).toBeVisible()
    }

    await choose(user, 'Station', 'Karachi Sales Office')
    await choose(user, 'Employee Group', 'B')
    await choose(user, 'Position Title', 'Marketing')
    await choose(user, 'Department', 'Marketing')
    await choose(user, 'Sub Department', 'Brand')
    await user.type(within(dialog).getByRole('textbox', { name: 'Minimum Salary' }), '90000')
    await user.type(within(dialog).getByRole('textbox', { name: 'Maximum Salary' }), '60000')
    await user.click(within(dialog).getByRole('button', { name: 'Save Position' }))
    expect(
      await within(dialog).findByText('The minimum salary cannot be above the maximum'),
    ).toBeVisible()
    const min = within(dialog).getByRole('textbox', { name: 'Minimum Salary' })
    await user.clear(min)
    await user.type(min, '40000')
    await user.click(within(dialog).getByRole('button', { name: 'Save Position' }))
    expect(await screen.findByText('Employee position saved')).toBeInTheDocument()
    expect(await screen.findByText('12216')).toBeVisible()
    expect(positions.all().find((item) => item.code === '12216')).toMatchObject({
      stationId: 'br_khi',
      employeeGroupId: 'eg_b',
      subDepartmentId: 'sd_brand',
      minSalary: 40000,
      maxSalary: 60000,
    })

    const sheet = [
      'Position Code,Position Title,Division,Station,Department,Sub-Department,Employee Group,Cost Center,Grade,Reports To,Minimum Salary,Maximum Salary',
      '13001,Accounts,Corporate,Islamabad Office,Finance,Audit,C,CC-100 Head Office,Grade 2,Hina Raza,18000,22000',
      '13002,Accounts,Corporate,Mars Office,Finance,Audit,C,,,,18000,22000',
    ].join('\n')
    await user.upload(
      screen.getByLabelText('Upload employee positions (CSV saved from Excel)'),
      new File([sheet], 'positions.csv', { type: 'text/csv' }),
    )
    expect(await screen.findByText('1 imported, 1 with errors')).toBeInTheDocument()
    expect(await screen.findByText('Line 3: unknown station "Mars Office"')).toBeInTheDocument()
    expect(positions.all().find((item) => item.code === '13001')).toMatchObject({
      stationId: 'br_isb',
      reportsToId: 'em_hina',
      gradeId: 'gr_2',
    })

    // The filters narrow the list.
    await choose(user, 'Station', 'Islamabad Office')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.queryByText('12212')).not.toBeInTheDocument()
    })
    expect(screen.getByText('13001')).toBeVisible()
  })
})
