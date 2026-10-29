import { configure, screen, waitFor, within } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-error'
import { extensions, views } from '@/mocks/project-management/db'
import { renderApp, signIn } from '@/test/test-utils'

import { pmApi } from './api/pm.api'

const PAGE = '/project-management/workspaces/ws_uxui'
const FIRST_LOAD = { timeout: 15_000 }

configure({ asyncUtilTimeout: 4000 })

/** The List view's columns as the workspace's List view keeps them (`config.columns`). */
const listColumns = () => {
  const config = views.find('vw_ws_uxui_list')?.config
  return (Array.isArray(config?.columns) ? config.columns : []) as {
    key: string
    visible: boolean
  }[]
}

describe('Workspace page fixes', { timeout: 60_000 }, () => {
  it('refuses an extension to a day already past (the mock as the API)', async () => {
    signIn()
    // The audit was due three days ago: two days ago is after it, but already gone.
    let refused: ApiError | undefined
    try {
      await pmApi.requestExtension('tk_audit', {
        newDueDate: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
        reason: 'More pages to check',
      })
    } catch (error) {
      if (error instanceof ApiError) refused = error
    }
    expect(refused?.status).toBe(422)
    expect(refused?.fieldErrors.newDueDate).toBe('Choose today or a later date.')
    expect(extensions.all().some((entry) => entry.taskId === 'tk_audit')).toBe(false)
  })

  it('names the tab after the workspace', async () => {
    renderApp(PAGE)
    expect(
      await screen.findByRole(
        'heading',
        { name: 'UX/UI Design Team Work Space', level: 1 },
        FIRST_LOAD,
      ),
    ).toBeVisible()
    await waitFor(() => {
      expect(document.title).toBe('UX/UI Design Team Work Space | hRango')
    })
  })

  it('queues quick Customize changes: every column is saved, none is refused', async () => {
    const { user } = renderApp(PAGE)
    await screen.findByRole(
      'heading',
      { name: 'UX/UI Design Team Work Space', level: 1 },
      FIRST_LOAD,
    )
    await user.click(screen.getByRole('button', { name: 'Customize' }))
    const list = await screen.findByRole('list', { name: 'Columns' })
    const boxes = within(list).getAllByRole('checkbox')
    const ticked = () => boxes.filter((box) => box.getAttribute('aria-checked') === 'true').length
    const shownBefore = ticked()
    const hidden = boxes.filter(
      (box) => box.getAttribute('aria-checked') !== 'true' && !box.hasAttribute('disabled'),
    )
    expect(hidden.length).toBeGreaterThanOrEqual(3)
    // Three ticks while the first save is still on its way.
    for (const box of hidden.slice(0, 3)) await user.click(box)

    // The view saved last holds all three (with the Name column, always shown).
    await waitFor(
      () => {
        expect(listColumns().filter((column) => column.visible)).toHaveLength(shownBefore + 3)
      },
      { timeout: 10_000 },
    )
    expect(ticked()).toBe(shownBefore + 3)
    expect(screen.queryByText(/Someone else changed this record/)).not.toBeInTheDocument()
    for (const box of hidden.slice(0, 3)) expect(box).toBeChecked()
  })
})
