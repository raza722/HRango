import { act, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format, parse, startOfMonth } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import {
  budgets,
  durations,
  openPositions,
  plans,
  positions,
  salaryRanges,
} from '@/mocks/manpower-planning/db'
import { orgLookupHandlers } from '@/mocks/manpower-planning/org-lookups'
import { server } from '@/mocks/node'
import { apiPath, MOCK_TOKEN_PREFIX } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

// Organisation's pickers and the employee picker are other modules' endpoints: these tests
// put the sample company's in front, whatever other mocks serve.
beforeEach(() => {
  server.use(...orgLookupHandlers)
})

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

/** The row whose ⋮ menu has this name ("Actions for Accounts 2024"). */
async function rowOfMenu(name: string) {
  const row = (await screen.findByRole('button', { name })).closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
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

/**
 * `POST /files` for these tests: the shared files mock cannot read jsdom's multipart bodies, so
 * the upload is answered here, named from the body.
 */
function acceptUploads() {
  server.use(
    http.post(apiPath('/files'), async ({ request }) => {
      const body = await request.text()
      const name = /filename="([^"]+)"/.exec(body)?.[1] ?? 'upload.pdf'
      const id = `file_${name.replace(/\W/g, '_')}`
      return HttpResponse.json(
        {
          data: {
            id,
            name,
            extension: 'pdf',
            mimeType: 'application/pdf',
            sizeBytes: 8,
            module: 'test',
            url: apiPath(`/files/${id}/download?token=mock`),
            createdAt: new Date().toISOString(),
          },
        },
        { status: 201 },
      )
    }),
  )
}

/** Opens a date box and picks the day, moving through the months from the one shown. */
async function pickDate(user: UserEvent, label: string, date: string) {
  await user.click(screen.getByRole('button', { name: label }))
  const target = parse(date, 'yyyy-MM-dd', new Date())
  const name = new RegExp(format(target, 'MMMM do, yyyy'))
  for (let step = 0; step < 40; step += 1) {
    const day = screen.queryAllByRole('button', { name })[0]
    if (day) {
      await user.click(day)
      return
    }
    const shown = parse(
      screen.getByRole('grid').getAttribute('aria-label') ?? '',
      'MMMM yyyy',
      new Date(),
    )
    await user.click(
      screen.getByRole('button', { name: target > shown ? /next month/i : /previous month/i }),
    )
  }
  throw new Error(`Could not reach ${date}`)
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
    // Its waiting budgets are withdrawn.
    expect(budgets.find('bg_fin_accountant')).toBeUndefined()

    // A plan with an approved budget cannot be deleted.
    await user.click(screen.getByRole('button', { name: 'Actions for Apps Planning' }))
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
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

    // The employee position fills the line: its place, group and salary range.
    await choose(user, 'Position, line 1', 'UI/UX Designer (12214)')
    expect(screen.getByRole('textbox', { name: 'Min salary, line 1' })).toHaveValue('30000')
    expect(screen.getByRole('textbox', { name: 'Max salary, line 1' })).toHaveValue('45000')
    expect(screen.getByLabelText('Department, line 1')).toHaveTextContent('Mobile App')
    expect(screen.getByLabelText('Station, line 1')).toHaveTextContent('Lahore Johar Town')
    expect(screen.getByRole('button', { name: 'Plan from, line 1' })).toHaveTextContent('Jan 2026')
    expect(screen.getByRole('button', { name: 'Plan to, line 1' })).toHaveTextContent('Dec 2026')
    const allowance = screen.getByRole('textbox', { name: 'Total allowance, line 1' })
    await user.clear(allowance)
    await user.type(allowance, '5000')
    expect(screen.getByLabelText('Total salary, line 1')).toHaveTextContent('50000')
    const headcount = screen.getByRole('textbox', { name: 'Head count, line 1' })
    await user.clear(headcount)
    await user.type(headcount, '2')
    expect(screen.getByLabelText('Total salary, line 1')).toHaveTextContent('100000')
    await user.clear(headcount)
    await user.type(headcount, '1')

    // Months outside the plan year are refused.
    await user.click(screen.getByRole('button', { name: 'Plan to, line 1' }))
    await user.click(await screen.findByRole('button', { name: 'Next year' }))
    await user.click(screen.getByRole('button', { name: 'Jan 2027' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Plan within 2026')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Plan to, line 1' }))
    await user.click(await screen.findByRole('button', { name: 'Previous year' }))
    await user.click(screen.getByRole('button', { name: 'Jun 2026' }))

    // An existing person: a blank salary is Payroll's current one.
    await user.click(screen.getByRole('button', { name: 'Add existing position' }))
    // The picker searches the lookup on the server; each option shows the code as its hint.
    await choose(user, 'Employee, line 1', /^Maryam Javed/)
    expect(screen.getByLabelText('Total Monthly Amount')).toHaveTextContent(
      '50000 + current salaries',
    )
    await user.type(screen.getByRole('textbox', { name: 'Monthly salary, line 1' }), '80000')
    expect(screen.getByLabelText('Total Monthly Amount')).toHaveTextContent('130000')

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Plan submitted for approval')).toBeInTheDocument()
    const row = await rowOf('Design Hiring')
    expect(within(row).getByText('Pending')).toBeVisible()
    expect(within(row).getByText('130000')).toBeVisible()

    const plan = plans.all().find((item) => item.title === 'Design Hiring')
    expect(plan?.status).toBe('pending')
    expect(plan?.lines[0]).toMatchObject({ startDate: '2026-01-01', endDate: '2026-06-30' })
    // One budget per title and department: the new designer and Maryam, a UI/UX Designer.
    const asked = budgets.all().filter((item) => item.manpowerPlanId === plan?.id)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({
      title: 'UI/UX Designer',
      budgetDurationId: 'bd_2026',
      totalPositions: 1,
      amount: 50000 * 6 + 80000 * 12,
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
    expect(screen.getByRole('link', { name: 'finance-plan.pdf' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Employee, line 1' })).toHaveTextContent(
      'Omer Farooq',
    )

    // A field error from the server lands on its line: lines[1] is the first existing one.
    server.use(
      http.put(
        apiPath('/manpower/plans/:id'),
        () =>
          HttpResponse.json(
            {
              message: 'Some fields need your attention.',
              code: 'VALIDATION_FAILED',
              fieldErrors: { 'lines[1].startDate': 'The start must fall in the plan year.' },
            },
            { status: 422 },
          ),
        { once: true },
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('The start must fall in the plan year.')).toBeVisible()

    await user.clear(title)
    await user.type(title, 'Finance Planning 2025')
    await user.click(screen.getByRole('button', { name: 'Remove finance-plan.pdf' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Plan updated and sent for approval')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Finance Planning 2025' })).toBeVisible()
    // Fresh budgets replace the old ones; the file list is replaced too.
    expect(budgets.find('bg_fin_accountant')).toBeUndefined()
    expect(budgets.all().filter((item) => item.manpowerPlanId === 'pl_finance')).toHaveLength(2)
    expect(plans.find('pl_finance')?.files).toEqual([])
  }, 60_000)

  it('hides what the user may not do', async () => {
    renderApp('/manpower-planning/planning')
    act(() => {
      useAuthStore.getState().setSession({
        token: `${MOCK_TOKEN_PREFIX}test`,
        user: { ...DEMO_USER, permissions: [{ code: 'manpower.planning.view', scope: 'company' }] },
      })
    })

    expect(await screen.findByRole('cell', { name: 'Apps Planning' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Add New Plan' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Actions for Apps Planning' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Details of Apps Planning' })).toBeVisible()
  })
})

describe('Budget Approvals', () => {
  it('approves the plan’s budgets: positions open and the plan is approved', async () => {
    const { user } = renderApp('/manpower-planning/budget-approvals')

    expect(await screen.findByRole('heading', { name: 'Budget Approvals', level: 1 })).toBeVisible()
    const row = await rowOf('Accountant')
    expect(within(row).getByText('Awaiting approval')).toBeVisible()
    expect(within(row).getByText('Pending')).toBeVisible()
    // Pending only, by default.
    expect(screen.queryByRole('cell', { name: 'Marketing' })).not.toBeInTheDocument()

    await openMenu(user, 'Actions for Accountant 2025', 'Approve')
    const popup = await screen.findByRole('alertdialog', { name: 'Approve Budget' })
    expect(within(popup).getByText(/2 open positions will be added/)).toBeVisible()
    await user.click(within(popup).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Budget approved')).toBeInTheDocument()

    await waitFor(() => {
      expect(budgets.find('bg_fin_accountant')?.status).toBe('approved')
    })
    // The plan waits for its other budget.
    expect(plans.find('pl_finance')?.status).toBe('pending')
    const opened = openPositions.all().find((item) => item.eBudgetId === 'bg_fin_accountant')
    expect(opened).toMatchObject({ title: 'Accountant', totalPositions: 2, endDate: '2025-12-31' })

    await openMenu(user, 'Actions for Accounts 2025', 'Approve')
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Approve Budget' })).getByRole(
        'button',
        { name: 'Approve' },
      ),
    )
    await waitFor(() => {
      expect(plans.find('pl_finance')?.status).toBe('approved')
    })

    // A decided budget cannot be decided again.
    await choose(user, 'Status shown', 'All')
    await user.click(await screen.findByRole('button', { name: 'Actions for Accountant 2025' }))
    expect(await screen.findByRole('menuitem', { name: 'Approve' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.keyboard('{Escape}')

    // The positions are now open.
    await user.click(sidebarLink('Open Positions'))
    expect(await screen.findByRole('heading', { name: 'Open Positions', level: 1 })).toBeVisible()
    const open = await rowOfMenu('Actions for Accountant')
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
    expect(openPositions.all().some((item) => item.eBudgetId === 'bg_fin_accountant')).toBe(false)

    await user.click(sidebarLink('E-Budgeting'))
    expect(await screen.findByRole('heading', { name: 'E-Budgeting' })).toBeVisible()
    const row = await rowOfMenu('Actions for Accountant 2025')
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
        decidedAt: null,
      })
    })
    expect(plans.find('pl_finance')?.status).toBe('pending')
  })
})

describe('E-Budgeting', () => {
  it('lists the budgets, keeps approved ones, deletes a waiting one and adds one', async () => {
    const { user } = renderApp('/manpower-planning/e-budgeting')

    expect(await screen.findByRole('heading', { name: 'E-Budgeting' })).toBeVisible()
    const accounts = await rowOfMenu('Actions for Accounts 2024')
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

    // A budget by hand.
    await user.click(screen.getByRole('button', { name: 'Add Budget' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Budget' })
    await user.click(within(dialog).getByRole('button', { name: 'Save Budget' }))
    expect(await within(dialog).findByText('Choose the budget duration')).toBeVisible()
    expect(within(dialog).getByText('Enter the title or choose the position title')).toBeVisible()
    await choose(user, 'Budget Duration', '2026')
    await choose(user, 'Position Title', 'Marketing')
    await user.type(within(dialog).getByRole('textbox', { name: 'Budget Amount' }), '240000')
    await pickDate(user, 'Start Date', '2026-02-01')
    await pickDate(user, 'End Date', '2026-11-30')
    await user.click(within(dialog).getByRole('button', { name: 'Save Budget' }))
    expect(await screen.findByText('Budget added')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        budgets.all().find((item) => item.amount === 240000 && item.manpowerPlanId === null),
      ).toMatchObject({ title: 'Marketing', jobTitleId: 'jt_marketing', status: 'pending' })
    })

    await user.type(screen.getByRole('searchbox', { name: 'Search budgets' }), 'UI/UX')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Actions for Accounts 2024' })).toBeNull()
    })
    expect(screen.getAllByRole('cell', { name: 'UI/UX Designer' }).length).toBeGreaterThan(0)
    const search = screen.getByRole('searchbox', { name: 'Search budgets' })
    await user.clear(search)
    await user.type(search, 'Nothing like this')
    expect(await screen.findByText('No budget matches your search.')).toBeVisible()
  }, 60_000)

  it('shows an error with a retry when the budgets cannot be loaded', async () => {
    server.use(
      http.get(apiPath('/manpower/budgets'), () =>
        HttpResponse.json({ message: 'Down for maintenance' }, { status: 500 }),
      ),
    )
    renderApp('/manpower-planning/e-budgeting')

    expect(await screen.findByText('The budgets could not be loaded.')).toBeVisible()
    expect(screen.getByRole('button', { name: /Try again/ })).toBeVisible()
  })
})

describe('Open Positions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downloads a JD, edits a position with a new JD and closes it', async () => {
    acceptUploads()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { user } = renderApp('/manpower-planning/open-positions')

    expect(await screen.findByRole('heading', { name: 'Open Positions', level: 1 })).toBeVisible()
    const accounts = await rowOfMenu('Actions for Accounts')
    expect(within(accounts).getByText('05')).toBeVisible()
    expect(within(accounts).getByText('31 Dec 2024')).toBeVisible()
    expect(within(await rowOfMenu('Actions for Marketing')).getByText('No JD yet')).toBeVisible()

    await user.click(within(accounts).getByRole('button', { name: 'Download the JD of Accounts' }))
    await waitFor(() => {
      expect(click).toHaveBeenCalled()
    })
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.href).toContain('/files/file_jd_op_accounts/download')

    await openMenu(user, 'Actions for Accounts', 'Edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Accounts' })
    expect(within(dialog).getByText('Accounts JD.pdf')).toBeVisible()
    const total = within(dialog).getByRole('textbox', { name: 'Total Positions' })
    await user.clear(total)
    await user.type(total, '0')
    await user.click(within(dialog).getByRole('button', { name: 'Save Position' }))
    expect(await within(dialog).findByText('Enter the total positions')).toBeVisible()
    await user.clear(total)
    await user.type(total, '6')
    await user.upload(
      within(dialog).getByLabelText('Upload the job description'),
      new File(['%PDF-1.4'], 'accounts-jd-2025.pdf', { type: 'application/pdf' }),
    )
    expect(await within(dialog).findByText('accounts-jd-2025.pdf')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save Position' }))
    expect(await screen.findByText('Open position updated')).toBeInTheDocument()
    expect(await within(await rowOfMenu('Actions for Accounts')).findByText('06')).toBeVisible()
    expect(openPositions.find('op_accounts')?.jdFile?.id).not.toBe('file_jd_op_accounts')

    await openMenu(user, 'Actions for Accounts', 'Close Position')
    expect(await screen.findByText('Position closed')).toBeInTheDocument()
    expect(await within(await rowOfMenu('Actions for Accounts')).findByText('Closed')).toBeVisible()
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
      await within(dialog).findByText('A budget duration with this name already exists.'),
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
        'This duration is the plan year of plans or budgets; it cannot be deleted.',
      ),
    ).toBeInTheDocument()
    expect(durations.find('bd_2024')).toBeDefined()
  })

  it('lists the position titles from Organisation with their use', async () => {
    const { user } = renderApp('/manpower-planning/e-budget-settings?tab=position-title')

    const accounts = await rowOf('Accounts')
    expect(within(accounts).getByText('1 of 1 active')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Position Title' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Manage Job Titles' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add New Position Title' })).toBeNull()

    await user.type(screen.getByRole('searchbox', { name: 'Search position titles' }), 'design')
    await waitFor(() => {
      expect(screen.queryByRole('cell', { name: 'Accounts' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('cell', { name: 'UI/UX Designer' })).toBeVisible()
  })

  it('saves an employee position with validation and uploads a sheet of them', async () => {
    const { user } = renderApp('/manpower-planning/e-budget-settings?tab=employee-position')

    expect(await screen.findByRole('heading', { name: 'Employee Position' })).toBeVisible()
    expect(await screen.findByText(/^12212/)).toBeVisible()

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
    await choose(user, 'Reports To', 'Accountant (12212)')
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
    const saved = positions
      .all()
      .find(
        (item) =>
          item.jobTitleId === 'jt_marketing' &&
          item.branchId === 'br_khi' &&
          item.subDepartmentId === 'sd_brand',
      )
    expect(saved).toMatchObject({ employeeGroupId: 'eg_b', reportsToId: 'ep_accountant' })
    expect(salaryRanges.all().find((range) => range.positionId === saved?.id)).toMatchObject({
      minSalary: 40000,
      maxSalary: 60000,
    })

    const sheet = [
      'Position Code,Position Title,Division,Station,Department,Sub-Department,Employee Group,Cost Center,Grade,Reports To,Minimum Salary,Maximum Salary',
      '13001,Accounts,Corporate,Islamabad Office,Finance,Audit,C,Head Office,Grade 2,12212,"18,000",22000',
      '13002,Accounts,Corporate,Mars Office,Finance,Audit,C,,,,18000,22000',
    ].join('\n')
    await user.upload(
      screen.getByLabelText('Upload employee positions (CSV saved from Excel)'),
      new File([sheet], 'positions.csv', { type: 'text/csv' }),
    )
    expect(await screen.findByText('1 imported, 1 with errors')).toBeInTheDocument()
    expect(await screen.findByText('Line 3: Station "Mars Office" not found.')).toBeInTheDocument()
    expect(positions.all().find((item) => item.code === '13001')).toMatchObject({
      branchId: 'br_isb',
      reportsToId: 'ep_accountant',
      gradeId: 'gr_2',
      costCenterId: 'cc_100',
    })

    // The filters narrow the list.
    await choose(user, 'Station', 'Islamabad Office')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(screen.queryByText(/^12212/)).not.toBeInTheDocument()
    })
    expect(screen.getByText(/^13001/)).toBeVisible()
  }, 60_000)

  it('deactivates a position and adds a salary range', async () => {
    const { user } = renderApp('/manpower-planning/e-budget-settings?tab=employee-position')

    await openMenu(user, 'Actions for Accountant 12212', 'Deactivate')
    expect(await screen.findByText('Employee position deactivated')).toBeInTheDocument()
    await waitFor(() => {
      expect(positions.find('ep_accountant')?.status).toBe('inactive')
    })

    await openMenu(user, 'Actions for Accountant 12212', 'Salary Ranges')
    const dialog = await screen.findByRole('dialog', { name: 'Salary Ranges: Accountant (12212)' })
    expect(await within(dialog).findByText('100000')).toBeVisible()
    await pickDay(user, 'From', 1)
    await user.type(within(dialog).getByRole('textbox', { name: 'Minimum Salary' }), '55000')
    await user.type(within(dialog).getByRole('textbox', { name: 'Maximum Salary' }), '110000')
    await user.click(within(dialog).getByRole('button', { name: 'Add Range' }))
    expect(await screen.findByText('Salary range saved')).toBeInTheDocument()
    expect(await within(dialog).findByText('110000')).toBeVisible()
  })
})
