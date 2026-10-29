import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { differenceInCalendarMonths, format, isWeekend, parse, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { attendanceIgnored, attendancePunches } from '@/mocks/attendance/db'
import { holidays } from '@/mocks/attendance/settings-db'
import { findEmployee } from '@/mocks/employees/seed'
import { profileOf } from '@/mocks/scheduling/seed'
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
    // The machine's name, then its code once: "Machine 1" over "(MCH-00001)".
    expect((await screen.findAllByText(/^Machine \d+$/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^\(MCH-\d{5}\)$/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/MCH-\d+.*MCH-/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Attendance Log' })
    await choose(user, /^Employee Name/, /Omar Siddiqui/)
    await choose(user, /^Punch Type/, 'Check Out')
    fireEvent.change(within(dialog).getByLabelText(/^Punch Time/), { target: { value: '21:15' } })
    await pickDate(user, /^Punch Date/, date)
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Late audit')
    await user.click(within(dialog).getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Attendance log created')).toBeInTheDocument()
    // The list is newest first, ten to a page: look for it among Omar's punches only.
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
        .some(
          (punch) =>
            punch.at === `${date}T21:15` &&
            punch.source === 'manual' &&
            punch.description === 'Late audit',
        ),
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

  it('ignores a machine punch, which cannot be edited', async () => {
    const date = workingDay()
    const { user } = renderApp(`/attendance/logs?from=${date}&to=${date}&source=biometric`)

    const [first] = await screen.findAllByRole('button', { name: /^Actions for / })
    if (!first) throw new Error('No machine punches on the working day')
    await user.click(first)
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('menuitem', { name: 'Ignore' }))
    expect(await screen.findByText('Punch ignored')).toBeInTheDocument()
    expect(await screen.findByText('Ignored')).toBeVisible()
    expect(attendanceIgnored.all()).toHaveLength(1)
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
    expect(await within(dialog).findByText(/Line 2: No employee with code NOPE-1/)).toBeVisible()

    await user.upload(
      input,
      new File(
        [
          `Employee Code,Date,Time,Punch Type\n${code},${date},06:05,check_in\n${code},${date},noon,check-out\n`,
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
