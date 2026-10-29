import { act, screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { server } from '@/mocks/node'
import {
  PROMOTION_DESIGNATIONS,
  PROMOTION_GRADES,
  PROMOTION_LEVELS,
} from '@/mocks/requests/standard/kinds/promotion'
import { apiPath } from '@/mocks/utils'
import { useAuthStore } from '@/stores/auth-store'
import { renderApp } from '@/test/test-utils'

import { isOwnUndecidable } from './self-decision'

/**
 * The mock never puts your own request in your inbox, as the backend should. To show the guard
 * holds if one ever does, these tests sign in as Sadia Malik, whose pending Promotion
 * (RQ-PRM-0001) and Resignation (RQ-RSG-0001) wait in the demo approver's inbox.
 */
function actAs(employeeId: string) {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Not signed in')
  act(() => {
    useAuthStore.getState().updateUser({ ...user, employeeId })
  })
}

async function menuItems(user: UserEvent, code: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${code}` }))
  const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent)
  await user.keyboard('{Escape}')
  return items
}

describe('isOwnUndecidable', () => {
  const mine = { employee: { id: 'em_sadia' } }

  it('blocks the requester on their own promotion and resignation only', () => {
    expect(isOwnUndecidable('promotion', mine, 'em_sadia')).toBe(true)
    expect(isOwnUndecidable('resignation', mine, 'em_sadia')).toBe(true)
    expect(isOwnUndecidable('promotion', mine, 'em_shelley')).toBe(false)
    expect(isOwnUndecidable('leave', mine, 'em_sadia')).toBe(false)
  })

  it('does not block while the request or the session is unknown', () => {
    expect(isOwnUndecidable('promotion', undefined, 'em_sadia')).toBe(false)
    expect(isOwnUndecidable('promotion', mine, null)).toBe(false)
    expect(isOwnUndecidable('promotion', mine, undefined)).toBe(false)
  })
})

describe('No approving your own Promotion or Resignation', () => {
  // The settings mock has no grades, levels or designations; serve the ones the requests use.
  beforeEach(() => {
    server.use(
      ...(
        [
          ['grades', PROMOTION_GRADES],
          ['job-levels', PROMOTION_LEVELS],
          ['designations', PROMOTION_DESIGNATIONS],
        ] as const
      ).map(([kind, rows]) =>
        http.get(apiPath(`/organisation/lookups/${kind}`), () => HttpResponse.json({ data: rows })),
      ),
    )
  })

  it('drops Approve/Reject and Forward from the requester’s own promotion', async () => {
    const { user } = renderApp('/requests/promotion?tab=approvals')
    expect(
      await screen.findByRole('cell', { name: 'RQ-PRM-0001' }, { timeout: 5000 }),
    ).toBeVisible()
    expect(await menuItems(user, 'RQ-PRM-0001')).toContain('Approve/Reject')

    actAs('em_sadia')
    const items = await menuItems(user, 'RQ-PRM-0001')
    expect(items).not.toContain('Approve/Reject')
    expect(items).not.toContain('Forward')
    expect(items).toContain('View')
    // Nor can it be ticked for the bulk Approved / Unapproved buttons.
    expect(screen.getByRole('checkbox', { name: 'Select RQ-PRM-0001' })).toBeDisabled()
  })

  it('drops Approve/Reject from the requester’s own resignation, not from others', async () => {
    const { user } = renderApp('/requests/resignation?tab=approvals')
    expect(
      await screen.findByRole('cell', { name: 'RQ-RSG-0001' }, { timeout: 5000 }),
    ).toBeVisible()

    actAs('em_sadia')
    expect(await menuItems(user, 'RQ-RSG-0001')).not.toContain('Approve/Reject')
    expect(screen.getByRole('checkbox', { name: 'Select RQ-RSG-0001' })).toBeDisabled()
    // Someone else's resignation in the same inbox is still hers to decide.
    const other = screen
      .getAllByRole('checkbox', { name: /^Select RQ-RSG-/ })
      .find((box) => !box.getAttribute('aria-label')?.endsWith('0001'))
    expect(other).toBeEnabled()
    const otherCode = other?.getAttribute('aria-label')?.replace('Select ', '') ?? ''
    expect(await menuItems(user, otherCode)).toContain('Approve/Reject')
  })

  it('keeps an open Approve/Reject popup read-only once it is the requester’s own', async () => {
    const { user } = renderApp('/requests/resignation?tab=approvals')
    await user.click(
      await screen.findByRole('button', { name: 'Actions for RQ-RSG-0001' }, { timeout: 5000 }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Approve/Reject' }))
    const dialog = await screen.findByRole('dialog', { name: 'Resignation Approve/Reject' })
    expect(await within(dialog).findByRole('button', { name: 'Approve' })).toBeVisible()

    actAs('em_sadia')
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      'This is your own resignation request, so you can’t approve, reject or forward it.',
    )
    expect(within(dialog).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })
})
