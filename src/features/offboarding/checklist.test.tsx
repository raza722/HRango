import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { checklists } from '@/mocks/offboarding/db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** Opens "Additional Information Create" from the checklist dialog and fills it. */
async function addField(
  user: UserEvent,
  checklist: HTMLElement,
  name: string,
  type: string,
  bounds?: { min: string; max: string },
) {
  await user.click(within(checklist).getByRole('button', { name: 'Create' }))
  const dialog = await screen.findByRole('dialog', { name: 'Additional Information Create' })
  await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), name)
  await choose(user, /^Type/, type)
  if (bounds) {
    const label = type === 'String' ? ' Length' : ''
    await user.type(within(dialog).getByRole('spinbutton', { name: `Min${label}` }), bounds.min)
    await user.type(within(dialog).getByRole('spinbutton', { name: `Max${label}` }), bounds.max)
  }
  return dialog
}

async function openRow(user: UserEvent, item: 'Edit' | 'View') {
  await user.click(
    await screen.findByRole('button', { name: 'Actions for ECL-00001, Off Boarding Checklist' }),
  )
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

describe('Settings → Off Boarding Checklist', () => {
  it('lists the checklists beside the Off Boarding menu', async () => {
    renderApp('/settings/off-boarding/checklist')

    expect(
      await screen.findByRole('heading', { name: 'Off Boarding Checklist', level: 1 }),
    ).toBeVisible()
    const menu = screen.getByRole('navigation', { name: 'Off Boarding Settings' })
    expect(within(menu).getByRole('link', { name: 'Control Panel' })).toHaveAttribute(
      'href',
      '/settings/control-panel',
    )
    expect(within(menu).getByRole('link', { name: 'Off Boarding Checklist' })).toHaveAttribute(
      'data-status',
      'active',
    )
    expect(await screen.findByText('ECL-00001')).toBeVisible()
  })

  it('creates a checklist with a Number and a Date field', async () => {
    const { user } = renderApp('/settings/off-boarding/checklist')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const checklist = await screen.findByRole('dialog', { name: 'Checklist Create' })
    expect(within(checklist).getByRole('switch', { name: 'Status: Active' })).toBeChecked()
    expect(within(checklist).getByText('No Record Found')).toBeVisible()
    await user.type(within(checklist).getByRole('textbox', { name: /^Name/ }), 'Exit Steps')

    let field = await addField(user, checklist, 'Laptop Count', 'Number', { min: '5', max: '2' })
    await user.click(within(field).getByRole('button', { name: 'Save' }))
    expect(await within(field).findByText('Min cannot be more than Max')).toBeVisible()
    const max = within(field).getByRole('spinbutton', { name: 'Max' })
    await user.clear(max)
    await user.type(max, '7')
    await user.click(within(field).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Additional Information Create' }),
      ).not.toBeInTheDocument()
    })
    expect(within(checklist).getByRole('cell', { name: 'Laptop Count' })).toBeVisible()

    field = await addField(user, checklist, 'Last Day', 'Date')
    expect(within(field).queryByRole('spinbutton')).not.toBeInTheDocument()
    await user.click(within(field).getByRole('button', { name: 'Save' }))
    expect(await within(checklist).findByRole('cell', { name: 'Last Day' })).toBeVisible()

    await user.click(within(checklist).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Checklist created')).toBeInTheDocument()
    await waitFor(() => {
      const created = checklists.all().find((item) => item.name === 'Exit Steps')
      expect(
        created?.fields.map(({ name, type, required, min, max }) => ({
          name,
          type,
          required,
          min,
          max,
        })),
      ).toEqual([
        { name: 'Laptop Count', type: 'number', required: false, min: 5, max: 7 },
        { name: 'Last Day', type: 'date', required: false, min: null, max: null },
      ])
      expect(created?.code).toBe('ECL-00002')
      expect(created?.active).toBe(true)
    })
  })

  it('adds a String field and deletes one, keeping the other fields', async () => {
    const { user } = renderApp('/settings/off-boarding/checklist')

    await openRow(user, 'Edit')
    const checklist = await screen.findByRole('dialog', { name: 'Checklist Edit' })
    expect(await within(checklist).findByRole('cell', { name: 'Asset Clear' })).toBeVisible()

    const field = await addField(user, checklist, 'Exit Notes', 'String', {
      min: '10',
      max: '200',
    })
    await user.click(within(field).getByRole('button', { name: 'Save' }))
    expect(await within(checklist).findByRole('cell', { name: 'Exit Notes' })).toBeVisible()

    await user.click(within(checklist).getByRole('button', { name: 'Delete, Handover Notes' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete Handover Notes' })
    expect(within(confirm).getByText('Are you sure you want to Delete this?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    await waitFor(() => {
      expect(
        within(checklist).queryByRole('cell', { name: 'Handover Notes' }),
      ).not.toBeInTheDocument()
    })

    await user.click(within(checklist).getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Checklist updated')).toBeInTheDocument()
    await waitFor(() => {
      const fields = checklists.find('ecl_1')?.fields ?? []
      expect(fields.map((item) => item.name)).toEqual([
        'Asset Clear',
        'Exit Interview Done',
        'Notice Days Served',
        'Exit Notes',
      ])
      // Existing fields keep their ids, so End of Employment answers still match.
      expect(fields[0]?.id).toBe('cf_asset_clear')
      expect(fields.find((item) => item.name === 'Exit Notes')).toMatchObject({
        type: 'string',
        min: 10,
        max: 200,
      })
    })
  })

  it('views a checklist and a field read-only', async () => {
    const { user } = renderApp('/settings/off-boarding/checklist')

    await openRow(user, 'View')
    const checklist = await screen.findByRole('dialog', { name: 'Checklist View' })
    expect(await within(checklist).findByRole('cell', { name: 'Asset Clear' })).toBeVisible()
    expect(within(checklist).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(within(checklist).queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    expect(
      within(checklist).queryByRole('button', { name: 'Edit, Asset Clear' }),
    ).not.toBeInTheDocument()
    expect(within(checklist).getByRole('textbox', { name: /^Name/ })).toBeDisabled()
    expect(within(checklist).getByRole('button', { name: 'Cancel' })).toBeVisible()
  })
})
