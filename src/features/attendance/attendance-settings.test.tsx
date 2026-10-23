import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { differenceInCalendarMonths, format, isWeekend, parse, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { holidayFor } from '@/mocks/attendance/audience'
import { attendancePunches } from '@/mocks/attendance/db'
import { breakTypes, holidays, machineSync, settingsStore } from '@/mocks/attendance/settings-db'
import { findEmployee } from '@/mocks/employees/seed'
import { profileOf, seedRestDayBatches } from '@/mocks/scheduling/seed'
import { renderApp } from '@/test/test-utils'

import { formatSheetDate } from './utils/local-time'

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

/** The last Monday–Friday before today that is nobody's holiday or seeded rest day. */
function workingDay(): string {
  let day = subDays(new Date(), 1)
  const off = (date: string) =>
    holidays.all().some((holiday) => holiday.startDate <= date && date <= holiday.endDate) ||
    seedRestDayBatches().some((batch) => batch.dates.includes(date))
  while (isWeekend(day) || off(format(day, 'yyyy-MM-dd'))) day = subDays(day, 1)
  return format(day, 'yyyy-MM-dd')
}

describe('Attendance Settings', () => {
  it('turns off dashboard punching, which disables Clock In', async () => {
    const { user, router } = renderApp('/attendance/settings')

    expect(await screen.findByRole('tab', { name: 'Basic' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      within(screen.getByRole('navigation', { name: 'Attendance' })).getByRole('link', {
        name: 'Settings',
      }),
    ).toHaveAttribute('aria-current', 'page')
    const toggle = await screen.findByRole('switch', {
      name: 'Employee can mark punch from their dashboard',
    })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Settings saved')).toBeInTheDocument()
    expect(settingsStore.all()[0]?.basic.dashboardPunch).toBe(false)

    await router.navigate({ to: '/attendance/time-sheet' })
    expect(await screen.findByText(/Punching from the dashboard is turned off/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Clock In' })).toBeDisabled()
  })

  it('creates a break type, and refuses a second one with the same name', async () => {
    const { user } = renderApp('/attendance/settings?tab=break-types')

    expect(await screen.findByRole('cell', { name: 'Lunch Break' })).toBeVisible()
    const create = async (name: string) => {
      await user.click(screen.getByRole('button', { name: '+ Create' }))
      const dialog = await screen.findByRole('dialog', { name: 'Create New Break Type' })
      await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), name)
      await user.type(within(dialog).getByRole('textbox', { name: /^Start Indicator/ }), 'NB-IN')
      await user.type(within(dialog).getByRole('textbox', { name: /^End Indicator/ }), 'NB-OUT')
      await user.click(within(dialog).getByRole('button', { name: 'Create' }))
      return dialog
    }

    await create('Namaz Break')
    expect(await screen.findByText('Break type created')).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'Namaz Break' })).toBeVisible()
    expect(breakTypes.all().filter((item) => item.name === 'Namaz Break')).toHaveLength(1)

    const again = await create('namaz break')
    expect(await within(again).findByText(/already/i)).toBeVisible()
    expect(breakTypes.all().filter((item) => /namaz break/i.test(item.name))).toHaveLength(1)
  })

  it('gives a holiday with a religion rule only to the people it names', async () => {
    const date = workingDay()
    const label = formatSheetDate(date)
    const { user, router } = renderApp('/attendance/settings?tab=holidays')

    expect(await screen.findByRole('cell', { name: 'Pakistan Day' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Holiday' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Staff Christmas Party')
    await pickDate(user, 'Start Date', date)
    expect(within(dialog).getByRole('checkbox', { name: 'Attendance Exempt' })).toBeChecked()

    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    const ruleDialog = await screen.findByRole('dialog', { name: 'Holiday Rule Create' })
    await user.type(within(ruleDialog).getByRole('textbox', { name: /^Name/ }), 'Christian staff')
    await choose(user, /^Religion/, 'Christianity')
    await user.click(within(ruleDialog).getByRole('button', { name: 'Create' }))
    expect(await within(dialog).findByRole('cell', { name: 'Christian staff' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('Holiday created')).toBeInTheDocument()

    // Maryam is Christian: her day becomes a holiday. Omar's stays a working day.
    expect(holidayFor(holidays.all(), 'em_maryam', date)?.name).toBe('Staff Christmas Party')
    expect(holidayFor(holidays.all(), 'em_omar', date)).toBeNull()
    await router.navigate({
      to: '/attendance/time-sheet',
      search: { scope: 'all', employeeId: 'em_maryam', from: date, to: date },
    })
    const maryam = await screen.findByRole('row', { name: new RegExp(label) })
    expect(await within(maryam).findByText('Holiday')).toBeVisible()
  })
})

describe('Attendance Logs', () => {
  it('creates a manual punch, then deletes it', async () => {
    const date = workingDay()
    const { user, router } = renderApp(`/attendance/logs?from=${date}&to=${date}`)

    expect(await screen.findByRole('heading', { name: 'Attendance Logs', level: 1 })).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: 'Attendance' })).getByRole('link', {
        name: 'Attendance Logs',
      }),
    ).toHaveAttribute('aria-current', 'page')
    expect((await screen.findAllByText(/^Machine$/)).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Attendance Log' })
    await choose(user, /^Employee Name/, /Omar Siddiqui/)
    await choose(user, /^Punch Type/, 'Check Out')
    fireEvent.change(within(dialog).getByLabelText(/^Punch Time/), { target: { value: '21:15' } })
    await pickDate(user, /^Punch Date/, date)
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Late audit')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Attendance log created')).toBeInTheDocument()
    // The list is newest first, ten to a page: on some dates the seeded punches push a 9:15 PM
    // check-out to page 2, so look for it among Omar's punches only.
    await router.navigate({
      to: '/attendance/logs',
      search: { from: date, to: date, employeeId: 'em_omar' },
    })
    const actions = await screen.findByRole('button', {
      name: 'Actions for Omar Siddiqui, Check Out 9:15 PM',
    })
    expect(
      attendancePunches
        .all()
        .some((punch) => punch.at === `${date}T21:15` && punch.source === 'manual'),
    ).toBe(true)

    await user.click(actions)
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect(await screen.findByText('Attendance log deleted')).toBeInTheDocument()
    await waitFor(() => {
      expect(attendancePunches.all().some((punch) => punch.at === `${date}T21:15`)).toBe(false)
    })
  })

  it('reads the machines, which records when each was last read', async () => {
    const { user } = renderApp('/attendance/logs')

    await user.click(await screen.findByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import Attendance Log' })
    await user.click(within(dialog).getByRole('switch', { name: 'Import from the machines' }))
    await user.click(await within(dialog).findByRole('checkbox', { name: /MCH-00001\)/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Import' }))

    const results = await within(dialog).findByRole('list', { name: 'Import results' })
    expect(within(results).getByText('Machine (MCH-00001)')).toBeVisible()
    expect(await screen.findByText(/^Imported \d+ punch(es)? from 1 machine$/)).toBeInTheDocument()
    const synced = machineSync.find('MCH-00001')
    expect(synced?.lastSyncedAt.slice(0, 10)).toBe(format(new Date(), 'yyyy-MM-dd'))
  })

  it('imports punches from a CSV file and explains the bad lines', async () => {
    const date = workingDay()
    const employee = findEmployee('em_omar')
    if (!employee) throw new Error('No em_omar in the seed')
    const code = profileOf(employee).code
    const { user } = renderApp('/attendance/logs')

    await user.click(await screen.findByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import Attendance Log' })
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('No file input')

    await user.upload(
      input,
      new File([`Employee Code,Date,Time,Punch Type\nNOPE-1,${date},08:00,check-in\n`], 'bad.csv', {
        type: 'text/csv',
      }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Import' }))
    expect(await within(dialog).findByText(/Line 2: no employee with code NOPE-1/)).toBeVisible()

    await user.upload(
      input,
      new File(
        [
          `Employee Code,Date,Time,Punch Type\n${code},${date},06:05,check-in\n${code},${date},noon,check-out\n`,
        ],
        'logs.csv',
        { type: 'text/csv' },
      ),
    )
    expect(await within(dialog).findByText('logs.csv: 1 line ready')).toBeVisible()
    expect(within(dialog).getByText('Line 3: the time must be HH:mm')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Import' }))

    expect(await screen.findByText('Imported 1 punch')).toBeInTheDocument()
    expect(
      attendancePunches
        .all()
        .some((punch) => punch.at === `${date}T06:05` && punch.source === 'import'),
    ).toBe(true)
  })
})
