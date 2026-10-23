import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { clearances } from '@/mocks/assets/db'
import { endOfEmployments } from '@/mocks/offboarding/db'
import { finalSettlements } from '@/mocks/payroll/db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date box's calendar and picks a day of this month. */
async function pickDay(user: UserEvent, scope: HTMLElement, label: string | RegExp, date: Date) {
  await user.click(within(scope).getByRole('button', { name: label }))
  await user.click(
    await screen.findByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }),
  )
}

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name)
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

describe('End of Employment', () => {
  it('lists the records, and the sidebar scopes narrow them', async () => {
    const { router } = renderApp('/end-of-employment')

    expect(
      await screen.findByRole('heading', { name: 'End of Employment', level: 1 }),
    ).toBeVisible()
    expect(within(await rowOf('Talha Aziz')).getByText('Pending')).toBeVisible()
    expect(within(await rowOf('Nida Hassan')).getByText('Completed')).toBeVisible()

    await router.navigate({ to: '/end-of-employment/pending' })
    expect(await screen.findByText('Talha Aziz')).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByText('Nida Hassan')).not.toBeInTheDocument()
    })
  })

  it('asks for the required checklist answer, then makes the Final Settlement', async () => {
    const { user } = renderApp('/end-of-employment/all')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'End of Employment Create' })
    await choose(user, 'Employee', /Kashif Raza/)
    expect(await within(dialog).findByText(/^Email:/)).toBeVisible()
    await choose(user, /^Reason/, 'Termination')
    expect(
      within(dialog).queryByRole('button', { name: /^Last Working Date/ }),
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Notice Period' }))
    await pickDay(user, dialog, /^Last Working Date/, new Date())
    await user.click(within(dialog).getByRole('checkbox', { name: 'Final Settlement' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    // Asset Clear is required on the active checklist.
    expect(await within(dialog).findByText('Enter Asset Clear')).toBeVisible()
    expect(within(dialog).getByRole('tab', { name: 'Checklist' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(dialog).getByRole('heading', { name: 'Off Boarding Checklist' })).toBeVisible()
    await pickDay(user, dialog, /^Asset Clear/, new Date())
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('End of employment created')).toBeInTheDocument()
    const record = endOfEmployments.all().find((item) => item.employeeId === 'em_kashif')
    expect(record?.reason).toBe('termination')
    expect(record?.lastWorkingDate).toBe(format(new Date(), 'yyyy-MM-dd'))
    const settlement = finalSettlements.all().find((item) => item.employeeId === 'em_kashif')
    expect(settlement).toEqual(
      expect.objectContaining({ status: 'pending', reason: 'termination', noticePeriod: true }),
    )
    expect(record?.finalSettlementId).toBe(settlement?.id)
  })

  it('opens the clearance form, filled in, when Asset Clearance is ticked', async () => {
    const { user } = renderApp('/end-of-employment/all')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'End of Employment Create' })
    await choose(user, 'Employee', /Ayesha Malik/)
    await choose(user, /^Reason/, 'Resignation')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Asset Clearance' }))
    await user.click(within(dialog).getByRole('tab', { name: 'Checklist' }))
    await pickDay(user, dialog, /^Asset Clear/, new Date())
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    const form = await screen.findByRole('dialog', { name: 'Clearance Form Create' })
    await waitFor(() => {
      expect(within(form).getByRole('combobox', { name: /^Employee Name/ })).toHaveTextContent(
        'Ayesha Malik',
      )
    })
    expect(await within(form).findByRole('region', { name: 'Asset 1, Car' })).toBeVisible()
    await choose(user, /^Checked By/, /Hina Raza/)
    await choose(user, /^Clearance Approved By/, /Shelley Kannes/)
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Clearance form created')).toBeInTheDocument()
    const record = endOfEmployments.all().find((item) => item.employeeId === 'em_ayesha')
    const created = clearances.all().find((item) => item.employeeId === 'em_ayesha')
    expect(created?.endOfEmploymentId).toBe(record?.id)
    expect(endOfEmployments.find(record?.id ?? '')?.clearanceId).toBe(created?.id)
  })

  it('rehires a leaver after asking, and keeps completed records read-only', async () => {
    const { user } = renderApp('/end-of-employment/completed')

    await user.click(await screen.findByRole('button', { name: 'Actions for Nida Hassan' }))
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('menuitem', { name: 'Rehire' }))
    const dialog = await screen.findByRole('dialog', { name: 'End of Employment Rehire' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the joining date')).toBeVisible()

    const joining = addDays(new Date(), 0)
    await pickDay(user, dialog, /^Joining Date/, joining)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Rehire Nida Hassan' })
    expect(within(confirm).getByText('Are you sure you want to Perform this action?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))

    expect(await screen.findByText('Nida Hassan rehired')).toBeInTheDocument()
    expect(endOfEmployments.find('eoe_2')?.rehire?.joiningDate).toBe(format(joining, 'yyyy-MM-dd'))
    await user.click(await screen.findByRole('button', { name: 'Actions for Nida Hassan' }))
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Rehire' })).not.toBeInTheDocument()
  })
})
