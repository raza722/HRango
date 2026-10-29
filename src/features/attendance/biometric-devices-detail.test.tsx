import { configure, screen, waitFor, within } from '@testing-library/react'
import { format, subDays } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { attendancePunches } from '@/mocks/attendance/db'
import { deviceEnrolments } from '@/mocks/devices/db'
import { server } from '@/mocks/node'
import { apiPath } from '@/mocks/utils'
import { renderApp } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

const PATH = '/settings/biometric-devices'

/** Machine 5 is the Islamabad branch's check-in machine. */
const userNoOf = (employeeId: string, deviceId = 'MCH-00005') =>
  deviceEnrolments.all().find((row) => row.deviceId === deviceId && row.employeeId === employeeId)
    ?.deviceUserNo ?? ''

describe('Settings → Biometric Devices: a device', { timeout: 60_000 }, () => {
  it('shows the facts and saves the enrolments: add, renumber, remove, unique numbers', async () => {
    const omarNo = userNoOf('em_omar')
    const { user, router } = renderApp(`${PATH}?device=MCH-00005`)
    expect(
      await screen.findByRole('heading', { name: 'Machine 5', level: 1 }, { timeout: 15_000 }),
    ).toBeVisible()
    expect(screen.getByText('10.20.1.201:4370')).toBeVisible()
    expect(screen.getByText('6 people')).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Enrolments (6)' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const table = await screen.findByRole('table', { name: 'People enrolled on Machine 5' })
    expect(
      within(table).getByRole('textbox', { name: 'Device user no of Omar Siddiqui' }),
    ).toHaveValue(omarNo)

    // Add Sara (from Karachi): she gets the next free number.
    await user.click(screen.getByRole('combobox', { name: 'Add people' }))
    await user.click(await screen.findByRole('option', { name: /^Sara Khan/ }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Add 1 person' }))
    const sara = await within(table).findByRole('textbox', { name: 'Device user no of Sara Khan' })
    expect(within(table).getByText('New, not saved')).toBeVisible()
    expect(screen.getByText(/unsaved: 1 added/)).toBeVisible()

    // Numbers are digits and unique on the device.
    await user.clear(sara)
    await user.type(sara, omarNo)
    await user.click(screen.getByRole('button', { name: 'Save Enrolments' }))
    expect(await within(table).findByText(`${omarNo} is also Omar Siddiqui's number`)).toBeVisible()
    expect(within(table).getByText(`${omarNo} is also Sara Khan's number`)).toBeVisible()
    expect(screen.getByText('2 rows need attention before saving.')).toBeVisible()
    await user.clear(sara)
    await user.type(sara, '20O1')
    await user.click(screen.getByRole('button', { name: 'Save Enrolments' }))
    expect(await within(table).findByText('Use digits only')).toBeVisible()
    await user.clear(sara)
    await user.type(sara, '2001')

    await user.click(within(table).getByRole('button', { name: 'Remove Kashif Raza' }))
    expect(screen.getByText(/unsaved: 1 added, 1 removed/)).toBeVisible()

    // Leaving (the list, or the other tab) asks first.
    await user.click(screen.getByRole('button', { name: 'Back to the devices' }))
    const guard = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    await user.click(within(guard).getByRole('button', { name: 'Keep editing' }))
    expect(router.state.location.search).toEqual({ device: 'MCH-00005' })
    await user.click(screen.getByRole('tab', { name: 'Import Punches' }))
    await user.click(
      within(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).getByRole(
        'button',
        { name: 'Keep editing' },
      ),
    )
    expect(screen.getByRole('tab', { name: 'Enrolments (6)' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // The API's field errors land on their rows.
    server.use(
      http.put(
        apiPath('/attendance/settings/devices/:id/enrolments'),
        () =>
          HttpResponse.json(
            {
              message: 'Some enrolments need your attention.',
              fieldErrors: { 'enrolments.0.deviceUserNo': 'The device refused this number' },
            },
            { status: 422 },
          ),
        { once: true },
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Save Enrolments' }))
    expect(await within(table).findByText('The device refused this number')).toBeVisible()
    expect(sara).toHaveAttribute('aria-invalid', 'true')

    await user.click(screen.getByRole('button', { name: 'Save Enrolments' }))
    expect(await screen.findByText('Enrolments saved: 6 people on Machine 5')).toBeInTheDocument()
    expect(userNoOf('em_sara')).toBe('2001')
    expect(userNoOf('em_kashif')).toBe('')
    expect(await screen.findByRole('tab', { name: 'Enrolments (6)' })).toBeVisible()

    // Saved: leaving no longer asks.
    await user.click(screen.getByRole('button', { name: 'Back to the devices' }))
    await waitFor(() => {
      expect(router.state.location.search).toEqual({})
    })
  })

  it('previews punch lines, imports them and lists each failed line; they reach Attendance Logs', async () => {
    const omarNo = userNoOf('em_omar')
    const date = format(subDays(new Date(), 3), 'yyyy-MM-dd')
    const createObjectURL = vi.fn(() => 'blob:sample')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { user, router } = renderApp(`${PATH}?device=MCH-00005&tab=import`)

    const panel = await screen.findByRole(
      'tabpanel',
      { name: 'Import Punches' },
      { timeout: 15_000 },
    )
    await user.click(within(panel).getByRole('button', { name: 'Download a sample file' }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'MCH-00005-punches-sample.csv',
    )
    click.mockRestore()

    const input = panel.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('No file input')
    await user.upload(
      input,
      new File(
        [
          [
            'Device User No,Punched At,Punch Type',
            `${omarNo},${date} 06:01:10,check_in`,
            `${omarNo},${date} 06:01:40,Check In`,
            `9999,${date} 07:00,check_in`,
            `${omarNo},2026-02-30 09:00,check_out`,
            `,${date} 08:00,check_in`,
          ].join('\n'),
        ],
        'machine-5.csv',
        { type: 'text/csv' },
      ),
    )
    expect(await within(panel).findByText('machine-5.csv: 5 lines read')).toBeVisible()
    expect(
      within(panel).getByText('5 lines read, 2 ready, 2 likely to fail, 1 not sent'),
    ).toBeVisible()
    const preview = within(panel).getByRole('table', { name: 'Punch lines of machine-5.csv' })
    expect(
      within(preview).getByText('Will likely fail: No one on this device has this user no'),
    ).toBeVisible()
    expect(within(preview).getByText('Not sent: The device user no is missing')).toBeVisible()
    expect(within(preview).getAllByText('Omar Siddiqui')).toHaveLength(3)

    const buttons = within(panel)
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(buttons.indexOf('Cancel')).toBeLessThan(buttons.indexOf('Import 4 lines'))
    await user.click(within(panel).getByRole('button', { name: 'Import 4 lines' }))

    expect(await screen.findByText('Imported 1 punch, 1 skipped, 2 failed')).toBeInTheDocument()
    const result = within(panel).getByRole('region', { name: 'Import result' })
    expect(within(result).getByText('Created').nextElementSibling).toHaveTextContent('1')
    expect(within(result).getByText('Skipped').nextElementSibling).toHaveTextContent('1')
    expect(within(result).getByText('Failed').nextElementSibling).toHaveTextContent('2')
    expect(
      within(result).getByText('Line 4: No one on this device has user no 9999.'),
    ).toBeVisible()
    expect(
      within(result).getByText(
        'Line 5: "2026-02-30 09:00" is not a date and time (yyyy-mm-dd hh:mm).',
      ),
    ).toBeVisible()
    expect(within(result).getByText('Line 6: The device user no is missing')).toBeVisible()
    expect(
      attendancePunches
        .all()
        .filter(
          (punch) =>
            punch.employeeId === 'em_omar' &&
            punch.at === `${date}T06:01` &&
            punch.source === 'machine' &&
            punch.machineId === 'MCH-00005',
        ),
    ).toHaveLength(1)

    // The punch is a machine punch in Attendance Logs, and its machine opens the device.
    await user.click(within(result).getByRole('link', { name: 'Open Attendance Logs' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/attendance/logs')
    })
    expect(router.state.location.search).toMatchObject({ from: date, to: date })
    await router.navigate({
      to: '/attendance/logs',
      search: { from: date, to: date, employeeId: 'em_omar' },
    })
    const action = await screen.findByRole(
      'button',
      { name: 'Actions for Omar Siddiqui, Check In 6:01 AM' },
      { timeout: 15_000 },
    )
    const row = action.closest('tr')
    if (!row) throw new Error('No row for the imported punch')
    expect(within(row).getByText('Import from Machine')).toBeVisible()
    const machine = within(row).getByRole('link', { name: 'Machine 5 (MCH-00005)' })
    expect(machine).toHaveAttribute('href', '/settings/biometric-devices?device=MCH-00005')
    await user.click(machine)
    expect(
      await screen.findByRole('heading', { name: 'Machine 5', level: 1 }, { timeout: 15_000 }),
    ).toBeVisible()
  })

  it('previews pasted lines too', async () => {
    const omarNo = userNoOf('em_omar')
    const { user } = renderApp(`${PATH}?device=MCH-00005&tab=import`)
    const panel = await screen.findByRole(
      'tabpanel',
      { name: 'Import Punches' },
      { timeout: 15_000 },
    )
    await user.click(within(panel).getByRole('button', { name: 'Paste lines' }))
    const box = within(panel).getByRole('textbox', { name: 'Punch lines' })
    await user.click(box)
    await user.paste(`${omarNo}\t2026-10-01 09:00\tin\n${omarNo}\t2026-10-01 18:00\t1`)
    await user.click(within(panel).getByRole('button', { name: 'Preview' }))
    expect(await within(panel).findByText('2 lines read, 2 ready')).toBeVisible()
    const preview = within(panel).getByRole('table', { name: 'Punch lines of Pasted lines' })
    expect(within(preview).getByText('Check In')).toBeVisible()
    expect(within(preview).getByText('Check Out')).toBeVisible()
    expect(within(panel).getByRole('button', { name: 'Import 2 lines' })).toBeEnabled()
  })

  it('says when a device is not there, with a way back', async () => {
    const { user, router } = renderApp(`${PATH}?device=MCH-09999`)
    expect(
      await screen.findByRole('heading', { name: 'Device not found' }, { timeout: 15_000 }),
    ).toBeVisible()
    await user.click(screen.getAllByRole('button', { name: 'Back to the devices' })[0]!)
    await waitFor(() => {
      expect(router.state.location.search).toEqual({})
    })
    expect(await screen.findByRole('table', { name: 'Biometric devices' })).toBeVisible()
  })
})
