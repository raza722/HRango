import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { differenceInCalendarMonths, format, isWeekend, parse, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { holidayFor } from '@/mocks/attendance/audience'
import {
  breakTypes,
  holidays,
  ipRestrictions,
  restDayRules,
  settingsStore,
} from '@/mocks/attendance/settings-db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date button's calendar and picks the day, moving months if needed. */
async function pickDate(user: UserEvent, label: string | RegExp, date: string) {
  const day = parse(date, 'yyyy-MM-dd', new Date())
  await user.click(screen.getByRole('button', { name: label }))
  const months = differenceInCalendarMonths(day, new Date())
  for (let step = 0; step < Math.abs(months); step += 1) {
    await user.click(
      screen.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }),
    )
  }
  await user.click(screen.getByRole('button', { name: new RegExp(format(day, 'MMMM do, yyyy')) }))
}

/** The last Monday–Friday before today that is nobody's holiday. */
function workingDay(): string {
  let day = subDays(new Date(), 1)
  const off = (date: string) =>
    holidays.all().some((holiday) => holiday.startDate <= date && date <= holiday.endDate)
  while (isWeekend(day) || off(format(day, 'yyyy-MM-dd'))) day = subDays(day, 1)
  return format(day, 'yyyy-MM-dd')
}

describe('Attendance Settings', () => {
  it('saves the basic switches and the late grace with the rowVersion it read', async () => {
    const { user } = renderApp('/attendance/settings')

    expect(await screen.findByRole('tab', { name: 'Basic' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      within(screen.getByRole('navigation', { name: 'Attendance' })).getByRole('link', {
        name: 'Settings',
      }),
    ).toHaveAttribute('aria-current', 'page')
    const before = settingsStore.all()[0]?.basic.rowVersion
    const toggle = await screen.findByRole('switch', {
      name: 'Employee can mark punch from their dashboard',
    })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    const grace = screen.getByRole('textbox', { name: 'Late Grace Minutes' })
    await user.clear(grace)
    await user.type(grace, '10')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Settings saved')).toBeInTheDocument()
    const saved = settingsStore.all()[0]?.basic
    expect(saved?.dashboardPunch).toBe(false)
    expect(saved?.lateGraceMinutes).toBe(10)
    expect(saved?.rowVersion).not.toBe(before)
  })

  it('creates a break type, and refuses a second one with the same name', async () => {
    const { user } = renderApp('/attendance/settings?tab=break-types')

    expect(await screen.findByRole('cell', { name: 'Lunch Break' })).toBeVisible()
    const create = async (name: string, start: string, end: string) => {
      await user.click(screen.getByRole('button', { name: '+ Create' }))
      const dialog = await screen.findByRole('dialog', { name: 'Create New Break Type' })
      await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), name)
      await user.type(within(dialog).getByRole('textbox', { name: /^Start Identifier/ }), start)
      await user.type(within(dialog).getByRole('textbox', { name: /^End Identifier/ }), end)
      await user.click(within(dialog).getByRole('button', { name: 'Create' }))
      return dialog
    }

    await create('Namaz Break', 'NB-OUT', 'NB-IN')
    expect(await screen.findByText('Break type created')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Namaz Break' })).toBeVisible()
    expect(breakTypes.all().filter((item) => item.name === 'Namaz Break')).toHaveLength(1)

    const again = await create('namaz break', 'NB2-OUT', 'NB2-IN')
    expect(await within(again).findByText(/already exists/i)).toBeVisible()
    expect(breakTypes.all().filter((item) => /namaz break/i.test(item.name))).toHaveLength(1)
  })

  it('creates an IP range for one religion, then deactivates it', async () => {
    const { user } = renderApp('/attendance/settings?tab=ip-restrictions')

    expect(await screen.findByRole('cell', { name: 'IPR-00001' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create IP Restriction' })
    await user.click(within(dialog).getByRole('switch', { name: 'Use an address range' }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Range Start/ }), '10.1.1.1')
    await user.type(within(dialog).getByRole('textbox', { name: /^Range End/ }), '10.1.1.20')
    await user.click(within(dialog).getByRole('checkbox', { name: 'All Employees' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await within(dialog).findByText(/Choose who it applies to/)).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Religion' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Christianity' }))
    await user.keyboard('{Escape}')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('IP restriction created')).toBeInTheDocument()

    const created = ipRestrictions.all().find((item) => item.rangeStart === '10.1.1.1')
    expect(created?.addressCount).toBe(20)
    expect(created?.targets).toEqual([
      { targetType: 'religion', targetId: null, targetValue: 'Christianity' },
    ])

    await user.click(
      await screen.findByRole('button', { name: `Actions for ${created?.code ?? ''}` }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Deactivate' }))
    expect(await screen.findByText('IP restriction deactivated')).toBeInTheDocument()
    expect(ipRestrictions.find(created?.id ?? '')?.isActive).toBe(false)
  })

  it('gives a holiday with a religion rule only to the people it names', async () => {
    const date = workingDay()
    const { user } = renderApp('/attendance/settings?tab=holidays')

    expect(await screen.findByRole('cell', { name: 'Pakistan Day' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Holiday' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Staff Christmas Party')
    await pickDate(user, 'Start Date', date)
    expect(within(dialog).getByRole('checkbox', { name: 'Attendance Exempt' })).toBeChecked()

    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    const ruleDialog = await screen.findByRole('dialog', { name: 'Holiday Rule Create' })
    await choose(user, /^Religion/, 'Christianity')
    await user.click(within(ruleDialog).getByRole('button', { name: 'Create' }))
    expect(await within(dialog).findByRole('cell', { name: 'Christianity' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('Holiday created')).toBeInTheDocument()

    const saved = holidays.all().find((item) => item.name === 'Staff Christmas Party')
    expect(saved?.holidayType).toBe('public')
    expect(saved?.rules.map((rule) => [rule.ruleType, rule.religion])).toEqual([
      ['religion', 'Christianity'],
    ])
    // Maryam is Christian: her day becomes a holiday. Omar's stays a working day.
    expect(holidayFor(holidays.all(), 'em_maryam', date)?.name).toBe('Staff Christmas Party')
    expect(holidayFor(holidays.all(), 'em_omar', date)).toBeNull()
  })

  it('shows a rest-day rule with its people', async () => {
    const { user } = renderApp('/attendance/settings?tab=rest-days')

    const row = await screen.findByRole('row', { name: /2 employees/ })
    await user.click(within(row).getByRole('button', { name: /^Actions for rest days/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'View' }))
    const view = await screen.findByRole('dialog', { name: 'Rest Day View' })
    expect(await within(view).findByText('Rabia Anwar')).toBeVisible()
    expect(within(view).getByText('Yes')).toBeVisible()
    expect(restDayRules.all()).toHaveLength(1)
  })

  it('marks every missing holiday field under it, and clears each as it is filled', async () => {
    const { user } = renderApp('/attendance/settings?tab=holidays')

    await user.click(await screen.findByRole('button', { name: '+ Create' }, { timeout: 15_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Holiday' })
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    // All at once, each under its field.
    expect(await within(dialog).findByText('Enter the holiday name')).toBeVisible()
    expect(within(dialog).getByText('Choose the start date')).toBeVisible()
    expect(within(dialog).getByText('Choose the end date')).toBeVisible()
    const name = within(dialog).getByRole('textbox', { name: /^Name/ })
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Enter the holiday name')

    // Typing a name clears its message only; a start date fills the end date too.
    await user.type(name, 'Founders Day')
    expect(within(dialog).queryByText('Enter the holiday name')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Choose the start date')).toBeVisible()
    await pickDate(user, 'Start Date', workingDay())
    expect(within(dialog).queryByText('Choose the start date')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Choose the end date')).not.toBeInTheDocument()

    // The rule dialog marks its missing field the same way.
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    const ruleDialog = await screen.findByRole('dialog', { name: 'Holiday Rule Create' })
    await user.click(within(ruleDialog).getByRole('button', { name: 'Create' }))
    expect(await within(ruleDialog).findByText('Choose a religion')).toBeVisible()
    await choose(user, /^Religion/, 'Christianity')
    expect(within(ruleDialog).queryByText('Choose a religion')).not.toBeInTheDocument()
  })

  it('marks the rest day form’s missing fields under them', async () => {
    const { user } = renderApp('/attendance/settings?tab=rest-days')

    await user.click(await screen.findByRole('button', { name: '+ Create' }, { timeout: 15_000 }))
    const dialog = await screen.findByRole('dialog', { name: 'Create New Rest Day' })
    // Saturday and Sunday are picked to start with: unpick them.
    await user.click(within(dialog).getByRole('button', { name: 'sat' }))
    await user.click(within(dialog).getByRole('button', { name: 'sun' }))
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await within(dialog).findByText('Select at least one employee')).toBeVisible()
    expect(within(dialog).getByText('Pick at least one day')).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'mon' }))
    expect(within(dialog).queryByText('Pick at least one day')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Select at least one employee')).toBeVisible()
  })
})
