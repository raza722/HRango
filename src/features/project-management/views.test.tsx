import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { tasks } from '@/mocks/project-management/db'
import { renderApp } from '@/test/test-utils'

const PAGE = '/project-management/workspaces/ws_uxui'
const FIRST_LOAD = { timeout: 15_000 }

configure({ asyncUtilTimeout: 4000 })

const column = async (name: string) => {
  const board = await screen.findByRole('list', { name: 'Board' }, FIRST_LOAD)
  return within(board).getByRole('listitem', { name: new RegExp(`^${name}`) })
}
const card = (where: HTMLElement, name: string) => within(where).getByRole('article', { name })

/** jsdom has no object URLs: records the text a download makes. */
function catchDownloads() {
  const saved: { blob: Blob; name: string }[] = []
  let last: Blob | undefined
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      last = blob
      return 'blob:tasks'
    },
    revokeObjectURL: () => undefined,
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (last) saved.push({ blob: last, name: this.download })
  })
  return saved
}

const textOf = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsText(blob)
  })

describe('Board view', { timeout: 60_000 }, () => {
  it('draws a column per status with its tasks as cards', async () => {
    renderApp(`${PAGE}?view=board`)
    const todo = await column('To Do')
    expect(card(todo, 'User Qualitative Research')).toBeVisible()
    expect(card(todo, 'User Persona List')).toBeVisible()
    // Subtasks stay under their task: a count on the card, not cards of their own.
    expect(within(todo).queryByRole('article', { name: 'Prepare interview questions' })).toBeNull()
    expect(card(todo, 'User Qualitative Research')).toHaveTextContent('2 subtasks')
    expect(card(await column('In-Progress'), 'Iteration List')).toBeVisible()
    expect(card(await column('Completed'), 'Prototype the List view')).toBeVisible()
  })

  it('moves a card with its Move menu and by dragging it to another column', async () => {
    const { user } = renderApp(`${PAGE}?view=board`)
    const progress = await column('In-Progress')
    await user.click(
      within(card(progress, 'Iteration List')).getByRole('button', {
        name: 'Move Iteration List to another status',
      }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Completed' }))
    await waitFor(() => {
      expect(tasks.find('tk_flow')?.statusId).toBe('st_completed')
    })
    expect(card(await column('Completed'), 'Iteration List')).toBeVisible()

    // Dragged onto a column's free space, it goes last in that column, with its status.
    const persona = card(await column('To Do'), 'User Persona List')
    const target = await column('In-Progress')
    fireEvent.dragStart(persona)
    fireEvent.dragOver(target)
    fireEvent.drop(target)
    await waitFor(() => {
      expect(tasks.find('tk_persona')?.statusId).toBe('st_progress')
    })
  })

  it('puts a dragged card in the place of the card it is dropped on', async () => {
    renderApp(`${PAGE}?view=board`)
    const done = card(await column('Completed'), 'Prototype the List view')
    const quali = card(await column('To Do'), 'User Qualitative Research')
    fireEvent.dragStart(done)
    fireEvent.dragOver(quali)
    fireEvent.drop(quali)
    await waitFor(() => {
      expect(tasks.find('tk_ui')?.statusId).toBe('st_todo')
    })
    await waitFor(() => {
      expect(tasks.find('tk_ui')?.sortOrder).toBeLessThan(tasks.find('tk_quali')?.sortOrder ?? 0)
    })
  })

  it('adds a task at the foot of a column', async () => {
    const { user } = renderApp(`${PAGE}?view=board`)
    const done = await column('Completed')
    await user.click(within(done).getByRole('button', { name: 'Add Task to Completed' }))
    const box = within(done).getByRole('textbox', { name: 'Task name' })
    await user.keyboard('{Enter}')
    expect(within(done).getByText('Enter the task name')).toBeVisible()
    await user.type(box, 'Hand over the icons{Enter}')
    await waitFor(() => {
      expect(tasks.all().find((task) => task.name === 'Hand over the icons')?.statusId).toBe(
        'st_completed',
      )
    })
    expect(card(await column('Completed'), 'Hand over the icons')).toBeVisible()
  })
})

describe('Table view', { timeout: 60_000 }, () => {
  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  it('lists every task in one table with every column, sorted from the header', async () => {
    const { user } = renderApp(`${PAGE}?view=table`)
    const table = await screen.findByRole('table', { name: 'Tasks' }, FIRST_LOAD)
    // Tasks of every status, in one table (no status groups).
    expect(
      within(table).getByText('User Qualitative Research', { selector: '[title]' }),
    ).toBeVisible()
    expect(
      within(table).getByText('Prototype the List view', { selector: '[title]' }),
    ).toBeVisible()
    expect(screen.queryByRole('table', { name: 'To Do' })).not.toBeInTheDocument()
    // Columns the List view does not show by default are here.
    for (const label of ['Date Closed', 'Time Tracked', 'Created by', 'Files']) {
      expect(within(table).getByRole('button', { name: `${label} column menu` })).toBeVisible()
    }

    await user.click(within(table).getByRole('button', { name: 'Sort by Due Date' }))
    const names = within(table)
      .getAllByRole('row')
      .map((row) => row.querySelector('span[title][class*="truncate"]')?.textContent)
      .filter(Boolean)
    // Earliest due first: Prototype the List view (two days ago) leads.
    expect(names[0]).toBe('Prototype the List view')
  })

  it('keeps its columns as they are: no hide, delete or move in the header menu', async () => {
    const { user } = renderApp(`${PAGE}?view=table`)
    const table = await screen.findByRole('table', { name: 'Tasks' }, FIRST_LOAD)
    await user.click(within(table).getByRole('button', { name: 'Set Priority column menu' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Sort as Top' })).toBeVisible()
    expect(within(menu).queryByRole('menuitem', { name: 'Hide Column' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Delete Column' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Move to Start' })).not.toBeInTheDocument()
  })

  it('exports the tasks shown as CSV', async () => {
    const saved = catchDownloads()
    const { user } = renderApp(`${PAGE}?view=table`)
    await screen.findByRole('table', { name: 'Tasks' }, FIRST_LOAD)
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => {
      expect(saved).toHaveLength(1)
    })
    const [file] = saved
    if (!file) throw new Error('Nothing was saved')
    expect(file.name).toMatch(/^ux-ui-design-team-work-space-tasks-\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = (await textOf(file.blob)).trim().split('\n')
    expect(lines[0]).toBe(
      'Task ID,Task Name,Parent Task,List,Status,Priority,Assignees,Start Date,Due Date,Tags,Story Points,Time Estimate (minutes),Time Tracked (minutes),Created By,Date Created,Date Closed',
    )
    // Every task of the workspace, subtasks included, with the parent named.
    expect(lines).toHaveLength(
      1 + tasks.all().filter((task) => task.workspaceId === 'ws_uxui').length,
    )
    expect(lines.find((line) => line.includes('Prepare interview questions'))).toContain(
      'User Qualitative Research',
    )
  })
})
