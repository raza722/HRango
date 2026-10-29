import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import {
  bankAccounts,
  contracts,
  dependents,
  education,
  employees,
  skills,
} from '@/mocks/talent-management/db'
import { renderApp } from '@/test/test-utils'

/** Opens a Radix select or a search select by its label and picks an option. */
async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date field's calendar and picks today. */
async function pickToday(user: UserEvent, label: string) {
  await user.click(screen.getByRole('button', { name: label }))
  await user.click(
    await screen.findByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
  )
}

async function openRowMenu(user: UserEvent, label: string, item: string) {
  await user.click(await screen.findByRole('button', { name: label }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

async function confirm(user: UserEvent, button: string) {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: button }),
  )
}

/** The tile's li (label + count). */
const tile = (label: string) => {
  const tiles = screen.getByRole('list', { name: 'Employees in numbers' })
  return within(tiles).getByText(label).closest('li')
}

describe('Talent Management → Employees', () => {
  it('opens on Employee Record with the tiles and the Employees table', async () => {
    const { router } = renderApp('/talent-management')

    expect(await screen.findByRole('heading', { name: 'Employee Record' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/talent-management/employees')
    const menu = screen.getByRole('navigation', { name: 'Talent Management' })
    expect(within(menu).getByRole('link', { name: 'Employees' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Transfer, Salary Revision and Employee Accounts stay in Requests and Payroll.
    for (const other of ['Transfer', 'Salary Revision', 'Employee Accounts']) {
      expect(within(menu).queryByRole('link', { name: other })).not.toBeInTheDocument()
    }

    const table = await screen.findByRole('table', { name: 'Employees' })
    for (const header of ['Sr. #', 'Staff', 'Reg. #', 'Department', 'Designation', 'Action']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(await within(table).findByRole('link', { name: 'Shelley Kannes' })).toBeVisible()
    expect(within(table).getByRole('cell', { name: 'EMP-0001' })).toBeVisible()
    expect(within(table).getByText('shelley.kannes@topedge.tech')).toBeVisible()
    expect(screen.getByText('Showing 1–10 of 34')).toBeVisible()

    // The tiles come from the list endpoint: every page counted for Male / Female.
    const people = employees.all()
    const male = people.filter((person) => person.gender === 'male').length
    const female = people.filter((person) => person.gender === 'female').length
    const probation = people.filter((person) => person.status === 'probation').length
    await waitFor(() => {
      expect(tile('Total Employees')).toHaveTextContent('Total Employees34')
    })
    expect(tile('Male')).toHaveTextContent(`Male${String(male)}`)
    expect(tile('Female')).toHaveTextContent(`Female${String(female)}`)
    expect(tile('On Probation')).toHaveTextContent(`On Probation${String(probation)}`)
    expect(probation).toBe(4)
  })

  it('searches, filters and pages, keeping them in the URL', async () => {
    const { user, router } = renderApp('/talent-management/employees')
    const table = await screen.findByRole('table', { name: 'Employees' })
    await within(table).findByRole('link', { name: 'Shelley Kannes' })

    await user.type(screen.getByRole('textbox', { name: 'Search employees' }), 'Hina')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: 'Hina' })
    })
    expect(await within(table).findByRole('link', { name: 'Hina Raza' })).toBeVisible()
    await waitFor(() => {
      expect(within(table).queryByRole('link', { name: 'Shelley Kannes' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('Showing 1–1 of 1')).toBeVisible()

    await user.clear(screen.getByRole('textbox', { name: 'Search employees' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await within(table).findByRole('link', { name: 'Shelley Kannes' })

    // The filter panel: status On Probation.
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const filters = await screen.findByRole('dialog', { name: 'Filters' })
    await choose(user, 'Status', 'On Probation')
    await user.click(within(filters).getByRole('button', { name: 'Apply' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ status: 'probation' })
    })
    expect(await screen.findByText('Showing 1–4 of 4')).toBeVisible()
    expect(within(table).getByRole('link', { name: 'Laiba Shah' })).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /^Filter\s*1\s*in use$/ })).toBeVisible()

    // One Filter button (the title has no second one doing the same).
    expect(screen.queryByRole('button', { name: 'Filter employees' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Filter\s*1\s*in use$/ }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Filters' })).getByRole('button', {
        name: 'Reset',
      }),
    )
    expect(await screen.findByText('Showing 1–10 of 34')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(await screen.findByText('Showing 11–20 of 34')).toBeVisible()
    expect(router.state.location.search).toEqual({ page: 2 })
    expect(within(table).getByRole('cell', { name: 'EMP-0011' })).toBeVisible()
  })

  it('adds an employee: form checks, a refused code, then saves', async () => {
    const { user } = renderApp('/talent-management/employees')
    await user.click(await screen.findByRole('button', { name: '+ Add New' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add New Employee' })

    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }))
    expect(await within(dialog).findByText('Enter the first name')).toBeVisible()
    expect(within(dialog).getByText('Enter the last name')).toBeVisible()
    expect(within(dialog).getByText('Choose the branch')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: /^First Name/ }), 'Ali')
    await user.type(within(dialog).getByRole('textbox', { name: /^Last Name/ }), 'Haider')
    await user.type(within(dialog).getByRole('textbox', { name: /^Email Address/ }), 'ali@')
    await choose(user, /^Branch/, 'Lahore Head Office')
    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }))
    expect(await within(dialog).findByText('Enter a valid email address')).toBeVisible()
    await user.clear(within(dialog).getByRole('textbox', { name: /^Email Address/ }))
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Email Address/ }),
      'ali.haider@topedge.tech',
    )

    // The server refuses a code someone has; the message lands on Reg. #.
    await user.type(within(dialog).getByRole('textbox', { name: /^Reg\. #/ }), 'EMP-0001')
    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }))
    expect(await within(dialog).findByText('Another employee already has this code.')).toBeVisible()

    await user.clear(within(dialog).getByRole('textbox', { name: /^Reg\. #/ }))
    await choose(user, /^Department/, 'Software')
    await user.click(within(dialog).getByRole('button', { name: 'Add Employee' }))

    expect((await screen.findAllByText('Employee added')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add New Employee' })).not.toBeInTheDocument()
    })
    const saved = employees.all().find((person) => person.firstName === 'Ali')
    expect(saved).toMatchObject({
      code: 'EMP-0035',
      lastName: 'Haider',
      email: 'ali.haider@topedge.tech',
      branchId: 'br_lhr_ho',
      departmentName: 'Software',
      status: 'active',
    })
    await waitFor(() => {
      expect(tile('Total Employees')).toHaveTextContent('Total Employees35')
    })
  }, 30_000)

  it('deactivates and reactivates from the row menu', async () => {
    const { user } = renderApp('/talent-management/employees?q=Kashif')
    await screen.findByRole('link', { name: 'Kashif Raza' })

    await openRowMenu(user, 'Actions for Kashif Raza', 'Deactivate')
    await confirm(user, 'Deactivate')
    expect((await screen.findAllByText('Kashif Raza deactivated')).length).toBeGreaterThan(0)
    expect(employees.find('em_kashif')?.status).toBe('inactive')
    // Inactive people leave the list unless asked for.
    expect(await screen.findByText('No employees match the search or filters.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const filters = await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(within(filters).getByRole('checkbox', { name: 'Include inactive employees' }))
    await user.click(within(filters).getByRole('button', { name: 'Apply' }))
    expect(await screen.findByRole('link', { name: 'Kashif Raza' })).toBeVisible()
    expect(screen.getByText('Inactive')).toBeVisible()

    await openRowMenu(user, 'Actions for Kashif Raza', 'Reactivate')
    await confirm(user, 'Reactivate')
    await waitFor(() => {
      expect(employees.find('em_kashif')?.status).toBe('active')
    })
  }, 30_000)

  it('opens a profile from the list and shows every tab', async () => {
    const { user, router } = renderApp('/talent-management/employees')
    const table = await screen.findByRole('table', { name: 'Employees' })
    await user.click(await within(table).findByRole('link', { name: 'Shelley Kannes' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Shelley Kannes' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/talent-management/employees/em_shelley')
    const tabs = screen.getByRole('tablist', { name: 'Employee details' })
    for (const name of [
      'Personal',
      'Work',
      'Documents',
      'Dependents',
      'Benefits',
      'Leave',
      'Skills',
    ]) {
      expect(within(tabs).getByRole('tab', { name })).toBeVisible()
    }

    // Personal, as drawn: Full Name … Marital Status.
    const personal = screen.getByRole('group', { name: 'Personal details' })
    expect(within(personal).getByText('Full Name')).toBeVisible()
    expect(within(personal).getByText('Tenure').nextSibling).toHaveTextContent(/Years?/)
    expect(within(personal).getByText('Emergency Contact #').nextSibling).toHaveTextContent(
      '0312-5656412',
    )
    expect(within(personal).getByText('Reg. #').nextSibling).toHaveTextContent('EMP-0001')
    expect(await screen.findByText('Ashraf Hussain')).toBeVisible()

    await user.click(within(tabs).getByRole('tab', { name: 'Work' }))
    expect(router.state.location.search).toEqual({ tab: 'work' })
    for (const heading of [
      'Payroll History',
      'Loan Summary',
      'Performance Details',
      'Attendance',
    ]) {
      expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    }
    // Plain wording, and View More opens this person's goals in Performance.
    const performance = screen.getByRole('region', { name: 'Performance Details' })
    expect(within(performance).getByText(/opens this person’s goals in Performance/)).toBeVisible()
    expect(within(performance).queryByText(/API/)).not.toBeInTheDocument()
    const goals = within(performance).getByRole('link', { name: 'View More' })
    expect(goals).toHaveAttribute('href', expect.stringContaining('/performance/goals') as string)
    expect(goals).toHaveAttribute(
      'href',
      expect.stringContaining('employeeId=em_shelley') as string,
    )
    // The bank account number is masked in the list.
    expect(await screen.findByText('•••• 4567')).toBeVisible()
    expect(screen.queryByText('PK36MEZN0002010101234567')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Attendance' })).toHaveAttribute(
      'href',
      expect.stringContaining('employeeId=em_shelley') as string,
    )
    expect(await screen.findByText('Meezan Bank')).toBeVisible()

    await user.click(within(tabs).getByRole('tab', { name: 'Documents' }))
    expect(await screen.findByText('Studied at BZU Multan')).toBeVisible()
    expect(screen.getByText('Graduation: BSIT')).toBeVisible()
    expect(screen.getByText('Project Contract')).toBeVisible()
    expect(screen.getByText('Resume')).toBeVisible()
    expect(screen.getByText('Worked at HexaTech')).toBeVisible()
    expect(screen.getByText('Position: Graphic Designer')).toBeVisible()

    await user.click(within(tabs).getByRole('tab', { name: 'Dependents' }))
    expect(await screen.findByText('Father | Property Dealer')).toBeVisible()
    expect(screen.getByText('Mother | Housewife')).toBeVisible()

    await user.click(within(tabs).getByRole('tab', { name: 'Benefits' }))
    expect(await screen.findByRole('heading', { name: 'Employee Benefits' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Company Contributions' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'View Details' })).toHaveAttribute(
      'href',
      '/benefits/employees',
    )

    await user.click(within(tabs).getByRole('tab', { name: 'Leave' }))
    expect(await screen.findByRole('heading', { name: 'Leave Overview This Month' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'View Calendar' })).toHaveAttribute(
      'href',
      '/leaves/applications?employeeId=em_shelley',
    )

    await user.click(within(tabs).getByRole('tab', { name: 'Skills' }))
    expect(await screen.findByRole('button', { name: /^Logo Design/ })).toBeVisible()
    expect(router.state.location.search).toEqual({ tab: 'skills' })
  }, 30_000)

  it('updates the profile, the CNIC through identity', async () => {
    const { user } = renderApp('/talent-management/employees/em_hina')
    await user.click(await screen.findByRole('button', { name: 'Update Profile' }))
    const dialog = await screen.findByRole('dialog', { name: 'Update Profile' })
    const fullName = within(dialog).getByRole('textbox', { name: 'Full Name' })
    expect(fullName).toHaveValue('Hina Raza')

    await user.clear(fullName)
    await user.click(within(dialog).getByRole('button', { name: 'Update Profile' }))
    expect(await within(dialog).findByText('Enter the full name')).toBeVisible()
    await user.type(fullName, 'Hina')
    await user.click(within(dialog).getByRole('button', { name: 'Update Profile' }))
    expect(await within(dialog).findByText('Enter the first and last name')).toBeVisible()

    await user.type(fullName, ' Raza Khan')
    const phone = within(dialog).getByRole('textbox', { name: 'Phone Number' })
    await user.clear(phone)
    await user.type(phone, '0333-1234567')
    const cnic = within(dialog).getByRole('textbox', { name: 'CNIC No' })
    await user.clear(cnic)
    await user.type(cnic, '35202-7654321-9')
    await choose(user, 'Marital Status', 'Widowed')
    await user.click(within(dialog).getByRole('button', { name: 'Update Profile' }))

    expect((await screen.findAllByText('Profile updated')).length).toBeGreaterThan(0)
    expect(employees.find('em_hina')).toMatchObject({
      firstName: 'Hina Raza',
      lastName: 'Khan',
      phone1: '0333-1234567',
      cnic: '35202-7654321-9',
      maritalStatus: 'widowed',
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Hina Raza Khan' })).toBeVisible()
  }, 30_000)

  it('adds a dependent and deletes one', async () => {
    const { user } = renderApp('/talent-management/employees/em_shelley?tab=dependents')
    await screen.findByText('Ashraf Hussain')

    await user.click(screen.getByRole('button', { name: 'Add Dependents' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Dependents' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the relation')).toBeVisible()
    expect(within(dialog).getByText('Enter the first name')).toBeVisible()

    await user.click(within(dialog).getByRole('radio', { name: 'Female Dependents' }))
    await choose(user, 'Relation', 'Sister')
    await user.type(within(dialog).getByRole('textbox', { name: 'First Name' }), 'Amna')
    await user.type(within(dialog).getByRole('textbox', { name: 'Last Name' }), 'Hussain')
    await user.type(within(dialog).getByRole('textbox', { name: 'Occupation' }), 'Teacher')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Amna Hussain')).toBeVisible()
    expect(screen.getByText('Sister | Teacher')).toBeVisible()
    expect(dependents.all().find((row) => row.firstName === 'Amna')).toMatchObject({
      employeeId: 'em_shelley',
      relation: 'sister',
      occupation: 'Teacher',
    })

    await openRowMenu(user, 'Actions for Ashraf Hussain', 'Delete')
    await confirm(user, 'Delete')
    await waitFor(() => {
      expect(screen.queryByText('Father | Property Dealer')).not.toBeInTheDocument()
    })
    expect(dependents.all().some((row) => row.firstName === 'Ashraf')).toBe(false)
  }, 30_000)

  it('adds a skill, refuses a duplicate, and removes one', async () => {
    const { user } = renderApp('/talent-management/employees/em_shelley?tab=skills')
    await screen.findByRole('button', { name: /^Logo Design/ })

    await user.click(screen.getByRole('button', { name: 'Add Skills' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Skills' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the skill title')).toBeVisible()
    expect(within(dialog).getByText('Choose the skill level')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: 'Skill Title' }), 'logo design')
    await choose(user, 'Skill Level', 'Expert')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('This skill is already on the profile.')).toBeVisible()

    const title = within(dialog).getByRole('textbox', { name: 'Skill Title' })
    await user.clear(title)
    await user.type(title, 'Figma')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: /^Figma/ })).toBeVisible()
    expect(skills.all().find((row) => row.skillTitle === 'Figma')?.skillLevel).toBe('expert')

    await user.click(screen.getByRole('button', { name: 'Remove Logo Design' }))
    await confirm(user, 'Delete')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Logo Design/ })).not.toBeInTheDocument()
    })
  }, 30_000)

  it('adds an academic record and a contract, and deletes the contract', async () => {
    const { user } = renderApp('/talent-management/employees/em_shelley?tab=documents')
    await screen.findByText('Studied at BZU Multan')

    // Add Academic, with the In Process switch and a document.
    await user.click(screen.getByRole('button', { name: /^Add/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add Academic' }))
    let dialog = await screen.findByRole('dialog', { name: 'Add Academic' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the academic title')).toBeVisible()
    expect(within(dialog).getByText('Enter the institute name')).toBeVisible()
    expect(within(dialog).getByText('Choose the from date')).toBeVisible()
    expect(within(dialog).getByText('Choose the to date, or switch on In Process')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: 'Academic Title' }), 'Masters: MBA')
    await user.type(within(dialog).getByRole('textbox', { name: 'Institute Name' }), 'IBA Karachi')
    await pickToday(user, 'From Date')
    await user.click(within(dialog).getByRole('switch', { name: 'In Process' }))
    await user.upload(
      within(dialog).getByLabelText('Upload Document file'),
      new File(['%PDF'], 'mba-enrolment.pdf', { type: 'application/pdf' }),
    )
    expect(await within(dialog).findByRole('link', { name: 'mba-enrolment.pdf' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Studied at IBA Karachi')).toBeVisible()
    expect(screen.getByText(`${String(new Date().getFullYear())}-Present`)).toBeVisible()
    expect(education.all().find((row) => row.institute === 'IBA Karachi')).toMatchObject({
      title: 'Masters: MBA',
      isInProcess: true,
      toDate: null,
      file: { name: 'mba-enrolment.pdf' },
    })

    // Add Contract: the Employee Name is the person's; 12 months fills the To Date.
    await user.click(screen.getByRole('button', { name: /^Add/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add Contract' }))
    dialog = await screen.findByRole('dialog', { name: 'Add Contract' })
    expect(within(dialog).getByRole('textbox', { name: 'Employee Name' })).toHaveValue(
      'Shelley Kannes',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the contract type')).toBeVisible()

    await choose(user, 'Contract Type', 'Permanent')
    await choose(user, 'Contract Duration in Months', '12 Months')
    await pickToday(user, 'From Date')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Permanent Contract')).toBeVisible()
    const saved = contracts
      .all()
      .find((row) => row.remarks === null && row.employeeId === 'em_shelley')
    expect(saved).toMatchObject({ contractType: 'permanent', durationMonths: 12 })
    expect(saved?.toDate).not.toBeNull()

    await openRowMenu(user, 'Actions for Permanent Contract', 'Delete')
    await confirm(user, 'Delete')
    await waitFor(() => {
      expect(screen.queryByText('Permanent Contract')).not.toBeInTheDocument()
    })
    expect(contracts.all().some((row) => row.id === saved?.id)).toBe(false)
  }, 40_000)

  it('checks a bank account number and NTN, and masks the number in the list', async () => {
    const { user } = renderApp('/talent-management/employees/em_hina?tab=work')
    await user.click(
      await screen.findByRole('button', { name: 'Add Account' }, { timeout: 15_000 }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Add Bank Account' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Bank Name' }), 'UBL')
    const number = within(dialog).getByRole('textbox', { name: 'Account Number / IBAN' })
    const ntn = within(dialog).getByRole('textbox', { name: 'Tax Payer ID (NTN)' })
    await user.type(number, 'abc!!')
    await user.type(ntn, 'xyz')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText(/Enter the account number \(digits\) or an IBAN/),
    ).toBeVisible()
    expect(within(dialog).getByText('Enter the NTN as digits, such as 1234567-8')).toBeVisible()

    await user.clear(number)
    await user.type(number, 'PK60 UNIL 0109 0001 2345 6789')
    await user.clear(ntn)
    await user.type(ntn, '1234567-8')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('UBL')).toBeVisible()
    expect(bankAccounts.all().find((row) => row.bankName === 'UBL')).toMatchObject({
      employeeId: 'em_hina',
      taxPayerId: '1234567-8',
    })
    // The list shows the last four only; Edit opens the whole number.
    expect(screen.getByText('•••• 6789')).toBeVisible()
    await openRowMenu(user, 'Actions for UBL account ending 6789', 'Edit')
    const edit = await screen.findByRole('dialog', { name: 'Edit Bank Account' })
    expect(within(edit).getByRole('textbox', { name: 'Account Number / IBAN' })).toHaveValue(
      'PK60 UNIL 0109 0001 2345 6789',
    )
  }, 60_000)

  it('asks before closing a form with unsaved changes, and marks the required fields', async () => {
    const { user } = renderApp('/talent-management/employees/em_shelley?tab=skills')
    await user.click(await screen.findByRole('button', { name: 'Add Skills' }, { timeout: 15_000 }))
    let dialog = await screen.findByRole('dialog', { name: 'Add Skills' })
    // Required fields carry the asterisk; the button reads Save like the other forms.
    expect(within(dialog).getByText('Skill Title')).toHaveTextContent('Skill Title*')
    expect(within(dialog).getByText('Skill Level')).toHaveTextContent('Skill Level*')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeVisible()

    // Untouched, Cancel closes at once.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Skills' })).not.toBeInTheDocument()
    })

    // With a change, Cancel asks; Keep editing stays, Discard closes.
    await user.click(screen.getByRole('button', { name: 'Add Skills' }))
    dialog = await screen.findByRole('dialog', { name: 'Add Skills' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Skill Title' }), 'Sketching')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(ask).getByRole('button', { name: 'Keep editing' }))
    expect(within(dialog).getByRole('textbox', { name: 'Skill Title' })).toHaveValue('Sketching')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await confirm(user, 'Discard')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Add Skills' })).not.toBeInTheDocument()
    })
    expect(skills.all().some((row) => row.skillTitle === 'Sketching')).toBe(false)
  }, 60_000)
})
