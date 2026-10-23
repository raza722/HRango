import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, format, parse } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { enrollmentWindows, plans, planYears, profiles } from '@/mocks/benefits/db'
import { DIRECTORY } from '@/mocks/employees/seed'
import { renderApp } from '@/test/test-utils'

const iso = (date: Date) => format(date, 'yyyy-MM-dd')

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
    expect(stat('Employees')).toBe(String(DIRECTORY.length))

    const tabs = within(screen.getByRole('navigation', { name: 'Benefits' }))
    expect(tabs.getByRole('link', { name: 'Plan Years' })).toHaveAttribute('aria-current', 'page')
    expect(
      tabs.getByRole('link', { name: `Employees (${String(DIRECTORY.length)})` }),
    ).toBeVisible()

    const fiscal = await findRow('Fiscal year')
    expect(fiscal.getByText('5')).toBeVisible()
    expect(fiscal.getByText('Active')).toBeVisible()
    const year = new Date().getFullYear()
    expect(fiscal.getByText(`1 Jan ${String(year)} - 1 Jan ${String(year + 1)}`)).toBeVisible()
    expect(fiscal.getByText('3 pending, 22 approved, 2 incomplete')).toBeVisible()
    expect(fiscal.getByText('12 employees are missing required information')).toBeVisible()
    expect(fiscal.getByRole('link', { name: 'Update missing information' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Employee Elections' })).toBeVisible()

    // Showing: one plan year.
    await choose(user, 'Showing:', `Fiscal year ${String(year - 1)}`)
    expect(await screen.findByText('Ended')).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByText('Active')).not.toBeInTheDocument()
    })
    expect(router.state.location.search).toEqual({ year: 'by_previous' })

    // The filter button opens the same list; the tab links keep the plan year.
    await user.click(screen.getByRole('button', { name: 'Choose the plan year shown' }))
    await user.click(await screen.findByRole('option', { name: 'All Plan Years' }))
    expect(await screen.findByText('Active')).toBeVisible()
  })

  it('creates a plan year through Details, Plans and New Hires', async () => {
    const { user, router } = renderApp('/benefits/plan-years')

    await user.click(await screen.findByRole('link', { name: 'New Plan Year' }))
    expect(await screen.findByRole('heading', { name: 'Plan Year Details' })).toBeVisible()
    expect(screen.getByText('Fill the Form to proceed')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Continue: Plans' }))
    expect(await screen.findByText('Enter the plan year name')).toBeVisible()
    expect(screen.getByText('Choose the start date')).toBeVisible()
    expect(screen.getByText('Choose the end date')).toBeVisible()

    // A name the server refuses comes back on the Details step at the end.
    await user.type(screen.getByRole('textbox', { name: 'Plan Year Name' }), 'Fiscal year')
    const start = addDays(new Date(), 1)
    await pickDate(user, 'Plan Year Start', iso(start))
    await pickDate(user, 'Plan Year End', iso(addDays(start, 20)))
    await user.click(screen.getByRole('button', { name: 'Continue: Plans' }))

    expect(await screen.findByRole('heading', { name: 'Plans' })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Details, done/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue: New Hires' }))
    expect(await screen.findByText('Choose at least one plan')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /^Medical Coverage/ }))
    await user.click(screen.getByRole('checkbox', { name: 'HDHP1' }))
    expect(screen.getByRole('checkbox', { name: 'Medical Coverage' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    )
    expect(screen.getByText('(1 plan selected)', { exact: false })).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: 'Select All' }))
    expect(screen.getByText('(7 plans selected)', { exact: false })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue: New Hires' }))

    expect(await screen.findByRole('heading', { name: 'New Hires' })).toBeVisible()
    const period = screen.getByRole('textbox', {
      name: 'How long do new employees have to complete elections?',
    })
    await user.clear(period)
    await user.type(period, '0')
    await user.click(screen.getByRole('button', { name: 'Create Plan Year' }))
    expect(await screen.findByText('Enter 1 to 365')).toBeVisible()
    await user.clear(period)
    await user.type(period, '2')
    await choose(
      user,
      'When can new hires start their benefits enrollment?',
      'After a waiting period',
    )
    await user.click(screen.getByRole('button', { name: 'Create Plan Year' }))

    // Back on Details with the server's message.
    expect(await screen.findByText('A plan year with this name already exists')).toBeVisible()
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
    const created = planYears.all().find((year) => year.name === 'Benefits 2027')
    expect(created).toMatchObject({
      planIds: expect.arrayContaining(['bp_hdhp1', 'bp_vision']) as unknown,
      newHireStart: 'waiting-period',
      electionPeriod: 2,
      electionUnit: 'month',
    })
    expect(created?.planIds).toHaveLength(7)
    const created2027 = await findRow('Benefits 2027')
    expect(created2027.getByText('7')).toBeVisible()
    expect(created2027.getByText('Upcoming')).toBeVisible()
    await waitFor(() => {
      expect(stat('Plan Years')).toBe('3')
    })
  })

  it('edits a plan year in the popup through its three steps', async () => {
    const { user } = renderApp('/benefits/plan-years')

    await openRowMenu(user, 'Fiscal year', 'Edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Plan Year' })
    expect(within(dialog).getByText('Plan Year Details')).toBeVisible()
    const name = within(dialog).getByRole('textbox', { name: 'Plan Year Name' })
    expect(name).toHaveValue('Fiscal year')
    await user.clear(name)
    await user.click(within(dialog).getByRole('button', { name: 'Continue: Plans' }))
    expect(await within(dialog).findByText('Enter the plan year name')).toBeVisible()
    await user.type(name, 'Fiscal year 2026-27')
    await user.click(within(dialog).getByRole('button', { name: 'Continue: Plans' }))

    // Plans: the coverage groups open to their plans.
    expect(await screen.findByRole('dialog', { name: 'Plans' })).toBeVisible()
    expect(screen.getByText('(5 plans selected)', { exact: false })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Medical Coverage/ }))
    for (const plan of ['HDHP1', 'HDHP2', 'FSA-Eligible HMO']) {
      expect(screen.getByRole('checkbox', { name: plan })).toHaveAttribute('aria-checked', 'true')
    }
    await user.click(screen.getByRole('button', { name: /^Life Coverage/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Supplemental Life' }))
    expect(screen.getByText('(6 plans selected)', { exact: false })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue: New Hires' }))

    // New Hires: the start options and how long.
    const hires = await screen.findByRole('dialog', { name: 'New Hires' })
    expect(
      within(hires).getByText(
        'Whether employees start making elections on their first day or day 90, we’ve got you covered.',
        { exact: false },
      ),
    ).toBeVisible()
    await user.click(
      within(hires).getByRole('combobox', {
        name: 'When can new hires start their benefits enrollment?',
      }),
    )
    for (const option of ['Immediately upon hire', 'After a waiting period']) {
      expect(await screen.findByRole('option', { name: option })).toBeVisible()
    }
    await user.click(screen.getByRole('option', { name: 'It will be different per employee' }))
    await user.click(within(hires).getByRole('button', { name: 'Apply Changes' }))

    expect(await screen.findByText('Plan year updated')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(planYears.find('by_fiscal')).toMatchObject({
      name: 'Fiscal year 2026-27',
      newHireStart: 'per-employee',
    })
    expect(planYears.find('by_fiscal')?.planIds).toContain('bp_supp_life')
    const edited = await findRow('Fiscal year 2026-27')
    expect(edited.getByText('6')).toBeVisible()
    expect(edited.getByText('Active')).toBeVisible()

    // New Hire opens the popup at its last step.
    await openRowMenu(user, 'Fiscal year 2026-27', 'New Hire')
    const newHire = await screen.findByRole('dialog', { name: 'New Hires' })
    expect(within(newHire).getByRole('button', { name: /^Plans, done/ })).toBeVisible()
    await user.click(within(newHire).getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('deletes a plan year after the confirm', async () => {
    const { user } = renderApp('/benefits/plan-years')

    await openRowMenu(user, 'Fiscal year', 'Delete')
    let confirm = await screen.findByRole('alertdialog', { name: 'Delete Plan Year' })
    expect(
      within(confirm).getByText('Are you sure you want to Delete “Fiscal year” plan year?'),
    ).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(planYears.find('by_fiscal')).toBeDefined()

    await openRowMenu(user, 'Fiscal year', 'Delete')
    confirm = await screen.findByRole('alertdialog', { name: 'Delete Plan Year' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete Plan Year' }))
    expect(await screen.findByText('Plan year deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Fiscal year')).not.toBeInTheDocument()
    })
    expect(planYears.find('by_fiscal')).toBeUndefined()
    // Its enrollment windows go with it, and the counts follow.
    expect(enrollmentWindows.all()).toHaveLength(0)
    await waitFor(() => {
      expect(stat('Plan Years')).toBe('1')
    })
    expect(stat('Enrollment Windows')).toBe('0')
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
    await user.click(within(dialog).getByRole('button', { name: 'Create Enrollment Plan' }))
    expect(await within(dialog).findByText('Choose who can enroll')).toBeVisible()

    await user.type(within(dialog).getByRole('searchbox', { name: 'Search employees' }), 'Hina')
    const available = within(dialog).getByRole('listbox', { name: 'Available Employees' })
    await user.click(within(available).getByRole('option', { name: 'Hina Raza' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add the picked employees' }))
    expect(within(dialog).getByText('Selected Employees (1)')).toBeVisible()
    await user.clear(within(dialog).getByRole('searchbox', { name: 'Search employees' }))
    await choose(user, 'Available Employees', 'Software')
    await user.click(within(dialog).getByRole('button', { name: 'Add everyone listed' }))
    const software = DIRECTORY.filter((person) => person.department === 'Software').length
    expect(within(dialog).getByText(`Selected Employees (${String(software + 1)})`)).toBeVisible()

    // Back keeps step 1 as filled in.
    await user.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(within(dialog).getByRole('textbox', { name: 'Enrollment Name' })).toHaveValue(
      'Spring enrollment',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Next: Step 2' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Create Enrollment Plan' }))

    expect(await screen.findByText('Enrollment window created')).toBeInTheDocument()
    const created = enrollmentWindows.all().find((window) => window.name === 'Spring enrollment')
    expect(created).toMatchObject({ planYearId: 'by_fiscal', effectiveDate: today })
    expect(created?.planIds).toEqual(
      expect.arrayContaining(['bp_hdhp1', 'bp_hdhp2', 'bp_fsa_hmo', 'bp_dental_ppo']),
    )
    expect(created?.employeeIds).toHaveLength(software + 1)
    await waitFor(() => {
      expect(stat('Enrollment Windows')).toBe('3')
    })

    await user.click(screen.getByRole('link', { name: 'Enrollment Windows' }))
    expect(await screen.findByRole('heading', { name: 'Enrollment Windows' })).toBeVisible()
    const row = await findRow('Spring enrollment')
    expect(row.getByText('Open')).toBeVisible()
    expect(row.getByText(String(software + 1))).toBeVisible()
  })

  it('names a Qualifying Life Event window', async () => {
    const { user } = renderApp('/benefits/plan-years')

    await openRowMenu(user, 'Fiscal year', 'Qualifying Life Event')
    const dialog = await screen.findByRole('dialog', { name: 'New Open Enrollment Window' })
    expect(within(dialog).getByRole('textbox', { name: 'Enrollment Name' })).toHaveValue(
      'Qualifying Life Event',
    )
  })

  it('takes the missing information link to the people and updates one', async () => {
    const { user, router } = renderApp('/benefits/plan-years')

    await user.click(
      (await findRow('Fiscal year')).getByRole('link', { name: 'Update missing information' }),
    )
    expect(
      await screen.findByText('Showing the employees who are missing required information.'),
    ).toBeVisible()
    expect(router.state.location.search).toEqual({ year: 'by_fiscal', missing: true })
    const missing = DIRECTORY.filter((person) => {
      const profile = profiles.find(person.id)
      return !profile?.dateOfBirth || !profile.maritalStatus || !profile.homeAddress
    })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Update the information of/ })).toHaveLength(
        missing.length,
      )
    })

    const person = DIRECTORY[4]
    if (!person) throw new Error('No fifth person')
    expect((await findRow(person.name)).getByText('Date of Birth')).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: `Update the information of ${person.name}` }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Update Information' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the date of birth')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Date of Birth' }))
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Choose the Year' }),
      '1990',
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Choose the Month' }), 'May')
    await user.click(screen.getByRole('button', { name: /May 15th, 1990/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Information updated')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(person.name)).not.toBeInTheDocument()
    })
    expect(profiles.find(person.id)?.dateOfBirth).toBe('1990-05-15')
  })
})

describe('Benefits: Plans', { timeout: 60_000 }, () => {
  it('lists the plans with their enrolment and refuses to delete one in use', async () => {
    const { user } = renderApp('/benefits/plans')

    expect(await screen.findByRole('heading', { name: 'Benefit Plans' })).toBeVisible()
    for (const header of ['Category', 'Plan Name', 'End Date', 'Eligible', 'Status', 'Action']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeVisible()
    }
    const hdhp1 = await findRow('HDHP1')
    expect(hdhp1.getByText('Medical')).toBeVisible()
    expect(hdhp1.getByText(`21 March ${String(new Date().getFullYear() + 1)}`)).toBeVisible()
    expect(hdhp1.getByText('Full-Time')).toBeVisible()
    const enrolled = new Set([
      ...DIRECTORY.slice(0, 18).map((person) => person.id),
      ...DIRECTORY.slice(0, 22)
        .filter((_, index) => index % 3 !== 2)
        .map((person) => person.id),
    ]).size
    expect(
      hdhp1.getByText(
        `${String(enrolled)} enrolled, ${String(DIRECTORY.length - enrolled)} not enrolled/waived`,
      ),
    ).toBeVisible()

    await user.click(hdhp1.getByRole('button', { name: 'Delete HDHP1' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Plan' })
    expect(within(confirm).getByText('Are you sure you want to Delete “HDHP1” plan?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Delete Plan' }))
    expect(
      await screen.findByText(
        `HDHP1 has ${String(enrolled)} enrolled employees, so it cannot be deleted.`,
      ),
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

  it('adds a plan from the Add New Plan menu, with validation', async () => {
    const { user, router } = renderApp('/benefits/plans')

    await user.click(await screen.findByRole('button', { name: 'Add New Plan' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Medical',
      'Dental',
      'Vision',
      'Retirement',
      'Health Savings Account',
      'Life Insurance',
      'Others',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Dental' }))

    expect(await screen.findByRole('heading', { name: 'Add Dental Plan' })).toBeVisible()
    expect(router.state.location.search).toEqual({ category: 'dental' })
    expect(screen.getByText('How will you explain this plan to your employees?')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Coverage Options/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    for (const message of [
      'Enter the plan name',
      'Choose the carrier',
      'Choose the plan type',
      'Enter the plan type ID',
      'Choose when the plan starts',
      'Choose when the plan ends',
      'Choose a file',
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
    await user.upload(
      screen.getByLabelText(/^Attachment/),
      new File(['summary'], 'dental summary.pdf', { type: 'application/pdf' }),
    )
    expect(screen.getByText('dental summary.pdf')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText('A Dental plan with this name already exists')).toBeVisible()

    const name = screen.getByRole('textbox', { name: 'Plan Name' })
    await user.clear(name)
    await user.type(name, 'Dental Basic')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Dental plan added')).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/benefits/plans')
    })
    expect((await findRow('Dental Basic')).getByText('Dental')).toBeVisible()
    expect(plans.all().find((plan) => plan.name === 'Dental Basic')).toMatchObject({
      category: 'dental',
      planType: 'DHMO',
      carrier: 'Delta Dental',
      attachmentName: 'dental summary.pdf',
      eligibility: 'Full-Time',
    })
    await waitFor(() => {
      expect(stat('Plans')).toBe('8')
    })

    await user.click(screen.getByRole('link', { name: 'Files' }))
    expect(await screen.findByText('dental summary.pdf')).toBeVisible()
  })
})
