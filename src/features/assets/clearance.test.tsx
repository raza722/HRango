import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { allocations, clearances } from '@/mocks/assets/db'
import { renderApp } from '@/test/test-utils'

async function choose(user: UserEvent, label: string | RegExp, option: string | RegExp) {
  await user.click(await screen.findByRole('combobox', { name: label }))
  await user.click(await screen.findByRole('option', { name: option }))
}

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name)
  const row = cell.closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

describe('Asset Clearance Form', () => {
  it('lists the forms with their status', async () => {
    renderApp('/assets/clearance-form')

    expect(
      await screen.findByRole('heading', { name: 'Asset Clearance Form', level: 1 }),
    ).toBeVisible()
    const talha = await rowOf('Talha Aziz')
    expect(within(talha).getByText('Pending by HR')).toBeVisible()
    const nida = await rowOf('Nida Hassan')
    expect(within(nida).getByText('Approved')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Approved' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Unapproved' })).toBeVisible()
  })

  it('approves the ticked form, which frees the assets, and unapproves it again', async () => {
    const { user } = renderApp('/assets/clearance-form')

    await user.click(
      await screen.findByRole('checkbox', { name: "Select Talha Aziz's clearance form" }),
    )
    await user.click(screen.getByRole('button', { name: 'Approved' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Approve clearance forms' })
    expect(within(confirm).getByText('Are you sure you want to Perform this action?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('1 form approved')).toBeInTheDocument()
    await waitFor(() => {
      expect(clearances.find('cf_2')?.status).toBe('approved')
    })
    expect(allocations.find('al_3')?.deallocationDate).not.toBeNull()
    expect(allocations.find('al_4')?.deallocationDate).not.toBeNull()
    expect(await within(await rowOf('Talha Aziz')).findByText('Approved')).toBeVisible()

    await user.click(screen.getByRole('checkbox', { name: "Select Talha Aziz's clearance form" }))
    await user.click(screen.getByRole('button', { name: 'Unapproved' }))
    const undo = await screen.findByRole('alertdialog', { name: 'Unapprove clearance forms' })
    await user.click(within(undo).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('1 form unapproved')).toBeInTheDocument()
    await waitFor(() => {
      expect(clearances.find('cf_2')?.status).toBe('pending')
    })
    expect(allocations.find('al_3')?.deallocationDate).toBeNull()
    expect(allocations.find('al_4')?.deallocationDate).toBeNull()
  })

  it('refuses to delete an approved form', async () => {
    const { user } = renderApp('/assets/clearance-form')

    await user.click(
      await screen.findByRole('button', { name: "Actions for Nida Hassan's clearance form" }),
    )
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete clearance form' })
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    expect(
      await screen.findByText('An approved clearance form cannot be deleted. Unapprove it first.'),
    ).toBeInTheDocument()
    expect(clearances.find('cf_1')).toBeDefined()
  })

  it('creates a form with a block for each asset the person holds', async () => {
    const { user } = renderApp('/assets/clearance-form')

    await user.click(await screen.findByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Clearance Form Create' })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByText('Choose the employee')).toBeVisible()

    await choose(user, /^Employee Name/, /Ayesha Malik/)
    const block = await within(dialog).findByRole('region', { name: 'Asset 1, Car' })
    expect(within(block).getByRole('textbox', { name: /^Asset ID/ })).toHaveValue('LEB-21-4410')
    expect(within(dialog).getByRole('textbox', { name: /^Department/ })).toHaveValue('Operations')
    await user.click(within(block).getByRole('radio', { name: 'Complete Return' }))
    await choose(user, /^Checked By/, /Hina Raza/)
    await choose(user, /^Clearance Approved By/, /Shelley Kannes/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Clearance form created')).toBeInTheDocument()
    const created = clearances.all().find((form) => form.employeeId === 'em_ayesha')
    expect(created?.status).toBe('pending')
    expect(created?.lines).toEqual([
      expect.objectContaining({ assetId: 'as_4', allocationId: 'al_2', returnStatus: 'complete' }),
    ])
  })
})
