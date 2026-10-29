import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { addDays, format, getDay, parseISO } from 'date-fns'
import { afterEach, describe, expect, it } from 'vitest'

import { tasks } from '@/mocks/project-management/db'
import { renderApp, setViewportWidth } from '@/test/test-utils'

const PAGE = '/project-management/workspaces/ws_uxui'
const FIRST_LOAD = { timeout: 15_000 }
const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
/** A calendar day cell's name: "Saturday 31 October, 1 task". */
const cellName = (iso: string) => new RegExp(`^${format(parseISO(iso), 'EEEE d MMMM')}, `)

configure({ asyncUtilTimeout: 4000 })

const setTask = (id: string, changes: Partial<NonNullable<ReturnType<typeof tasks.find>>>) => {
  const task = tasks.find(id)
  if (!task) throw new Error(`No task ${id}`)
  tasks.update(id, { ...task, ...changes })
}

describe('Calendar view', { timeout: 60_000 }, () => {
  afterEach(() => {
    setViewportWidth(1024)
  })

  it('puts the tasks on their due date and moves one by dragging it to another day', async () => {
    renderApp(`${PAGE}?view=calendar&calendar=week&on=${day(4)}`)
    const due = await screen.findByRole('cell', { name: cellName(day(4)) }, FIRST_LOAD)
    const chip = within(due).getByRole('button', { name: 'User Persona List' })

    // A day of the same week (Sunday to Saturday): the next one, or the one before on a Saturday.
    const shift = getDay(parseISO(day(4))) === 6 ? -1 : 1
    const target = screen.getByRole('cell', { name: cellName(day(4 + shift)) })
    fireEvent.dragStart(chip)
    fireEvent.dragOver(target)
    fireEvent.drop(target)
    // The due date moves; the start date keeps its distance (seven days before).
    await waitFor(() => {
      expect(tasks.find('tk_persona')).toMatchObject({
        dueDate: day(4 + shift),
        startDate: day(-3 + shift),
      })
    })
    expect(
      within(screen.getByRole('cell', { name: cellName(day(4 + shift)) })).getByRole('button', {
        name: 'User Persona List',
      }),
    ).toBeVisible()
  })

  it('shows three tasks a day in a month and opens the week for the rest', async () => {
    for (const id of ['tk_quali', 'tk_quali_a', 'tk_quali_b', 'tk_persona']) {
      setTask(id, { dueDate: day(3) })
    }
    const { user, router } = renderApp(`${PAGE}?view=calendar&on=${day(3)}`)
    const cell = await screen.findByRole('cell', { name: cellName(day(3)) }, FIRST_LOAD)
    expect(within(cell).getAllByRole('button', { name: /^(?!\+)/ })).toHaveLength(3)
    await user.click(within(cell).getByRole('button', { name: '+1 more' }))
    expect(router.state.location.search).toMatchObject({ calendar: 'week', on: day(3) })
    expect(
      within(await screen.findByRole('cell', { name: cellName(day(3)) })).getAllByRole('button'),
    ).toHaveLength(4)
  })

  it('lists tasks without a due date and schedules one dropped on a day', async () => {
    setTask('tk_flow', { dueDate: null, startDate: null })
    renderApp(`${PAGE}?view=calendar&calendar=week&on=${day(1)}`)
    const unscheduled = await screen.findByRole('region', { name: 'Unscheduled (1)' }, FIRST_LOAD)
    const chip = within(unscheduled).getByRole('button', { name: 'Iteration List' })
    const target = screen.getByRole('cell', { name: cellName(day(1)) })
    fireEvent.dragStart(chip)
    fireEvent.dragOver(target)
    fireEvent.drop(target)
    await waitFor(() => {
      expect(tasks.find('tk_flow')).toMatchObject({ dueDate: day(1), startDate: null })
    })
  })

  it('opens a task from its chip, with its date cells', async () => {
    const { user, router } = renderApp(`${PAGE}?view=calendar&calendar=week&on=${day(4)}`)
    const due = await screen.findByRole('cell', { name: cellName(day(4)) }, FIRST_LOAD)
    await user.click(within(due).getByRole('button', { name: 'User Persona List' }))
    const peek = await screen.findByRole('dialog', { name: 'User Persona List' })
    expect(within(peek).getByRole('button', { name: /^Due Date: / })).toBeVisible()
    expect(within(peek).getByRole('button', { name: /^Start Date: / })).toBeVisible()
    await user.click(within(peek).getByRole('button', { name: 'Open in List view' }))
    await waitFor(() => {
      expect(router.state.location.hash).toBe('tk_persona')
    })
  })

  it('is a list of the days with tasks on a phone', async () => {
    setViewportWidth(375)
    renderApp(`${PAGE}?view=calendar&calendar=week&on=${day(4)}`)
    const agenda = await screen.findByRole('list', { name: /^Tasks by due date/ }, FIRST_LOAD)
    expect(
      within(agenda).getByRole('heading', { name: format(parseISO(day(4)), 'EEE d MMM') }),
    ).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('Timeline view', { timeout: 60_000 }, () => {
  const bar = (name: string) =>
    screen.findByRole('button', { name: new RegExp(`^${name}, `) }, FIRST_LOAD)

  it('draws a bar per task, grouped by list, and moves it with the arrow keys', async () => {
    renderApp(`${PAGE}?view=timeline&on=${day(0)}`)
    const timeline = await screen.findByRole('table', { name: /^Timeline, / }, FIRST_LOAD)
    expect(within(timeline).getByRole('rowgroup', { name: 'User Research' })).toBeVisible()
    const persona = await bar('User Persona List')
    expect(persona).toHaveAccessibleName(
      `User Persona List, ${format(parseISO(day(-3)), 'M/d/yyyy')} to ${format(parseISO(day(4)), 'M/d/yyyy')}`,
    )

    persona.focus()
    fireEvent.keyDown(persona, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(tasks.find('tk_persona')).toMatchObject({ startDate: day(-2), dueDate: day(5) })
    })
    // Shift: the due date only.
    fireEvent.keyDown(await bar('User Persona List'), { key: 'ArrowRight', shiftKey: true })
    await waitFor(() => {
      expect(tasks.find('tk_persona')).toMatchObject({ startDate: day(-2), dueDate: day(6) })
    })
  })

  it('moves a bar by dragging it, and one date by dragging an end', async () => {
    renderApp(`${PAGE}?view=timeline&on=${day(0)}`)
    const flow = await bar('Iteration List')
    // Month scale: 32 px a day.
    fireEvent.pointerDown(flow, { clientX: 200, button: 0, pointerId: 1 })
    fireEvent.pointerMove(flow, { clientX: 264, pointerId: 1 })
    fireEvent.pointerUp(flow, { clientX: 264, pointerId: 1 })
    await waitFor(() => {
      expect(tasks.find('tk_flow')).toMatchObject({ startDate: day(-3), dueDate: day(3) })
    })
  })

  it('groups by assignee or status, and changes the scale', async () => {
    const { user, router } = renderApp(`${PAGE}?view=timeline&on=${day(0)}`)
    await screen.findByRole('table', { name: /^Timeline, / }, FIRST_LOAD)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Group by' }), 'Assignee')
    expect(router.state.location.search).toMatchObject({ group: 'assignee' })
    expect(await screen.findByRole('rowgroup', { name: 'Haroon Jalani' })).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Group by' }), 'Status')
    expect(await screen.findByRole('rowgroup', { name: 'In-Progress' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Week' }))
    expect(router.state.location.search).toMatchObject({ scale: 'week' })
    expect(await bar('Iteration List')).toBeVisible()
  })

  it('lists the tasks without dates under Unscheduled', async () => {
    setTask('tk_flow', { dueDate: null, startDate: null })
    renderApp(`${PAGE}?view=timeline&on=${day(0)}`)
    const undated = await screen.findByRole('region', { name: 'Unscheduled (1)' }, FIRST_LOAD)
    expect(within(undated).getByRole('button', { name: 'Iteration List' })).toBeVisible()
  })
})
