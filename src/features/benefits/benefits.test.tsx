import { act, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, format, parse } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { DEMO_USER } from '@/mocks/auth/handlers'
import { enrollmentWindows, planFiles, plans, planYears, updateRequests } from '@/mocks/benefits/db'
import { orgLookupHandlers, PEOPLE } from '@/mocks/manpower-planning/org-lookups'
import { server } from '@/mocks/node'
import { apiPath, MOCK_TOKEN_PREFIX } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

// The people picker is the Employees module's endpoint: these tests put the sample company's in
// front, whatever other mocks serve.
beforeEach(() => {
  server.use(...orgLookupHandlers)
})

const iso = (date: Date) => format(date, 'yyyy-MM-dd')

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

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date box and picks the day, moving through the months from the one shown. */
async function pickDate(user: UserEvent, label: string | RegExp, date: string) {
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

/** The count in the stats row's card for `label`. */
function stat(label: string): string {
  const card = within(screen.getByRole('list', { name: 'Benefits in numbers' }))
    .getByText(label)
    .closest('li')
  if (!card) throw new Error(`No stat card for ${label}`)
  return card.textContent.replace(label, '')
}

/** The table row whose cell reads `text` exactly. */
async function findRow(text: string) {
  const row = (await screen.findByText(text)).closest('tr')
  if (!row) throw new Error(`No row for ${text}`)
  return within(row)
}

async function openRowMenu(user: UserEvent, name: string, item: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

const year = new Date().getFullYear()

// Whole-app flows through several steps: allow for a busy parallel run.
describe('Benefits: Plan Years', { timeout: 60_000 }, () => {
  it('lists the plan years under the stats row, sub menu and Showing filter', async () => {
    const { user, router } = renderApp('/benefits')

    expect(
      await screen.findByRole('heading', { name: 'Benefits Management', level: 1 }),
    ).toBeVisible()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/benefits/plan-years')
    })
    expect(screen.getByRole('heading', { name: 'Benefit Plan Years' })).toBeVisible()
    await waitFor(() => {
      expect(stat('Plan Years')).toBe('2')
    })
    expect(stat('Plans')).toBe('7')
    expect(stat('Enrollment Windows')).toBe('2')
    expect(stat('Employees')).toBe(String(PEOPLE.length))

    const tabs = within(screen.getByRole('navigation', { name: 'Benefits' }))
    expect(tabs.getByRole('link', { name: 'Plan Years' })).toHaveAttribute('aria-current', 'page')
    expect(tabs.getByRole('link', { name: `Employees (${String(PEOPLE.length)})` })).toBeVisible()

    const fiscal = await findRow('Fiscal year')
    expect(fiscal.getByText('5')).toBeVisible()
    expect(fiscal.getByText('Active')).toBeVisible()
    expect(fiscal.getByText(`1 Jan ${String(year)} - 31 Dec ${String(year)}`)).toBeVisible()
    expect(fiscal.getByText('1 pending, 2 approved, 1 incomplete')).toBeVisible()
    expect(fiscal.getByText('2 employees are missing required information')).toBeVisible()
    expect(fiscal.getByRole('link', { name: 'Update missing information' })).toBeVisible()

    // Showing: one plan year.
    await choose(user, 'Showing:', `Fiscal year ${String(year - 1)}`)
    expect(await screen.findByText('Ended')).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByText('Active')).not.toBeInTheDocument()
    })
    expect(router.state.location.search).toEqual({ year: 'by_previous' })

    // The filter button opens the same list.
    await user.click(screen.getByRole('button', { name: 'Choose the plan year shown' }))
    await user.click(await screen.findByRole('option', { name: 'All Plan Years' }))
    expect(await screen.findByText('Active')).toBeVisible()
  })

  it('creates a plan year through Details, Plans and New Hires', async () => {
    const { user, router } = renderApp('/benefits/plan-years')

    await user.click(await screen.findByRole('link', { name: 'New Plan Year' }))
    expect(await screen.findByRole('heading', { name: 'Plan Year Details' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue: Plans' }))
    expect(await screen.findByText('Enter the plan year name')).toBeVisible()
    expect(screen.getByText('Choose the start date')).toBeVisible()

    // A name the server refuses comes back on the Details step at the end.
    await user.type(screen.getByRole('textbox', { name: 'Plan Year Name' }), 'Fiscal year')
    const start = addDays(new Date(), 1)
    await pickDate(user, 'Plan Year Start', iso(start))
    await pickDate(user, 'Plan Year End', iso(addDays(start, 20)))
    await user.click(screen.getByRole('button', { name: 'Continue: Plans' }))

    expect(await screen.findByRole('heading', { name: 'Plans' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue: New Hires' }))
    expect(await screen.findByText('Choose at least one plan')).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Select All' }))
    expect(screen.getByText('(7 plans selected)', { exact: false })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue: New Hires' }))

    expect(await screen.findByRole('heading', { name: 'New Hires' })).toBeVisible()
    const period = screen.getByRole('textbox', {
      name: 'How long do new employees have to complete elections?',
    })
    await user.clear(period)
    await user.type(period, '2')
    await choose(
      user,
      'When can new hires start their benefits enrollment?',
      'After a waiting period',
    )
    await user.click(screen.getByRole('button', { name: 'Create Plan Year' }))
    expect(await screen.findByText('Enter the waiting period: 1 to 365 days')).toBeVisible()
    await user.type(
      screen.getByRole('textbox', { name: 'How many days is the waiting period?' }),
      '30',
    )
    await user.click(screen.getByRole('button', { name: 'Create Plan Year' }))

    // Back on Details with the server's message.
    expect(await screen.findByText('A plan year with this name already exists.')).toBeVisible()
    const name = screen.getByRole('textbox', { name: 'Plan Year Name' })
    await user.clear(name)
    await user.type(name, 'Benefits 2027')
    await user.click(screen.getByRole('button', { name: 'Continue: Plans' }))
    await user.click(await screen.findByRole('button', { name: 'Continue: New Hires' }))
    await user.click(await screen.findByRole('button', { name: 'Create Plan Year' }))

    expect(await screen.findByText('Plan year created')).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/benefits/plan-years')
    })
    const created = planYears.all().find((item) => item.name === 'Benefits 2027')
    expect(created).toMatchObject({
      newHireStart: 'waiting_period',
      waitingPeriodDays: 30,
      electionPeriod: 2,
      electionUnit: 'month',
    })
    expect(created?.planIds).toHaveLength(7)
    const row = await findRow('Benefits 2027')
    expect(row.getByText('7')).toBeVisible()
    expect(row.getByText('Upcoming')).toBeVisible()
  })

  it('edits a plan year in the popup through its three steps', async () => {
    const { user } = renderApp('/benefits/plan-years')

    await openRowMenu(user, 'Fiscal year', 'Edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Plan Year' })
    const name = within(dialog).getByRole('textbox', { name: 'Plan Year Name' })
    expect(name).toHaveValue('Fiscal year')
    await user.clear(name)
    await user.type(name, 'Fiscal year 2026-27')
    await user.click(within(dialog).getByRole('button', { name: 'Continue: Plans' }))

    expect(await screen.findByRole('dialog', { name: 'Plans' })).toBeVisible()
    expect(screen.getByText('(5 plans selected)', { exact: false })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Life Coverage/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Supplemental Life' }))
    expect(screen.getByText('(6 plans selected)', { exact: false })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue: New Hires' }))

    const hires = await screen.findByRole('dialog', { name: 'New Hires' })
    await user.click(
      within(hires).getByRole('combobox', {
        name: 'When can new hires start their benefits enrollment?',
      }),
    )
    await user.click(
      await screen.findByRole('option', { name: 'It will be different per employee' }),
    )
    await user.click(within(hires).getByRole('button', { name: 'Apply Changes' }))

    expect(await screen.findByText('Plan year updated')).toBeInTheDocument()
    expect(planYears.find('by_fiscal')).toMatchObject({
      name: 'Fiscal year 2026-27',
      newHireStart: 'per_employee',
    })
    expect(planYears.find('by_fiscal')?.planIds).toContain('bp_supp_life')
    expect((await findRow('Fiscal year 2026-27')).getByText('6')).toBeVisible()
  })

  it('deletes a plan year after the confirm, but not one with approved elections', async () => {
    const { user } = renderApp('/benefits/plan-years')

    await openRowMenu(user, 'Fiscal year', 'Delete')
    let confirm = await screen.findByRole('alertdialog', { name: 'Delete Plan Year' })
    expect(
      within(confirm).getByText('Are you sure you want to Delete “Fiscal year” plan year?'),
    ).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Delete Plan Year' }))
    expect(
      await screen.findByText('This plan year has approved elections; it cannot be deleted.'),
    ).toBeInTheDocument()
    expect(planYears.find('by_fiscal')).toBeDefined()

    const previous = `Fiscal year ${String(year - 1)}`
    await openRowMenu(user, previous, 'Delete')
    confirm = await screen.findByRole('alertdialog', { name: 'Delete Plan Year' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete Plan Year' }))
    expect(await screen.findByText('Plan year deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(previous)).not.toBeInTheDocument()
    })
    expect(planYears.find('by_previous')).toBeUndefined()
    await waitFor(() => {
      expect(stat('Plan Years')).toBe('1')
    })
  })

  it('opens an enrollment window in two steps', async () => {
    const { user } = renderApp('/benefits/plan-years')

    await openRowMenu(user, 'Fiscal year', 'Open Enrollment')
    const dialog = await screen.findByRole('dialog', { name: 'New Open Enrollment Window' })
    expect(within(dialog).getByRole('combobox', { name: 'Plan Year' })).toHaveTextContent(
      'Fiscal year',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Next: Step 2' }))
    expect(await within(dialog).findByText('Enter the enrollment name')).toBeVisible()
    expect(within(dialog).getByText('Choose when it becomes effective')).toBeVisible()
    expect(within(dialog).getByText('Choose the last day of enrollment')).toBeVisible()
    expect(within(dialog).getByText('Choose at least one plan')).toBeVisible()

    await user.type(
      within(dialog).getByRole('textbox', { name: 'Enrollment Name' }),
      'Spring enrollment',
    )
    const today = iso(new Date())
    await pickDate(user, 'When will this plan within this window become effective?', today)
    await pickDate(
      user,
      'When can employee complete their enrollment?',
      iso(addDays(new Date(), 14)),
    )
    // The window offers the plan year's coverages; Vision is not offered this year.
    expect(within(dialog).queryByRole('button', { name: /^Vision/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Medical Coverage' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Dental Coverage' }))
    await user.click(within(dialog).getByRole('button', { name: 'Next: Step 2' }))

    expect(
      await within(dialog).findByText('Who can enroll during this plan year window?'),
    ).toBeVisible()
    expect(within(dialog).getByText('Selected Employees (0)')).toBeVisible()
    // The search runs on the server (`GET /employees/lookup?q=Hina`) once typing pauses.
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search employees' }), 'Hina')
    const available = () => within(dialog).getByRole('listbox', { name: 'Available Employees' })
    await waitFor(() => {
      expect(within(available()).getAllByRole('option')).toHaveLength(1)
    })
    await user.click(within(available()).getByRole('option', { name: 'Hina Raza' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add the picked employees' }))
    expect(within(dialog).getByText('Selected Employees (1)')).toBeVisible()
    await user.clear(within(dialog).getByRole('searchbox', { name: 'Search employees' }))
    await choose(user, 'Available Employees', 'Finance')
    // Finance is Hina (already selected) and Omer, filtered on the server (`departmentId`).
    await waitFor(() => {
      expect(
        within(available())
          .getAllByRole('option')
          .map((item) => item.textContent),
      ).toEqual(['Omer Farooq'])
    })
    const addAll = within(dialog).getByRole('button', { name: 'Add everyone listed' })
    await waitFor(() => {
      expect(addAll).toBeEnabled()
    })
    await user.click(addAll)
    expect(within(dialog).getByText('Selected Employees (2)')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Create Enrollment Plan' }))
    expect(await screen.findByText('Enrollment window created')).toBeInTheDocument()
    const created = enrollmentWindows.all().find((window) => window.name === 'Spring enrollment')
    expect(created).toMatchObject({
      planYearId: 'by_fiscal',
      kind: 'open_enrollment',
      effectiveDate: today,
    })
    expect(created?.planIds).toEqual(
      expect.arrayContaining(['bp_hdhp1', 'bp_hdhp2', 'bp_fsa_hmo', 'bp_dental_ppo']),
    )
    expect(created?.employeeIds).toEqual(expect.arrayContaining(['em_hina', 'em_omer']))

    await user.click(screen.getByRole('link', { name: 'Enrollment Windows' }))
    expect(await screen.findByRole('heading', { name: 'Enrollment Windows' })).toBeVisible()
    const row = await findRow('Spring enrollment')
    expect(row.getByText('Open')).toBeVisible()
    expect(row.getByText('2')).toBeVisible()
    // The open enrollment window offers everyone.
    expect((await findRow('Fiscal year open enrollment')).getByText('Everyone')).toBeVisible()
  })

  it('opens a Qualifying Life Event window with its name', async () => {
    const { user } = renderApp('/benefits/plan-years')

    await openRowMenu(user, 'Fiscal year', 'Qualifying Life Event')
    const dialog = await screen.findByRole('dialog', {
      name: 'New Qualifying Life Event Window',
    })
    expect(within(dialog).getByRole('textbox', { name: 'Enrollment Name' })).toHaveValue(
      'Qualifying Life Event',
    )
  })

  it('takes the missing information link to the people and asks HR to update one', async () => {
    const { user, router } = renderApp('/benefits/plan-years')

    await user.click(
      (await findRow('Fiscal year')).getByRole('link', { name: 'Update missing information' }),
    )
    expect(
      await screen.findByText('Showing the employees who are missing required information.'),
    ).toBeVisible()
    expect(router.state.location.search).toEqual({ year: 'by_fiscal', missing: true })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Update the information of/ })).toHaveLength(2)
    })
    const omer = await findRow('Omer Farooq')
    expect(omer.getByText('Date of Birth, Marital Status')).toBeVisible()
    expect(omer.getByText('Pending')).toBeVisible()
    expect((await findRow('Maryam Javed')).getByText('Incomplete')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Update the information of Omer Farooq' }))
    const dialog = await screen.findByRole('dialog', { name: 'Update Information' })
    await user.click(within(dialog).getByRole('button', { name: 'Send to HR' }))
    expect(await within(dialog).findByText('Choose the date of birth')).toBeVisible()
    expect(within(dialog).getByText('Choose the marital status')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Date of Birth' }))
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Choose the Year' }),
      '1990',
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Choose the Month' }), 'May')
    await user.click(screen.getByRole('button', { name: /May 15th, 1990/ }))
    await choose(user, 'Marital Status', 'Married')
    await user.click(within(dialog).getByRole('button', { name: 'Send to HR' }))

    expect(await screen.findByText('Update sent to HR for approval')).toBeInTheDocument()
    expect(updateRequests.all()[0]).toMatchObject({
      employeeId: 'em_omer',
      changes: { dateOfBirth: '1990-05-15', maritalStatus: 'married' },
    })
  })

  it('hides what the user may not do', async () => {
    renderApp('/benefits/plan-years')
    act(() => {
      useAuthStore.getState().setSession({
        token: `${MOCK_TOKEN_PREFIX}test`,
        user: {
          ...DEMO_USER,
          permissions: [{ code: 'benefits.plan_years.view', scope: 'company' }],
        },
      })
    })

    expect(await findRow('Fiscal year')).toBeDefined()
    expect(screen.queryByRole('link', { name: 'New Plan Year' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Actions for Fiscal year' }),
    ).not.toBeInTheDocument()
  })
})

describe('Benefits: Plans', { timeout: 60_000 }, () => {
  it('lists the plans with their elections and refuses to delete one in use', async () => {
    const { user } = renderApp('/benefits/plans')

    expect(await screen.findByRole('heading', { name: 'Benefit Plans' })).toBeVisible()
    for (const header of ['Category', 'Plan Name', 'End Date', 'Carrier', 'Status', 'Elections']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeVisible()
    }
    const hdhp1 = await findRow('HDHP1')
    expect(hdhp1.getByText('Medical')).toBeVisible()
    expect(hdhp1.getByText(`21 March ${String(year + 1)}`)).toBeVisible()
    expect(hdhp1.getByText('Aetna · HDHP')).toBeVisible()
    expect(hdhp1.getByText('Active')).toBeVisible()
    expect(hdhp1.getByText('2 enrolled, 0 pending')).toBeVisible()

    await user.click(hdhp1.getByRole('button', { name: 'Delete HDHP1' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Plan' })
    expect(within(confirm).getByText('Are you sure you want to Delete “HDHP1” plan?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Delete Plan' }))
    expect(
      await screen.findByText('People have elected this plan; it cannot be deleted.'),
    ).toBeInTheDocument()
    expect(plans.find('bp_hdhp1')).toBeDefined()

    // Duplicate, then delete the copy.
    await user.click(screen.getByRole('button', { name: 'Duplicate Vision Plus' }))
    expect(await screen.findByText('Vision Plus (copy) added')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Delete Vision Plus (copy)' }))
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Delete Plan' })).getByRole('button', {
        name: 'Delete Plan',
      }),
    )
    expect(await screen.findByText('Plan deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Vision Plus (copy)')).not.toBeInTheDocument()
    })
  })

  it('adds a plan with its attachment from the Add New Plan menu', async () => {
    acceptUploads()
    const { user, router } = renderApp('/benefits/plans')

    await user.click(await screen.findByRole('button', { name: 'Add New Plan' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Dental' }))

    expect(await screen.findByRole('heading', { name: 'Add Dental Plan' })).toBeVisible()
    expect(router.state.location.search).toEqual({ category: 'dental' })

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    for (const message of [
      'Enter the plan name',
      'Choose the carrier',
      'Choose the plan type',
      'Enter the plan type ID',
      'Choose when the plan starts',
      'Choose when the plan ends',
    ]) {
      expect(await screen.findByText(message)).toBeVisible()
    }

    await user.type(screen.getByRole('textbox', { name: 'Plan Name' }), 'Dental PPO')
    await choose(user, 'Carrier', 'Delta Dental')
    await choose(user, 'Plan Type', 'DHMO')
    await user.type(screen.getByRole('textbox', { name: 'Plan Type ID' }), '22411')
    const start = new Date()
    await pickDate(user, 'Plan Starts', iso(start))
    await pickDate(user, 'Plan Ends', iso(addDays(start, 10)))
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Basic dental cover.')
    await user.upload(
      screen.getByLabelText(/^Attachment/),
      new File(['summary'], 'dental summary.pdf', { type: 'application/pdf' }),
    )
    expect(screen.getByText('dental summary.pdf')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('A plan with this name already exists.')).toBeVisible()

    const name = screen.getByRole('textbox', { name: 'Plan Name' })
    await user.clear(name)
    await user.type(name, 'Dental Basic')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Dental plan added')).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/benefits/plans')
    })
    const plan = plans.all().find((item) => item.name === 'Dental Basic')
    expect(plan).toMatchObject({
      category: 'dental',
      planType: 'DHMO',
      planTypeRef: '22411',
      carrier: 'Delta Dental',
      description: 'Basic dental cover.',
    })
    // The attachment was uploaded and attached to the new plan.
    expect(planFiles.all().some((file) => file.planId === plan?.id)).toBe(true)

    await user.click(screen.getByRole('link', { name: 'Files' }))
    expect(await screen.findByRole('heading', { name: 'Files' })).toBeVisible()
    const files = await screen.findByRole('table', { name: 'Plan files' })
    expect(await within(files).findByRole('cell', { name: 'Dental Basic' })).toBeVisible()
  })
})

describe('Benefits: Files', { timeout: 60_000 }, () => {
  it('lists the files with their links, removes one and adds one', async () => {
    acceptUploads()
    const { user } = renderApp('/benefits/files')

    const link = await screen.findByRole('link', { name: 'HDHP1 summary of benefits.pdf' })
    expect(link).toHaveAttribute('href', expect.stringContaining('/files/file_bp_hdhp1/download'))
    expect((await findRow('Basic Life certificate.pdf')).getByText('Life Insurance')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Remove Basic Life certificate.pdf' }))
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Remove File' })).getByRole('button', {
        name: 'Remove File',
      }),
    )
    expect(await screen.findByText('File removed')).toBeInTheDocument()
    expect(planFiles.find('at_bp_basic_life')).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Add File' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add File' })
    await user.click(within(dialog).getByRole('button', { name: 'Add File' }))
    expect(await within(dialog).findByText('Choose the plan')).toBeVisible()
    expect(within(dialog).getByText('Choose a file')).toBeVisible()
    await choose(user, 'Plan', 'Vision Plus')
    await user.upload(
      within(dialog).getByLabelText(/^File/),
      new File(['vision'], 'vision summary.pdf', { type: 'application/pdf' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add File' }))
    expect(await screen.findByText('File added')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Vision Plus' })).toBeVisible()
    expect(planFiles.all().some((file) => file.planId === 'bp_vision')).toBe(true)
  })
})
