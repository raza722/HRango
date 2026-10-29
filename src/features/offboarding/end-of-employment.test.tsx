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

/**
 * Opens a date box's calendar and picks a day. The calendar opens on the box's month (or its
 * first allowed one), so it moves to the day's month first.
 */
async function pickDay(user: UserEvent, scope: HTMLElement, label: string | RegExp, date: Date) {
  await user.click(within(scope).getByRole('button', { name: label }))
  const day = new RegExp(format(date, 'MMMM do, yyyy'))
  await screen.findByRole('button', { name: /^Go to the Next Month$/ })
  for (let tries = 0; tries < 24 && !screen.queryByRole('button', { name: day }); tries += 1) {
    // The month grid is named after the month shown ("October 2026").
    const shown = screen.getByRole('grid').getAttribute('aria-label')
    const later = shown ? new Date(`1 ${shown}`) < date : true
    await user.click(
      screen.getByRole('button', {
        name: later ? /^Go to the Next Month$/ : /^Go to the Previous Month$/,
      }),
    )
  }
  await user.click(screen.getByRole('button', { name: day }))
}

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name)
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

describe('End of Employment', { timeout: 60_000 }, () => {
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

  it('checks a checklist answer, then saves the record, its answers and the Final Settlement', async () => {
    const { user } = renderApp('/end-of-employment/all')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'End of Employment Create' })
    await choose(user, 'Employee', /Kashif Raza/)
    expect(await within(dialog).findByText(/^Email:/)).toBeVisible()
    // Before saving, the card reads the person's record: age, email, phone and experience.
    const facts = within(dialog).getByRole('region', { name: /^Kashif Raza/ })
    expect(await within(facts).findByText(/@/)).toBeVisible()
    expect(within(facts).getAllByText(/\d+ years?, \d+ months?, \d+ days?/)).toHaveLength(2)
    expect(within(facts).queryByText('—')).not.toBeInTheDocument()
    await choose(user, /^Reason/, 'Termination')
    expect(
      within(dialog).queryByRole('button', { name: /^Last Working Date/ }),
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Notice Period' }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Notice Period Days/ }), '30')
    // The days fill in the Last Working Date: 30 days from today.
    const lastDay = addDays(new Date(), 30)
    expect(within(dialog).getByText(format(lastDay, 'MMMM d, yyyy'))).toBeVisible()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Final Settlement' }))

    // Notice Days Served takes 0 to 90.
    await user.click(within(dialog).getByRole('tab', { name: 'Checklist' }))
    const served = within(dialog).getByRole('spinbutton', { name: /^Notice Days Served/ })
    await user.type(served, '120')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('At most 90')).toBeVisible()
    expect(within(dialog).getByRole('heading', { name: 'Off Boarding Checklist' })).toBeVisible()
    await user.clear(served)
    await user.type(served, '30')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('End of employment created')).toBeInTheDocument()
    const record = endOfEmployments.all().find((item) => item.employeeId === 'em_kashif')
    expect(record).toMatchObject({
      reason: 'termination',
      noticePeriod: true,
      noticePeriodDays: 30,
      lastWorkingDate: format(lastDay, 'yyyy-MM-dd'),
    })
    expect(record?.checklist.cf_notice_days).toBe(30)
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
    await pickDay(user, dialog, /^Asset Clear/, new Date())
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    const form = await screen.findByRole('dialog', { name: 'Clearance Form Create' })
    await waitFor(() => {
      expect(within(form).getByRole('combobox', { name: /^Employee Name/ })).toHaveTextContent(
        'Ayesha Malik',
      )
    })
    const block = await within(form).findByRole('region', { name: 'Asset 1, Car' })
    await user.click(within(block).getByRole('radio', { name: 'Complete Return' }))
    await choose(user, /^Checked By/, /Hina Raza/)
    await user.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Clearance form created')).toBeInTheDocument()
    const record = endOfEmployments.all().find((item) => item.employeeId === 'em_ayesha')
    expect(record?.assetClearByDate).toBe(format(new Date(), 'yyyy-MM-dd'))
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

    // A joining date on or before the last working date is refused before the confirm.
    const last = endOfEmployments.find('eoe_2')?.lastWorkingDate ?? ''
    const joining = new Date()
    await pickDay(user, dialog, /^Joining Date/, joining)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Rehire Nida Hassan' })
    expect(
      within(confirm).getByText(
        `Rehire Nida Hassan, joining on ${format(joining, 'MMMM d, yyyy')}?`,
      ),
    ).toBeVisible()
    expect(last < format(joining, 'yyyy-MM-dd')).toBe(true)
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))

    expect(await screen.findByText('Nida Hassan rehired')).toBeInTheDocument()
    expect(endOfEmployments.find('eoe_2')?.rehire?.joiningDate).toBe(format(joining, 'yyyy-MM-dd'))
    await user.click(await screen.findByRole('button', { name: 'Actions for Nida Hassan' }))
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Rehire' })).not.toBeInTheDocument()
  })

  it('offers Complete only once nothing waits, saying what it waits for', async () => {
    const { user } = renderApp('/end-of-employment/pending')

    await user.click(await screen.findByRole('button', { name: 'Actions for Talha Aziz' }))
    const complete = await screen.findByRole('menuitem', {
      name: /^Complete \(waiting for Final settlement to be closed/,
    })
    expect(complete).toHaveAttribute('aria-disabled', 'true')
    expect(endOfEmployments.find('eoe_1')?.status).toBe('pending')
    expect(screen.getByText(/^Showing 1 to 1 of 1 record$/)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Last Working Date' })).toBeInTheDocument()
  })
})
