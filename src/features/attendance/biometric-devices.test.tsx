import { configure, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { deviceEnrolments, devices } from '@/mocks/devices/db'
import { server } from '@/mocks/node'
import { apiPath } from '@/mocks/utils'
import { renderApp, setViewportWidth } from '@/test/test-utils'

configure({ asyncUtilTimeout: 4000 })

const PATH = '/settings/biometric-devices'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function devicesTable() {
  return screen.findByRole('table', { name: 'Biometric devices' }, { timeout: 15_000 })
}

describe('Settings → Biometric Devices: list, form and delete', { timeout: 60_000 }, () => {
  it('lists the machines Attendance punches on, and filters by search, branch and status', async () => {
    const { user, router } = renderApp(PATH)
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Biometric Devices', level: 1 },
        { timeout: 15_000 },
      ),
    ).toBeVisible()
    const table = await devicesTable()
    for (const header of [
      'Code',
      'Name',
      'Model',
      'Serial No',
      'IP:Port',
      'Branch',
      'Status',
      'Last Synced',
      'Enrolled',
    ]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeVisible()
    }
    expect(await within(table).findByRole('button', { name: 'Machine 1' })).toBeVisible()
    expect(within(table).getByText('MCH-00001')).toBeVisible()
    expect(within(table).getByText('192.168.10.201:4370')).toBeVisible()
    expect(screen.getByText('Showing 1 to 10 of 13 devices')).toBeVisible()

    // The spare: inactive, not heard from for 12 days.
    await choose(user, 'Status', 'Inactive')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ status: 'inactive' })
    })
    expect(await within(table).findByRole('button', { name: 'Machine 13' })).toBeVisible()
    await waitFor(() => {
      expect(within(table).queryByRole('button', { name: 'Machine 1' })).not.toBeInTheDocument()
    })
    expect(within(table).getByText('Not synced for 12 days')).toBeVisible()
    expect(screen.getByText('Showing 1 to 1 of 1 device')).toBeVisible()

    await choose(user, 'Status', 'Active and inactive')
    await choose(user, 'Branch', 'Dubai Regional Office')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ branchId: 'br_dxb' })
    })
    expect(await within(table).findByRole('button', { name: 'Machine 11' })).toBeVisible()
    expect(within(table).getByRole('button', { name: 'Machine 12' })).toBeVisible()
    expect(screen.getByText('Showing 1 to 2 of 2 devices')).toBeVisible()

    await choose(user, 'Branch', 'All branches')
    await user.type(screen.getByRole('searchbox', { name: 'Search devices' }), '10.20.1.202')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: '10.20.1.202' })
    })
    expect(await within(table).findByRole('button', { name: 'Machine 6' })).toBeVisible()
    expect(await screen.findByText('Showing 1 to 1 of 1 device')).toBeVisible()

    await user.clear(screen.getByRole('searchbox', { name: 'Search devices' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search devices' }), 'nothing like it')
    expect(await within(table).findByText('No devices match these filters.')).toBeVisible()
  })

  it('adds a device after checking the IP, the port and that the serial no is unique', async () => {
    const { user, router } = renderApp(PATH)
    await devicesTable()
    await user.click(screen.getByRole('button', { name: '+ Create' }))
    const form = await screen.findByRole('dialog', { name: 'Add Biometric Device' })
    expect(router.state.location.search).toEqual({ edit: 'new' })

    await user.click(within(form).getByRole('button', { name: 'Add Device' }))
    expect(await within(form).findByText('Enter the device name')).toBeVisible()

    await user.type(within(form).getByRole('textbox', { name: /^Name/ }), 'Warehouse gate')
    await user.type(within(form).getByRole('textbox', { name: 'IP Address' }), '192.168.10.300')
    const port = within(form).getByRole('textbox', { name: 'Port' })
    expect(port).toHaveValue('4370')
    await user.clear(port)
    await user.type(port, '70000')
    await user.click(within(form).getByRole('button', { name: 'Add Device' }))
    expect(
      await within(form).findByText('Enter an IPv4 address such as 192.168.1.201'),
    ).toBeVisible()
    expect(within(form).getByText('Enter a port from 1 to 65535')).toBeVisible()

    const taken = devices.find('MCH-00001')?.serialNo ?? ''
    await user.clear(within(form).getByRole('textbox', { name: 'IP Address' }))
    await user.type(within(form).getByRole('textbox', { name: 'IP Address' }), '192.168.10.210')
    await user.clear(port)
    await user.type(port, '4370')
    await user.type(within(form).getByRole('textbox', { name: /^Serial No/ }), taken)
    await choose(user, 'Branch', 'Lahore Head Office')
    await user.click(within(form).getByRole('button', { name: 'Add Device' }))
    // The API's 422 lands on the field.
    expect(await within(form).findByText('Machine 1 (MCH-00001) has this serial no')).toBeVisible()

    await user.clear(within(form).getByRole('textbox', { name: /^Serial No/ }))
    await user.type(within(form).getByRole('textbox', { name: /^Serial No/ }), 'ZK-WH-0001')
    await user.click(within(form).getByRole('button', { name: 'Add Device' }))

    expect(await screen.findByText('Warehouse gate (MCH-00014) added')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Warehouse gate', level: 1 })).toBeVisible()
    expect(router.state.location.search).toEqual({ device: 'MCH-00014' })
    expect(devices.find('MCH-00014')).toMatchObject({
      name: 'Warehouse gate',
      serialNo: 'ZK-WH-0001',
      ipAddress: '192.168.10.210',
      port: 4370,
      branchId: 'br_lhr_ho',
      status: 'active',
    })
    expect(screen.getByText('Never synced')).toBeVisible()
  })

  it('edits a device with its rowVersion; a stale version is refused until reloaded', async () => {
    const { user } = renderApp(`${PATH}?edit=MCH-00003`)
    const form = await screen.findByRole('dialog', { name: 'Edit Machine 3' }, { timeout: 15_000 })
    const name = within(form).getByRole('textbox', { name: /^Name/ })
    await waitFor(() => {
      expect(name).toHaveValue('Machine 3')
    })

    // Someone else saves the device meanwhile.
    const current = devices.find('MCH-00003')
    if (!current) throw new Error('No MCH-00003 in the seed')
    devices.update(current.id, { ...current, address: 'Moved upstairs', rowVersion: '0xother' })

    await user.clear(name)
    await user.type(name, 'Johar Town entrance')
    await user.click(within(form).getByRole('button', { name: 'Save Changes' }))
    expect(await within(form).findByText(/Someone else changed this device/)).toBeVisible()
    expect(devices.find('MCH-00003')?.name).toBe('Machine 3')

    await user.click(within(form).getByRole('button', { name: 'Reload' }))
    await waitFor(() => {
      expect(within(form).getByRole('textbox', { name: /^Address/ })).toHaveValue('Moved upstairs')
    })
    await user.clear(name)
    await user.type(name, 'Johar Town entrance')
    await user.click(within(form).getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Johar Town entrance saved')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /^Edit/ })).not.toBeInTheDocument()
    })
    expect(devices.find('MCH-00003')).toMatchObject({
      name: 'Johar Town entrance',
      address: 'Moved upstairs',
    })
  })

  it('refuses to delete a device in use and offers Inactive; deletes an unused one', async () => {
    // Machine 2 without its people: only its punches keep it (the API refuses).
    for (const row of deviceEnrolments.all().filter((item) => item.deviceId === 'MCH-00002')) {
      deviceEnrolments.remove(row.id)
    }
    const { user } = renderApp(PATH)
    const table = await devicesTable()

    await user.click(
      await within(table).findByRole('button', { name: 'Actions for Machine 1 (MCH-00001)' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    let dialog = await screen.findByRole('dialog', { name: 'Machine 1 cannot be deleted' })
    expect(
      within(dialog).getByText(/has 11 people enrolled, so it cannot be deleted/),
    ).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
    const buttons = within(dialog)
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(buttons.indexOf('Cancel')).toBeLessThan(buttons.indexOf('Set Inactive'))
    await user.click(within(dialog).getByRole('button', { name: 'Set Inactive' }))
    expect(await screen.findByText('Machine 1 (MCH-00001) set to Inactive')).toBeInTheDocument()
    expect(devices.find('MCH-00001')?.status).toBe('inactive')

    await user.click(
      within(table).getByRole('button', { name: 'Actions for Machine 2 (MCH-00002)' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    dialog = await screen.findByRole('dialog', { name: 'Delete Machine 2?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete Machine 2' }))
    expect(
      await within(dialog).findByText(
        'Machine 2 (MCH-00002) has punches in the attendance log, so it cannot be deleted. Set it to Inactive instead.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('dialog', { name: 'Machine 2 cannot be deleted' })).toBeVisible()
    expect(devices.find('MCH-00002')).toBeDefined()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    // The spare has nobody and no punches.
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    await user.click(
      await within(table).findByRole('button', { name: 'Actions for Machine 13 (MCH-00013)' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    dialog = await screen.findByRole('dialog', { name: 'Delete Machine 13?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete Machine 13' }))
    expect(await screen.findByText('Machine 13 (MCH-00013) deleted')).toBeInTheDocument()
    expect(devices.find('MCH-00013')).toBeUndefined()
  })

  it('shows a failed list as an error with Try again, not as an empty list', async () => {
    server.use(
      http.get(apiPath('/attendance/settings/devices'), () =>
        HttpResponse.json({ message: 'The device service is down.' }, { status: 503 }),
      ),
    )
    const { user } = renderApp(PATH)
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Could not load the devices' },
        { timeout: 15_000 },
      ),
    ).toBeVisible()
    expect(screen.getByText('The device service is down.')).toBeVisible()
    expect(screen.queryByText(/No biometric devices yet/)).not.toBeInTheDocument()

    server.resetHandlers()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await within(await devicesTable()).findByRole('button', { name: 'Machine 1' }),
    ).toBeVisible()
  })

  it('stacks the devices as cards on a phone', async () => {
    setViewportWidth(375)
    renderApp(PATH)
    const list = await screen.findByRole('list', { name: 'Biometric devices' }, { timeout: 15_000 })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(screen.queryByRole('table', { name: 'Biometric devices' })).not.toBeInTheDocument()
    expect(
      within(list).getByRole('button', { name: 'Actions for Machine 1 (MCH-00001)' }),
    ).toBeVisible()
  })
})
