import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  addDays,
  endOfWeek,
  format,
  getDay,
  isWithinInterval,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { activities, tasks } from '@/mocks/project-management/db'
import { renderApp, setViewportWidth } from '@/test/test-utils'

const PAGE = '/project-management/workspaces/ws_uxui'
const FIRST_LOAD = { timeout: 15_000 }
const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
const shown = (iso: string) => format(parseISO(iso), 'd MMM yyyy')
/** A calendar day cell's name: "Saturday 31 October, 1 task". */
const cellName = (iso: string) => new RegExp(`^${format(parseISO(iso), 'EEEE d MMMM')}, `)

configure({ asyncUtilTimeout: 4000 })

/** The lines of the Activity view, as read. */
const lines = async () => {
  const list = await screen.findByRole('list', { name: 'Activity, newest first' }, FIRST_LOAD)
  return within(list)
    .getAllByRole('listitem')
    .filter((item) => item.querySelector(':scope > time'))
    .map((item) => item.querySelector('p')?.textContent ?? '')
}

/** jsdom has no object URLs: records the text a download makes. */
function catchDownloads() {
  const saved: { blob: Blob; name: string }[] = []
  let last: Blob | undefined
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      last = blob
      return 'blob:activity'
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

describe('Activity view', { timeout: 60_000 }, () => {
  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
    vi.restoreAllMocks()
  })

  it('lists the history newest first, by day, as sentences', async () => {
    const { user, router } = renderApp(`${PAGE}?view=activity`)
    const read = await lines()
    expect(read[0]).toBe(
      `Rehan Ahmad set Due date of Low fidelity wire-frames for Create Workspace to ${shown(day(5))}`,
    )
    expect(read).toContain(
      'Saad Hadier changed Status of Prototype the List view from In-Progress to Completed',
    )
    expect(read).toContain('Shelley Kannes commented on User Qualitative Research')
    // Only this workspace's history: the QA workspace's extension request is not here.
    expect(read.join(' ')).not.toContain('onboarding copy')
    const days = within(screen.getByRole('list', { name: 'Activity, newest first' }))
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(days.slice(0, 2)).toEqual(['Today', 'Yesterday'])
    expect(screen.getByText('Showing 6 of 6 changes')).toBeVisible()

    // A task name opens the task in the List view.
    await user.click(screen.getByRole('button', { name: 'Iteration List' }))
    await waitFor(() => {
      expect(router.state.location.hash).toBe('tk_flow')
    })
    expect(router.state.location.search).not.toHaveProperty('view', 'activity')
  })

  it('filters by search, action and dates', async () => {
    const { user } = renderApp(`${PAGE}?view=activity`)
    await lines()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Action' }), 'Created')
    await waitFor(async () => {
      expect(await lines()).toEqual([
        'Shelley Kannes created User Persona List',
        'Shelley Kannes created User Qualitative Research',
      ])
    })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Action' }), 'All')
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'haroon')
    await waitFor(async () => {
      expect(await lines()).toEqual([
        'Haroon Jalani changed Status of Iteration List from To Do to In-Progress',
      ])
    })
    await user.clear(screen.getByRole('searchbox', { name: 'Search' }))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: day(-3) } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: day(-1) } })
    await waitFor(async () => {
      expect(await lines()).toEqual([
        'Shelley Kannes commented on User Qualitative Research',
        'Saad Hadier changed Status of Prototype the List view from In-Progress to Completed',
      ])
    })
    // A range with nothing in it.
    fireEvent.change(screen.getByLabelText('From'), { target: { value: day(-30) } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: day(-20) } })
    expect(await screen.findByText('Nothing matches these filters')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await lines()).toHaveLength(6)
  })

  it('records the changes made in the other views', async () => {
    const { router } = renderApp(`${PAGE}?view=calendar&calendar=week&on=${day(4)}`)
    const due = await screen.findByRole('cell', { name: cellName(day(4)) }, FIRST_LOAD)
    const chip = within(due).getByRole('button', { name: 'User Persona List' })
    // A day of the same week (Sunday to Saturday): the next one, or the one before on a Saturday.
    const shift = getDay(parseISO(day(4))) === 6 ? -1 : 1
    const target = screen.getByRole('cell', { name: cellName(day(4 + shift)) })
    fireEvent.dragStart(chip)
    fireEvent.dragOver(target)
    fireEvent.drop(target)
    await waitFor(() => {
      expect(tasks.find('tk_persona')?.dueDate).toBe(day(4 + shift))
    })
    router.history.push(`${PAGE}?view=activity`)
    const read = await lines()
    // Both dates moved: a line each (a seeded line of today may sort above them early in the day).
    expect(
      read
        .filter((line) => line.startsWith('Shelley Kannes changed'))
        .slice(0, 2)
        .toSorted(),
    ).toEqual([
      `Shelley Kannes changed Due date of User Persona List from ${shown(day(4))} to ${shown(day(4 + shift))}`,
      `Shelley Kannes changed Start date of User Persona List from ${shown(day(-3))} to ${shown(day(-3 + shift))}`,
    ])
    expect(screen.getByText('Showing 8 of 8 changes')).toBeVisible()
  })

  it('loads more lines a page at a time and exports the lines loaded', async () => {
    const seeded = activities.all()[0]
    if (!seeded) throw new Error('No activity')
    for (let index = 0; index < 30; index += 1) {
      activities.insert({
        ...seeded,
        id: `act_old_${String(index)}`,
        actionName: 'commented',
        itemName: `Old task ${String(index)}`,
        performedAt: `${day(-40)}T09:${String(index).padStart(2, '0')}:00`,
      })
    }
    const saved = catchDownloads()
    const { user } = renderApp(`${PAGE}?view=activity`)
    await lines()
    expect(screen.getByText('Showing 30 of 36 changes')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('Showing 36 of 36 changes')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(saved).toHaveLength(1)
    const [file] = saved
    if (!file) throw new Error('Nothing downloaded')
    expect(file.name).toBe(`ux-ui-design-team-work-space-activity-${day(0)}.csv`)
    const csv = (await textOf(file.blob)).split(/\r?\n/)
    expect(csv[0]).toBe('Date,Time,By,Action,Item code,Item,Field,From,To')
    expect(
      csv.filter((row) =>
        row.endsWith(',Haroon Jalani,Changed,HR000000005,Iteration List,Status,To Do,In-Progress'),
      ),
    ).toHaveLength(1)
    // Dates and times in the viewer's time zone.
    const oldest = parseISO(`${day(-40)}T09:00:00Z`)
    expect(csv).toContain(
      `${format(oldest, 'yyyy-MM-dd')},${format(oldest, 'HH:mm')},Shelley Kannes,Commented,HR000000001,Old task 0,,,`,
    )
    expect(csv.filter((row) => row.trim() !== '')).toHaveLength(37)
  })
})

describe('Team view', { timeout: 60_000 }, () => {
  afterEach(() => {
    setViewportWidth(1024)
  })

  /** The row of a person: its button (named "<name>: show their tasks…") and its description. */
  const row = async (name: string) =>
    screen.findByRole('button', { name: new RegExp(`^${name}:`) }, FIRST_LOAD)

  it('shows each member’s open tasks by status, busiest first, the unassigned last', async () => {
    renderApp(`${PAGE}?view=team`)
    const team = await screen.findByRole('list', { name: 'Team workload' }, FIRST_LOAD)
    const order = within(team)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')?.split(':')[0])
    expect(order).toEqual([
      'Shelley Kannes',
      'Bilal Ahmed',
      'Haroon Jalani',
      'Rehan Ahmad',
      'Areeba Hameed',
      'Jack Roy',
      'Saad Hadier',
      'Faisal Khan',
      'Unassigned tasks',
    ])
    const thisWeek = (offsets: number[]) =>
      offsets.filter((offset) =>
        isWithinInterval(parseISO(day(offset)), {
          start: startOfWeek(new Date()),
          end: endOfWeek(new Date()),
        }),
      ).length
    // Shelley: User Qualitative Research (5 points, 8 hours), its first subtask, the wire-frames.
    expect(await row('Shelley Kannes')).toHaveAccessibleDescription(
      `3 open tasks (To Do 2, In-Progress 1), 0 overdue, ${String(thisWeek([7, 2, 5]))} due this week, 0 done in the last 30 days, 5 points, estimate 8hr`,
    )
    // Saad finished the prototype two days ago.
    expect(await row('Saad Hadier')).toHaveAccessibleDescription(
      `1 open task (To Do 1), 0 overdue, ${String(thisWeek([7]))} due this week, 1 done in the last 30 days, 0 points, estimate 8hr`,
    )
    expect(screen.getByRole('button', { name: /^Unassigned tasks/ })).toBeDisabled()
    const legend = screen.getByRole('list', { name: 'Legend' })
    expect(within(legend).getByText('To Do')).toBeVisible()
    expect(within(legend).getByText('In-Progress')).toBeVisible()
    // Closed statuses have no bar.
    expect(within(legend).queryByText('Completed')).toBeNull()
  })

  it('opens the List view with only that person’s tasks', async () => {
    const { user, router } = renderApp(`${PAGE}?view=team`)
    await user.click(await row('Haroon Jalani'))
    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty('view', 'team')
    })
    expect(
      await screen.findByRole('button', { name: 'Actions for Iteration List' }, FIRST_LOAD),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Actions for User Qualitative Research' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Actions for User Persona List' })).toBeNull()
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent('1 active')
  })

  it('counts the unassigned tasks and lists them with the No assignee filter', async () => {
    const flow = tasks.find('tk_flow')
    if (!flow) throw new Error('No tk_flow')
    tasks.update(flow.id, { ...flow, assignees: [] })
    const { user } = renderApp(`${PAGE}?view=team`)
    const unassigned = await screen.findByRole('button', { name: /^Unassigned tasks/ }, FIRST_LOAD)
    expect(unassigned).toBeEnabled()
    expect(unassigned).toHaveAccessibleDescription(/^1 open task \(In-Progress 1\)/)
    await user.click(unassigned)
    expect(
      await screen.findByRole('button', { name: 'Actions for Iteration List' }, FIRST_LOAD),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Actions for User Persona List' })).toBeNull()
  })

  it('stacks each row on a phone, with the numbers labelled', async () => {
    setViewportWidth(375)
    renderApp(`${PAGE}?view=team`)
    const shelley = await row('Shelley Kannes')
    expect(within(shelley).getByText('Overdue')).toBeInTheDocument()
    expect(within(shelley).getByText('Estimate')).toBeInTheDocument()
  })
})
