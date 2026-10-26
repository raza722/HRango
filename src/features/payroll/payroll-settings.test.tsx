import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import {
  banks,
  benefits,
  currentPayrollSettings,
  payItems,
  taxStructures,
} from '@/mocks/payroll/db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date box's calendar and picks today. */
async function pickToday(user: UserEvent, label: string | RegExp) {
  await user.click(screen.getByRole('button', { name: label }))
  await user.click(
    screen.getByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
  )
}

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name)
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

describe('Payroll Settings', () => {
  it('shows the Payroll menu, the tabs and the sub-tabs', async () => {
    const { user, router } = renderApp('/payroll/settings/general')

    expect(
      await screen.findByRole('heading', { name: 'Payroll Settings', level: 1 }),
    ).toBeInTheDocument()
    const menu = screen.getByRole('navigation', { name: 'Payroll' })
    expect(within(menu).getByRole('link', { name: 'Payroll Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(menu).getByRole('link', { name: 'Pay Runs' })).toHaveAttribute(
      'href',
      '/payroll/payrolls/monthly',
    )
    const tabs = screen.getByRole('navigation', { name: 'Payroll Settings' })
    expect(within(tabs).getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const sections = screen.getByRole('navigation', { name: 'Sections' })
    expect(within(sections).getByRole('link', { name: 'Payroll Configuration' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(within(sections).getByRole('link', { name: 'Leave Configuration' }))
    expect(await screen.findByRole('heading', { name: 'CPL' })).toBeVisible()
    expect(router.state.location.search).toMatchObject({ view: 'leave-configuration' })

    await user.click(within(tabs).getByRole('link', { name: 'Disbursement Banks' }))
    expect(await screen.findByText('UBL Digital Bank')).toBeVisible()
    expect(router.state.location.pathname).toBe('/payroll/settings/disbursement-banks')
  })

  it('saves a payroll configuration setting', async () => {
    const { user } = renderApp('/payroll/settings/general')

    expect(await screen.findByRole('heading', { name: 'Payroll Configurations' })).toBeVisible()
    const box = screen.getByRole('checkbox', { name: '1. Exclude Final Settlement from Payroll' })
    expect(box).not.toBeChecked()
    await user.click(box)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    // A toast from an earlier test can still be up, so check what was saved.
    await waitFor(() => {
      expect(currentPayrollSettings().excludeFinalSettlement).toBe(true)
    })
  })

  it('works out the company year end from a fiscal year start', async () => {
    const { user } = renderApp('/payroll/settings/general?view=leave-configuration')

    expect(await screen.findByRole('heading', { name: 'CPL' })).toBeVisible()
    await user.click(screen.getByRole('switch', { name: 'Fiscal Year' }))
    expect(screen.getByRole('switch', { name: 'Calendar Year' })).not.toBeChecked()
    await choose(user, 'Company Year Start', 'July')
    expect(screen.getByRole('textbox', { name: 'Company Year End' })).toHaveValue('June')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(currentPayrollSettings()).toMatchObject({
        leaveYearBasis: 'fiscal',
        fiscalYearStartMonth: 7,
        fiscalYearEndMonth: 6,
      })
    })
  })

  it('creates a formula pay item and rejects an unknown reference', async () => {
    const { user } = renderApp('/payroll/settings/pay-components')

    expect(await rowOf('Salary')).toBeVisible()
    // System items cannot be deleted.
    await user.click(
      within(await rowOf('Salary')).getByRole('button', { name: 'Actions for Salary' }),
    )
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pay Item Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter a name')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Night Allowance')
    await choose(user, /^Pay item Type/, 'Earning')
    await choose(user, /^Calculation Type/, 'Formula')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the formula')).toBeVisible()
    await choose(user, /^Employee Formula/, /^Per Day Salary/)

    await user.click(within(dialog).getByRole('button', { name: 'Insert a variable' }))
    await user.click(await screen.findByRole('button', { name: /^\{gross_salary\}/ }))
    const eligibility = within(dialog).getByRole('textbox', { name: /^Eligibility Criteria/ })
    expect(eligibility).toHaveValue('{gross_salary}')
    await user.type(eligibility, ' > {{foo}')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('{foo} is not a variable, pay item or formula.'),
    ).toBeVisible()

    await user.clear(eligibility)
    await user.type(eligibility, '{{service_months} > 3')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Pay item created')).toBeInTheDocument()
    expect(
      within(await rowOf('Night Allowance')).getByText('{gross_salary} / {applicable_days}'),
    ).toBeVisible()
    expect(payItems.all().find((item) => item.name === 'Night Allowance')).toMatchObject({
      itemType: 'earning',
      calculationType: 'formula',
      employeeFormulaId: 'f_per_day',
      reference: '{night_allowance}',
      eligibilityExpression: '{service_months} > 3',
    })
  })

  it('creates a tax structure with a slab', async () => {
    const { user } = renderApp('/payroll/settings/tax?view=tax-structure')

    await user.click(await screen.findByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Tax Structure Create' })
    expect(within(dialog).getByText('No Record Found')).toBeVisible()
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Name/ }),
      'Tax Structure 2027-2028',
    )
    await pickToday(user, /^Start Date/)
    await pickToday(user, /^End Date/)
    await user.click(within(dialog).getByRole('button', { name: '+Add' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 minimum' }), '0')
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 maximum' }), '600000')
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 fixed amount' }), '0')
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 percentage' }), '120')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Use 0 to 100')).toBeVisible()

    await user.clear(within(dialog).getByRole('textbox', { name: 'Slab 1 percentage' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Slab 1 percentage' }), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Tax structure created')).toBeInTheDocument()
    expect(await rowOf('Tax Structure 2027-2028')).toBeVisible()
    const saved = taxStructures.all().find((item) => item.name === 'Tax Structure 2027-2028')
    expect(saved?.slabs).toMatchObject([
      { minAmount: 0, maxAmount: 600000, fixedAmount: 0, percentage: 5 },
    ])
  })

  it('creates a group benefit once it has a member', async () => {
    const { user } = renderApp('/payroll/settings/rewards')

    await user.click(await screen.findByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Benefit Create' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Fuel Allowance')
    await choose(user, /^Type/, 'Allowance')
    await choose(user, /^Payitem/, 'Travel Allowance')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Group' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('Add at least one member to a group benefit'),
    ).toBeVisible()

    const members = within(dialog).getByRole('region', { name: 'Members' })
    await user.click(within(members).getByRole('button', { name: '+Add' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(members).findByText('Choose who')).toBeVisible()
    await choose(user, 'Member 1 employee', /^Daniel Brooks/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Benefit created')).toBeInTheDocument()
    expect(await rowOf('Fuel Allowance')).toBeVisible()
    expect(benefits.all().find((item) => item.name === 'Fuel Allowance')).toMatchObject({
      benefitType: 'allowance',
      payItemId: 'pi_travel',
      isGroup: true,
      members: [{ employeeId: 'em_daniel', employeeName: 'Daniel Brooks', employeeGroupId: null }],
    })
  })

  it('creates a disbursement bank and deletes it', async () => {
    const { user } = renderApp('/payroll/settings/disbursement-banks')

    await user.click(await screen.findByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Disbursement Bank Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the account holder')).toBeVisible()

    const fill = async (label: RegExp, text: string) => {
      await user.type(within(dialog).getByRole('textbox', { name: label }), text)
    }
    await fill(/^Account Holder/, 'Top Edge Technologies')
    await fill(/^Account Number/, '0101-7788990011')
    await fill(/^Bank Name/, 'Bank Alfalah')
    await fill(/^Branch Name/, 'Clifton Branch')
    await fill(/^Branch Code/, '0101')
    await fill(/^Branch Location/, 'Karachi')
    await fill(/^Tax Payer ID/, '7364519-2')
    await pickToday(user, /^Effective Date/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Disbursement bank created')).toBeInTheDocument()
    const row = await rowOf('Bank Alfalah')
    expect(within(row).getByText(format(new Date(), 'MMMM d, yyyy'))).toBeVisible()

    await user.click(
      within(row).getByRole('button', { name: 'Actions for Bank Alfalah (0101-7788990011)' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete' })
    expect(within(confirm).getByText('Are you sure you want to Perform this action?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))

    expect(await screen.findByText('Disbursement bank deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Bank Alfalah')).not.toBeInTheDocument()
    })
    expect(banks.all().some((item) => item.bankName === 'Bank Alfalah')).toBe(false)
  })
})
