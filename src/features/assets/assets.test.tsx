import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { allocations, assets, assetTypes } from '@/mocks/assets/db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens a date box and picks today. */
async function pickToday(user: UserEvent, label: RegExp) {
  await user.click(screen.getByRole('button', { name: label }))
  await user.click(
    await screen.findByRole('button', { name: new RegExp(format(new Date(), 'MMMM do, yyyy')) }),
  )
}

async function openRowMenu(user: UserEvent, name: string) {
  await user.click(await screen.findByRole('button', { name }))
}

describe('Company Assets', () => {
  it('lists the assets and creates one, with its history', async () => {
    const { user } = renderApp('/assets/company-assets')

    expect(await screen.findByRole('heading', { name: 'Company Assets', level: 1 })).toBeVisible()
    const first = (await screen.findByText('AST-00001')).closest('tr')
    if (!first) throw new Error('No row for AST-00001')
    expect(within(first).getByText('Allocated')).toBeVisible()
    const monitor = screen.getByText('AST-00006').closest('tr')
    if (!monitor) throw new Error('No row for AST-00006')
    expect(within(monitor).getByText('Unavailable')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Asset Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Enter the name')).toBeVisible()
    expect(within(dialog).getByText('Choose the asset type')).toBeVisible()
    expect(within(dialog).getByText('Enter the identification number')).toBeVisible()
    expect(within(dialog).getByText('Enter the current value')).toBeVisible()
    expect(within(dialog).getByText('Choose the acquired date')).toBeVisible()

    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Projector')
    await choose(user, /^Asset Type/, 'Monitor')
    // The number of an existing asset is refused by the server.
    await user.type(
      within(dialog).getByRole('textbox', { name: /^Identification Number/ }),
      '123456789',
    )
    await user.type(within(dialog).getByRole('textbox', { name: /^Current Value/ }), '75000')
    await pickToday(user, /^Acquired date/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('Another asset has this identification number'),
    ).toBeVisible()
    const number = within(dialog).getByRole('textbox', { name: /^Identification Number/ })
    await user.clear(number)
    await user.type(number, 'EP-X41-0001')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Asset created')).toBeInTheDocument()

    const created = assets.all().find((asset) => asset.name === 'Projector')
    expect(created?.code).toBe('AST-00010')
    expect(created?.history[0]?.action).toBe('Create')

    await openRowMenu(user, 'Actions for AST-00010, Projector')
    await user.click(await screen.findByRole('menuitem', { name: 'History' }))
    const history = await screen.findByRole('dialog', { name: 'Asset History' })
    expect(await within(history).findByText('Create')).toBeVisible()
    const changes = within(history).getByRole('table', { name: 'Fields changed by Create' })
    const row = within(changes).getByText('Identification Number').closest('tr')
    if (!row) throw new Error('No Identification Number change')
    expect(within(row).getByText('EP-X41-0001')).toBeVisible()
  })

  it('refuses to deactivate an allocated asset and activates an unavailable one', async () => {
    const { user } = renderApp('/assets/company-assets')

    await openRowMenu(user, 'Actions for AST-00001, Laptop')
    await user.click(await screen.findByRole('menuitem', { name: 'Deactivate' }))
    expect(
      await screen.findByText('This asset is allocated to Hina Raza. Deallocate it first.'),
    ).toBeInTheDocument()
    expect(assets.find('as_1')?.active).toBe(true)

    await openRowMenu(user, 'Actions for AST-00006, Monitor')
    await user.click(await screen.findByRole('menuitem', { name: 'Activate' }))
    expect(await screen.findByText('Asset activated')).toBeInTheDocument()
    expect(assets.find('as_6')?.active).toBe(true)
  })
})

describe('Asset Type', () => {
  it('creates a type, refuses a duplicate name and keeps a type in use', async () => {
    const { user } = renderApp('/assets/types')

    expect(await screen.findByRole('heading', { name: 'Asset Type', level: 1 })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Asset Type Create' })
    const name = within(dialog).getByRole('textbox', { name: /^Name/ })
    await user.type(name, 'Laptop')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(
      await within(dialog).findByText('An asset type with this name already exists'),
    ).toBeVisible()
    await user.clear(name)
    await user.type(name, 'Tablet')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Asset type created')).toBeInTheDocument()
    expect(assetTypes.all().some((type) => type.name === 'Tablet' && type.active)).toBe(true)

    await openRowMenu(user, 'Actions for ATP-00001, Laptop')
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect(
      await screen.findByText('Laptop is the type of 3 assets; it cannot be deleted.'),
    ).toBeInTheDocument()

    await openRowMenu(user, 'Actions for ATP-00006, Printer')
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Yes' }),
    )
    expect(await screen.findByText('Asset type deleted')).toBeInTheDocument()
    expect(assetTypes.find('at_printer')).toBeUndefined()
  })
})

describe('Asset Allocations', () => {
  it('allocates an available asset and deallocates it', async () => {
    const { user } = renderApp('/assets/allocations')

    expect(
      await screen.findByRole('heading', { name: 'Asset Allocations', level: 1 }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Allocate' }))
    const dialog = await screen.findByRole('dialog', { name: 'Asset' })
    await choose(user, /^Employee/, /Omer Farooq/)
    await choose(user, /^Asset Type/, 'Hard Drive')
    await choose(user, /^Asset\W*$/, /Hard Drive \(SG-2TB-7781\)/)
    await pickToday(user, /^Allocation Date/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Asset allocated')).toBeInTheDocument()

    const created = allocations
      .all()
      .find((item) => item.assetId === 'as_2' && item.deallocationDate === null)
    expect(created?.employeeId).toBe('em_omer')
    const row = (await screen.findByText('SG-2TB-7781')).closest('tr')
    if (!row) throw new Error('No row for the hard drive')
    expect(within(row).getByText('Allocated')).toBeVisible()

    await openRowMenu(user, 'Actions for Hard Drive (SG-2TB-7781), Omer Farooq')
    await user.click(await screen.findByRole('menuitem', { name: 'Deallocate' }))
    const deallocate = await screen.findByRole('dialog', { name: 'Asset Deallocate' })
    await user.click(within(deallocate).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Asset deallocated')).toBeInTheDocument()
    await waitFor(() => {
      expect(allocations.find(created?.id ?? '')?.deallocationDate).toBe(
        format(new Date(), 'yyyy-MM-dd'),
      )
    })
  })
})
