import { configure, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { addDays, differenceInCalendarMonths, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { appraisals, cycles, kpis } from '@/mocks/performance/db'
import { renderApp } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

const YEAR = new Date().getFullYear()

async function pickDate(user: UserEvent, scope: HTMLElement, label: string, date: Date) {
  await user.click(within(scope).getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(date, new Date())
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(date, 'MMMM do, yyyy')) }))
}

async function choose(user: UserEvent, scope: HTMLElement, label: string, option: RegExp) {
  await user.click(within(scope).getByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function rowAction(user: UserEvent, name: string, action: string) {
  await user.click(await screen.findByRole('button', { name }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

async function confirm(user: UserEvent, button: string) {
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: button }),
  )
}

describe('Performance → KPIs and Review Cycles', { timeout: 60_000 }, () => {
  it('lists the KPI library, adds a KPI with its checks and refuses to delete one in use', async () => {
    const { user } = renderApp('/performance/kpis')

    const table = await screen.findByRole('table', { name: 'KPI Library' }, { timeout: 15_000 })
    expect(await within(table).findByText('Time to Hire')).toBeVisible()
    for (const header of ['KPI', 'Key Result Area', 'Measure', 'Target', 'Default Weight']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(screen.getByText('Showing 1–10 of 10')).toBeVisible()
    expect(within(table).getByText('Policy Audit Findings').closest('tr')).toHaveTextContent(
      'Inactive',
    )
    expect(within(table).getByText('Sales Revenue').closest('tr')).toHaveTextContent(
      'PKR 25,000,000',
    )

    // Add KPI: required name, the weight range, then a duplicate name refused by the API.
    await user.click(screen.getByRole('button', { name: '+ Add KPI' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add KPI' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Default Weight/ }), '150')
    await user.click(within(dialog).getByRole('button', { name: 'Add KPI' }))
    expect(await within(dialog).findByText('Enter the KPI name')).toBeVisible()
    expect(within(dialog).getByText("The weight can't be above 100")).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Time to Hire')
    await user.clear(within(dialog).getByRole('textbox', { name: /^Default Weight/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Default Weight/ }), '20')
    await user.click(within(dialog).getByRole('button', { name: 'Add KPI' }))
    expect(await within(dialog).findByText('A KPI with this name already exists.')).toBeVisible()

    const name = within(dialog).getByRole('textbox', { name: /^Name/ })
    await user.clear(name)
    await user.type(name, 'Offer Acceptance Rate')
    await user.type(within(dialog).getByRole('textbox', { name: 'Key Result Area' }), 'Recruitment')
    await user.type(within(dialog).getByRole('textbox', { name: 'Target Value' }), '85')
    await user.type(within(dialog).getByRole('textbox', { name: 'Unit' }), '%')
    await choose(user, dialog, 'Department', /^Human Resource Management$/)
    await user.click(within(dialog).getByRole('button', { name: 'Add KPI' }))
    expect(await screen.findByText('KPI added')).toBeVisible()
    expect(kpis.all().find((kpi) => kpi.name === 'Offer Acceptance Rate')).toMatchObject({
      keyResultArea: 'Recruitment',
      targetValue: 85,
      unit: '%',
      defaultWeight: 20,
      departmentId: 'dep_human-resource-management',
      measureType: 'percentage',
      isActive: true,
    })
    const row = (await within(table).findByText('Offer Acceptance Rate')).closest('tr')
    expect(row).toHaveTextContent('Human Resource Management')
    expect(row).toHaveTextContent('85%')

    // A KPI goals use can't go.
    await rowAction(user, 'Actions for Time to Hire', 'Delete')
    await confirm(user, 'Delete')
    expect(
      await screen.findByText(
        'Time to Hire is used by 2 goals or criteria. Make it inactive instead.',
      ),
    ).toBeVisible()
    expect(kpis.find('pk_time_to_hire')).toBeDefined()

    // An unused one can.
    await rowAction(user, 'Actions for Offer Acceptance Rate', 'Delete')
    await confirm(user, 'Delete')
    expect(await screen.findByText('KPI “Offer Acceptance Rate” deleted')).toBeVisible()
    await waitFor(() => {
      expect(within(table).queryByText('Offer Acceptance Rate')).not.toBeInTheDocument()
    })
  })

  it('creates a cycle, adds participants, launches it and closes it', async () => {
    const { user } = renderApp('/performance/cycles')

    const table = await screen.findByRole('table', { name: 'Review Cycles' }, { timeout: 15_000 })
    expect(await within(table).findByText(`Annual Review ${String(YEAR)}`)).toBeVisible()
    expect(
      within(table)
        .getByText(`Annual Review ${String(YEAR - 1)}`)
        .closest('tr'),
    ).toHaveTextContent('Closed')
    expect(
      within(table)
        .getByText(`Probation Reviews ${String(YEAR)}`)
        .closest('tr'),
    ).toHaveTextContent('Draft')

    await user.click(screen.getByRole('button', { name: '+ Add Cycle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Review Cycle' })
    await user.click(within(dialog).getByRole('button', { name: 'Add Cycle' }))
    expect(await within(dialog).findByText('Enter the cycle name')).toBeVisible()
    expect(within(dialog).getByText('Choose the appraisal form')).toBeVisible()
    expect(within(dialog).getByText('Choose the start date')).toBeVisible()
    expect(within(dialog).getByText('Choose the end date')).toBeVisible()

    await user.type(
      within(dialog).getByRole('textbox', { name: /^Name/ }),
      `Annual Review ${String(YEAR - 1)}`,
    )
    await choose(user, dialog, 'Appraisal Form', /^Annual Performance Review/)
    expect(within(dialog).getByText('Five-Point Scale')).toBeVisible()
    expect(within(dialog).getByText('40% of the final score')).toBeVisible()
    await pickDate(user, dialog, 'Start Date', new Date())
    await pickDate(user, dialog, 'End Date', addDays(new Date(), 45))
    await user.click(within(dialog).getByRole('button', { name: 'Add Cycle' }))
    expect(
      await within(dialog).findByText('A review cycle with this name already exists.'),
    ).toBeVisible()

    const name = within(dialog).getByRole('textbox', { name: /^Name/ })
    await user.clear(name)
    await user.type(name, 'Mid-Year Review')
    await user.click(within(dialog).getByRole('button', { name: 'Add Cycle' }))
    expect(await screen.findByText('Review cycle added')).toBeVisible()
    const created = cycles.all().find((cycle) => cycle.name === 'Mid-Year Review')
    expect(created).toMatchObject({ status: 'draft', appraisalFormId: 'pf_annual' })
    expect((await within(table).findByText('Mid-Year Review')).closest('tr')).toHaveTextContent(
      'Draft',
    )

    // Its detail: Launch waits for people (and says so), Add Participants asks for someone,
    // then two are added and it launches.
    await rowAction(user, 'Actions for Mid-Year Review', 'Participants')
    const detail = await screen.findByRole('dialog', { name: 'Mid-Year Review' })
    expect(
      await within(detail).findByText('Nobody is in this cycle yet. Add Participants above.'),
    ).toBeVisible()
    expect(within(detail).getByRole('button', { name: 'Launch' })).toBeDisabled()
    expect(within(detail).getByRole('button', { name: 'Launch' })).toHaveAccessibleDescription(
      'Add participants before launching.',
    )
    await user.click(within(detail).getByRole('button', { name: 'Add Participants' }))
    expect(await within(detail).findByText('Choose employees or a department to add')).toBeVisible()

    await user.click(within(detail).getByRole('combobox', { name: 'Employees' }))
    await user.click(await screen.findByRole('option', { name: /^Sadia Rehman/ }))
    await user.click(await screen.findByRole('option', { name: /^Kaleem Murtaza/ }))
    await user.keyboard('{Escape}')
    await user.click(within(detail).getByRole('button', { name: 'Add Participants' }))
    expect(await screen.findByText('2 participants added')).toBeVisible()
    const people = within(detail).getByRole('table', { name: 'Participants' })
    expect(await within(people).findByText('Sadia Rehman')).toBeVisible()
    expect(within(people).getByText('Kaleem Murtaza').closest('tr')).toHaveTextContent(
      'Not Launched',
    )

    await user.click(within(detail).getByRole('button', { name: 'Launch' }))
    await confirm(user, 'Launch')
    expect(await screen.findByText('Mid-Year Review launched')).toBeVisible()
    await waitFor(() => {
      expect(within(people).getByText('Sadia Rehman').closest('tr')).toHaveTextContent(
        'Self Review',
      )
    })
    expect(
      appraisals
        .all()
        .filter((item) => item.cycleId === created?.id)
        .map((item) => item.status),
    ).toEqual(['self_review', 'self_review'])
    // Just launched, both wait for their self review (not "done").
    const stages = within(detail).getByRole('list', { name: 'Appraisals by stage' })
    expect(within(stages).getByText('Waiting for self review')).toBeVisible()

    // Close: the open appraisals are named, then everything locks.
    await user.click(within(detail).getByRole('button', { name: 'Close Cycle' }))
    const alert = await screen.findByRole('alertdialog')
    expect(alert).toHaveTextContent('2 of 2 appraisals are not finalised')
    await user.click(within(alert).getByRole('button', { name: 'Close Cycle' }))
    expect(await screen.findByText('Mid-Year Review closed')).toBeVisible()
    await waitFor(() => {
      expect(within(detail).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    })
    expect(within(detail).queryByRole('combobox', { name: 'Employees' })).not.toBeInTheDocument()
    expect(cycles.all().find((cycle) => cycle.id === created?.id)?.status).toBe('closed')
    // The appraisals left unfinished read as closed, not as the stage they stopped at.
    await waitFor(() => {
      expect(within(people).getByText('Sadia Rehman').closest('tr')).toHaveTextContent(
        'Closed, not finalised',
      )
    })
  })
})
