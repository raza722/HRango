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
    expect(within(talha).getByText('In Progress')).toBeVisible()
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
    expect(within(confirm).getByText('Approve 1 clearance form?')).toBeVisible()
    await user.click(within(confirm).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('1 form approved')).toBeInTheDocument()
    await waitFor(() => {
      expect(clearances.find('cf_2')?.status).toBe('approved')
    })
    expect(allocations.find('al_3')?.deallocatedOn).not.toBeNull()
    expect(allocations.find('al_4')?.assetClearanceId).toBe('cf_2')
    expect(await within(await rowOf('Talha Aziz')).findByText('Approved')).toBeVisible()

    await user.click(screen.getByRole('checkbox', { name: "Select Talha Aziz's clearance form" }))
    await user.click(screen.getByRole('button', { name: 'Unapproved' }))
    const undo = await screen.findByRole('alertdialog', { name: 'Unapprove clearance forms' })
    await user.click(within(undo).getByRole('button', { name: 'Yes' }))
    expect(await screen.findByText('1 form unapproved')).toBeInTheDocument()
    await waitFor(() => {
      expect(clearances.find('cf_2')?.status).toBe('in_progress')
    })
    expect(allocations.find('al_3')?.deallocatedOn).toBeNull()
    expect(allocations.find('al_4')?.deallocatedOn).toBeNull()
  })

  it('offers neither Edit nor Delete on an approved form', async () => {
    const { user } = renderApp('/assets/clearance-form')

    await user.click(
      await screen.findByRole('button', { name: "Actions for Nida Hassan's clearance form" }),
    )
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
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

    // The return status is required.
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(block).findByText('Choose the return status')).toBeVisible()
    await user.click(within(block).getByRole('radio', { name: 'Complete Return' }))
    await choose(user, /^Checked By/, /Hina Raza/)
    await choose(user, /^Clearance Approved By/, /Shelley Kannes/)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Clearance form created')).toBeInTheDocument()
    const created = clearances.all().find((form) => form.employeeId === 'em_ayesha')
    expect(created).toMatchObject({ status: 'in_progress', checkedById: 'em_hina' })
    expect(created?.items).toEqual([
      expect.objectContaining({
        assetAllocationId: 'al_2',
        conditionAtClearance: 'good',
        returnStatus: 'complete',
      }),
    ])
  })
})
