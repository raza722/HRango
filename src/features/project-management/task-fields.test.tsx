import { screen, waitFor, within } from '@testing-library/react'
import { addDays, format } from 'date-fns'
import { beforeEach, describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { tags, tasks } from '@/mocks/project-management/db'
import { renderWithQueryClient, signIn } from '@/test/test-utils'

import { CommentsProvider } from './components/comments/comments-panel'
import {
  averageStoryPoints,
  formatDuration,
  linkUpdates,
  parseDuration,
  quickPicks,
  taskLink,
} from './components/task-fields/field-utils'
import { TASK_CELLS, TaskNameAdornments } from './components/task-fields/task-cells'
import { useTasks, useWorkspaceTree } from './hooks/use-pm'
import type { TaskColumnKey } from './types/pm.types'

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')

/** Draws one task's cell the way the List view does, from the mock API. */
function Cell({ taskId, column }: { taskId: string; column: TaskColumnKey | 'adornments' }) {
  const { data: tree } = useWorkspaceTree()
  const { data: rows } = useTasks('ws_uxui', null)
  const workspace = tree?.workspaces.find((entry) => entry.id === 'ws_uxui')
  const task = rows?.find((entry) => entry.id === taskId)
  if (!workspace || !task || !rows) return <p>Loading</p>
  if (column === 'adornments') {
    return <TaskNameAdornments task={task} workspace={workspace} tasks={rows} />
  }
  const View = TASK_CELLS[column]
  return <View task={task} workspace={workspace} tasks={rows} />
}

function renderCell(taskId: string, column: TaskColumnKey | 'adornments') {
  return renderWithQueryClient(
    <TooltipProvider>
      <CommentsProvider>
        <Cell taskId={taskId} column={column} />
      </CommentsProvider>
    </TooltipProvider>,
  )
}

const stored = (id: string) => {
  const task = tasks.find(id)
  if (!task) throw new Error(`No task ${id}`)
  return task
}

beforeEach(() => {
  signIn()
})

describe('field helpers', () => {
  it('reads typed durations and writes them as the design does', () => {
    expect(parseDuration('3h 30min')).toBe(210)
    expect(parseDuration('1.5h')).toBe(90)
    expect(parseDuration('45 min')).toBe(45)
    expect(parseDuration('2:15')).toBe(135)
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('soon')).toBeNull()
    expect(parseDuration('0h')).toBeNull()
    expect(formatDuration(127)).toBe('2hr 7min')
    expect(formatDuration(120)).toBe('2hr')
    expect(formatDuration(45)).toBe('45min')
  })

  it('works out the quick picks from the design (Friday 2 May 2025)', () => {
    const picks = quickPicks(new Date(2025, 4, 2, 13, 22)).flat()
    const hint = (key: string) => picks.find((pick) => pick.key === key)?.hint
    expect(hint('today')).toBe('Fri')
    expect(hint('tomorrow')).toBe('Sat')
    expect(hint('later')).toBe('5:22 PM')
    expect(hint('this-weekend')).toBe('Sat')
    expect(hint('next-week')).toBe('Mon')
    expect(hint('next-weekend')).toBe('10 May')
    expect(hint('two-weeks')).toBe('16 May')
    expect(hint('four-weeks')).toBe('30 May')
  })

  it('averages story points over the tasks that have them, and links both sides', () => {
    expect(
      averageStoryPoints([
        { storyPoints: [{ employeeId: 'a', points: 5 }] },
        { storyPoints: [] },
        {
          storyPoints: [
            { employeeId: 'a', points: 2 },
            { employeeId: 'b', points: 2 },
          ],
        },
      ]),
    ).toBe(4.5)
    expect(averageStoryPoints([{ storyPoints: [] }])).toBeNull()
    expect(
      linkUpdates(
        { id: 'a', waitingOn: [], blocking: [] },
        { id: 'b', waitingOn: [], blocking: ['c'] },
        'waitingOn',
      ),
    ).toEqual([
      { id: 'a', patch: { waitingOn: ['b'] } },
      { id: 'b', patch: { blocking: ['c', 'a'] } },
    ])
  })
})

describe('Add Assignee', () => {
  it('adds and removes assignees and invites by email', async () => {
    const { user } = renderCell('tk_wire', 'assignees')
    await user.click(await screen.findByRole('button', { name: /^Assignees: / }))
    const popup = await screen.findByRole('dialog', { name: 'Add Assignee' })
    expect(within(popup).getByText('Added Assignees')).toBeVisible()

    await user.type(within(popup).getByRole('textbox', { name: 'Search employee' }), 'Bilal')
    await user.click(within(popup).getByRole('button', { name: 'Add Bilal Ahmed' }))
    await waitFor(() => {
      expect(stored('tk_wire').assigneeIds).toContain('em_bilal')
    })

    await user.clear(within(popup).getByRole('textbox', { name: 'Search employee' }))
    await user.click(await within(popup).findByRole('button', { name: 'Remove Rehan Ahmad' }))
    await waitFor(() => {
      expect(stored('tk_wire').assigneeIds).not.toContain('em_rehan')
    })

    const email = within(popup).getByRole('textbox', { name: 'Invite from email' })
    await user.type(email, 'not-an-email')
    await user.click(within(popup).getByRole('button', { name: 'Invite' }))
    expect(await within(popup).findByText('Enter a valid email address')).toBeVisible()
    await user.clear(email)
    await user.type(email, 'guest@example.com')
    await user.click(within(popup).getByRole('button', { name: 'Invite' }))
    await waitFor(() => {
      expect(stored('tk_wire').invitedEmails).toEqual(['guest@example.com'])
    })
    expect(await within(popup).findByText('guest@example.com')).toBeVisible()
  })

  it('lists the assignees beyond the stacked avatars in "+n Members"', async () => {
    const { user } = renderCell('tk_quali', 'assignees')
    await user.click(await screen.findByRole('button', { name: '1 more assignees' }))
    const members = await screen.findByRole('dialog', { name: '+1 Members' })
    await user.click(within(members).getByRole('button', { name: 'Remove Saad Hadier' }))
    await waitFor(() => {
      expect(stored('tk_quali').assigneeIds).not.toContain('em_saad')
    })
  })
})

describe('Start Date and Due Date', () => {
  it('saves a quick pick and a time, and refuses a due date before the start', async () => {
    const { user } = renderCell('tk_quali_a', 'startDate')
    await user.click(await screen.findByRole('button', { name: /^Add Start Date to / }))
    const calendar = await screen.findByRole('dialog', { name: 'Calendar' })

    await user.click(within(calendar).getByRole('button', { name: /^4 Weeks, / }))
    expect(within(calendar).getByText('The due date cannot be before the start date')).toBeVisible()
    expect(within(calendar).getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.click(within(calendar).getByRole('button', { name: /^Today, / }))
    await user.click(within(calendar).getByRole('button', { name: 'Add Time to Start Date' }))
    const addTime = await screen.findByRole('dialog', { name: 'Add Time' })
    await user.clear(within(addTime).getByRole('textbox', { name: 'Hour' }))
    await user.type(within(addTime).getByRole('textbox', { name: 'Hour' }), '9')
    await user.clear(within(addTime).getByRole('textbox', { name: 'Minute' }))
    await user.type(within(addTime).getByRole('textbox', { name: 'Minute' }), '30')
    if (within(addTime).getByRole('textbox', { name: 'AM or PM' }).getAttribute('value') === 'PM')
      await user.click(within(addTime).getByRole('button', { name: 'Increase AM or PM' }))
    await user.click(within(addTime).getByRole('button', { name: 'Save' }))
    expect(within(calendar).getByRole('button', { name: 'Start Date time: 9:30 AM' })).toBeVisible()

    await user.click(within(calendar).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(stored('tk_quali_a').startDate).toBe(day(0))
    })
    expect(stored('tk_quali_a').startTime).toBe('09:30')
    expect(stored('tk_quali_a').dueDate).toBe(day(2))
    expect(await screen.findByRole('button', { name: /^Start Date: / })).toHaveTextContent('Today')
  })

  it('sets a custom recurrence', async () => {
    const { user } = renderCell('tk_flow', 'dueDate')
    await user.click(await screen.findByRole('button', { name: /^Due Date: / }))
    const calendar = await screen.findByRole('dialog', { name: 'Calendar' })
    await user.click(within(calendar).getByRole('button', { name: 'Set Recurrence' }))
    const panel = within(calendar).getByRole('region', { name: 'Custom Recurrence' })

    const every = within(panel).getByRole('spinbutton', { name: 'Repeat every' })
    await user.clear(every)
    await user.type(every, '2')
    await user.click(within(panel).getByRole('button', { name: 'Mon' }))
    await user.click(within(panel).getByRole('radio', { name: 'After' }))
    const count = within(panel).getByRole('spinbutton', { name: 'Occurrences' })
    await user.clear(count)
    await user.type(count, '5')
    await user.click(within(calendar).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(stored('tk_flow').recurrence).not.toBeNull()
    })
    const recurrence = stored('tk_flow').recurrence
    expect(recurrence?.every).toBe(2)
    expect(recurrence?.unit).toBe('week')
    expect(recurrence?.weekdays).toContain(1)
    expect(recurrence?.ends).toEqual({ kind: 'after', count: 5 })
  })
})

describe('Priority', () => {
  it('sets a priority and clears it', async () => {
    const { user } = renderCell('tk_flow', 'priority')
    await user.click(await screen.findByRole('button', { name: 'Priority: Normal' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Set Priority' })).getByRole('button', {
        name: 'Urgent',
      }),
    )
    await waitFor(() => {
      expect(stored('tk_flow').priority).toBe('urgent')
    })
    await user.click(await screen.findByRole('button', { name: 'Priority: Urgent' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Set Priority' })).getByRole('button', {
        name: 'Clear',
      }),
    )
    await waitFor(() => {
      expect(stored('tk_flow').priority).toBeNull()
    })
    expect(await screen.findByText('Priorities this task')).toBeVisible()
  })
})

describe('Tags and Labels', () => {
  it('creates a tag on Enter, renames one and deletes one', async () => {
    const { user } = renderCell('tk_flow', 'tags')
    await user.click(await screen.findByRole('button', { name: /^Tag for this task: / }))
    const popup = await screen.findByRole('dialog', { name: 'Add Tags' })

    await user.type(
      within(popup).getByRole('textbox', { name: 'Search or create new tag' }),
      'Research{Enter}',
    )
    await waitFor(() => {
      const created = tags.all().find((tag) => tag.name === 'Research')
      expect(created?.kind).toBe('tag')
      expect(stored('tk_flow').tagIds).toEqual([created?.id])
    })

    await user.click(await within(popup).findByRole('button', { name: 'Options for Bug Issue' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const rename = await within(popup).findByRole('textbox', { name: 'Rename Bug Issue' })
    await user.clear(rename)
    await user.type(rename, 'Defect{Enter}')
    await waitFor(() => {
      expect(tags.find('tg_bug')?.name).toBe('Defect')
    })

    await user.click(within(popup).getByRole('button', { name: 'Options for Revamp' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await waitFor(() => {
      expect(tags.find('tg_revamp')).toBeUndefined()
    })
    expect(stored('tk_persona').tagIds).not.toContain('tg_revamp')
  })

  it('picks a label from the workspace labels', async () => {
    const { user } = renderCell('tk_quali', 'labels')
    await user.click(await screen.findByRole('button', { name: /^Label for this task: / }))
    const popup = await screen.findByRole('dialog', { name: 'Labels' })
    expect(within(popup).queryByRole('button', { name: 'Active' })).not.toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Ready for QA' }))
    await waitFor(() => {
      expect(stored('tk_quali').labelIds).toEqual(['lb_ready_qa'])
    })
  })
})

describe('Dependencies', () => {
  it('links a task as Waiting On on both sides and unlinks it', async () => {
    const { user } = renderCell('tk_wire', 'dependencies')
    await user.click(await screen.findByRole('button', { name: /^Add dependencies to / }))
    const popup = await screen.findByRole('dialog', { name: 'Dependencies' })
    expect(within(popup).getByText('There are no tasks to link as dependencies')).toBeVisible()

    await user.click(within(popup).getByRole('button', { name: 'Add Task' }))
    const menu = await screen.findByRole('dialog', { name: 'Add Link' })
    await user.click(within(menu).getByRole('button', { name: /^Waiting On/ }))
    const picker = await screen.findByRole('dialog', { name: 'Add Task' })
    await user.click(within(picker).getByRole('button', { name: 'Link Iteration List' }))

    await waitFor(() => {
      expect(stored('tk_wire').waitingOn).toEqual(['tk_flow'])
    })
    expect(stored('tk_flow').blocking).toEqual(['tk_wire'])

    await user.click(await within(popup).findByRole('button', { name: 'Unlink Iteration List' }))
    await waitFor(() => {
      expect(stored('tk_wire').waitingOn).toEqual([])
    })
    expect(stored('tk_flow').blocking).toEqual([])
  })

  it('adds roll-up columns to the links', async () => {
    const { user } = renderCell('tk_persona', 'dependencies')
    await user.click(await screen.findByRole('button', { name: /^Dependencies: 1 linked task/ }))
    const popup = await screen.findByRole('dialog', { name: 'Dependencies' })
    await user.click(within(popup).getByRole('button', { name: 'Add a Roll-up' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Add a Roll-up' })).getByRole('checkbox', {
        name: 'Task ID',
      }),
    )
    expect(within(popup).getByRole('columnheader', { name: 'Task ID' })).toBeVisible()
    expect(within(popup).getByRole('cell', { name: '#HR000000001' })).toBeVisible()
  })
})

describe('Status and Task Type', () => {
  it('changes the status and the task type', async () => {
    const { user } = renderCell('tk_quali', 'status')
    await user.click(await screen.findByRole('button', { name: 'Status: To Do' }))
    const popup = await screen.findByRole('dialog', { name: 'Status' })
    expect(within(popup).getByRole('button', { name: 'Status settings' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.click(within(popup).getByRole('button', { name: 'In-Progress' }))
    await waitFor(() => {
      expect(stored('tk_quali').statusId).toBe('st_progress')
    })

    await user.click(await screen.findByRole('button', { name: 'Status: In-Progress' }))
    const again = await screen.findByRole('dialog', { name: 'Status' })
    await user.click(within(again).getByRole('tab', { name: 'Task Type' }))
    await user.click(within(again).getByRole('button', { name: 'Milestone' }))
    await waitFor(() => {
      expect(stored('tk_quali').type).toBe('milestone')
    })
  })
})

describe('Story Points', () => {
  it('allocates points per assignee, deletes them and rates the results', async () => {
    const { user } = renderCell('tk_quali', 'storyPoints')
    await user.click(await screen.findByRole('button', { name: /^Story Points: 8, Good Results/ }))
    const popup = await screen.findByRole('dialog', { name: 'Story Points' })

    await user.click(
      within(popup).getByRole('button', { name: 'Allocate story points to Haroon Jalani' }),
    )
    await waitFor(() => {
      expect(stored('tk_quali').storyPoints).toContainEqual({
        employeeId: 'em_haroon',
        points: 1,
      })
    })
    await user.click(
      await within(popup).findByRole('button', { name: 'More story points for Haroon Jalani' }),
    )
    await waitFor(() => {
      expect(stored('tk_quali').storyPoints).toContainEqual({
        employeeId: 'em_haroon',
        points: 2,
      })
    })

    await user.click(
      within(popup).getByRole('button', { name: "Options for Bilal Ahmed's story points" }),
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete Story Points' }))
    await waitFor(() => {
      expect(stored('tk_quali').storyPoints.some((entry) => entry.employeeId === 'em_bilal')).toBe(
        false,
      )
    })

    await user.click(within(popup).getByRole('button', { name: 'Excellent Results' }))
    await waitFor(() => {
      expect(stored('tk_quali').rating).toBe(3)
    })
  })
})

describe('Time Estimate and Time Tracked', () => {
  it('saves a typed estimate', async () => {
    const { user } = renderCell('tk_wire', 'timeEstimate')
    await user.click(await screen.findByRole('button', { name: /^Add time estimate to / }))
    const popup = await screen.findByRole('dialog', { name: 'Add Time Estimate' })
    await user.type(within(popup).getByRole('textbox', { name: 'Time estimate' }), '3h 30min')
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    await waitFor(() => {
      expect(stored('tk_wire').timeEstimateMinutes).toBe(210)
    })
    expect(await screen.findByRole('button', { name: 'Time Estimate: 3hr 30min' })).toBeVisible()
  })

  it('records a timer run as a time entry', async () => {
    const { user } = renderCell('tk_wire', 'timeTracked')
    await user.click(await screen.findByRole('button', { name: /^Track time on / }))
    const popup = await screen.findByRole('dialog', { name: 'Time Tracked' })
    await user.click(within(popup).getByRole('button', { name: 'Start timer' }))
    await waitFor(() => {
      expect(stored('tk_wire').timerStartedAt).not.toBeNull()
    })
    expect(await within(popup).findByRole('timer', { name: 'Timer running' })).toBeVisible()

    await user.click(within(popup).getByRole('button', { name: 'Pause timer' }))
    await waitFor(() => {
      expect(stored('tk_wire').timerStartedAt).toBeNull()
    })
    const [entry] = stored('tk_wire').timeEntries
    expect(entry?.employeeId).toBe('em_shelley')
    expect(entry?.minutes).toBe(1)
    expect(await within(popup).findByRole('timer', { name: 'Time recorded' })).toBeVisible()
  })

  it('adds time typed in the field and from the Start / Stop Time form', async () => {
    const { user } = renderCell('tk_wire', 'timeTracked')
    await user.click(await screen.findByRole('button', { name: /^Track time on / }))
    const popup = await screen.findByRole('dialog', { name: 'Time Tracked' })

    const field = within(popup).getByRole('textbox', { name: 'Enter time' })
    await user.type(field, 'later{Enter}')
    expect(await within(popup).findByText('Enter a time such as 3h 30min')).toBeVisible()
    await user.clear(field)
    await user.type(field, '1h 15min{Enter}')
    await waitFor(() => {
      expect(stored('tk_wire').timeEntries.map((entry) => entry.minutes)).toEqual([75])
    })

    const form = within(popup).getByRole('form', { name: 'Add time entry' })
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(form).findByText('Choose the start time')).toBeVisible()
    await user.click(within(form).getByRole('button', { name: 'Start Time' }))
    await user.click(await screen.findByRole('menuitem', { name: '9:00 am' }))
    await user.click(within(form).getByRole('button', { name: 'Stop Time' }))
    await user.click(await screen.findByRole('menuitem', { name: '10:15 am (1hr 15min)' }))
    await user.type(within(form).getByRole('textbox', { name: 'Notes' }), 'Persona workshop')
    await user.click(within(form).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(stored('tk_wire').timeEntries).toHaveLength(2)
    })
    expect(stored('tk_wire').timeEntries[1]).toMatchObject({
      date: day(0),
      start: '09:00',
      end: '10:15',
      minutes: 75,
      notes: 'Persona workshop',
    })
    expect(await within(popup).findByText('Persona workshop')).toBeVisible()
  })
})

describe('Files, Latest Comment and the name icons', () => {
  it('uploads a file from the device', async () => {
    const { user } = renderCell('tk_quali', 'files')
    await user.click(await screen.findByRole('button', { name: /^Attach files to / }))
    const popup = await screen.findByRole('dialog', { name: 'Attach Files' })
    expect(within(popup).getByRole('button', { name: 'Google Drive' })).toBeDisabled()
    await user.upload(
      within(popup).getByLabelText('Upload File From This Device'),
      new File(['%PDF-1.4 brief'], 'brief.pdf', { type: 'application/pdf' }),
    )
    await waitFor(() => {
      expect(stored('tk_quali').attachments.map((file) => file.name)).toEqual(['brief.pdf'])
    })
    expect(stored('tk_quali').attachments[0]?.source).toBe('device')
    expect(await screen.findByRole('button', { name: 'Files: brief.pdf' })).toBeVisible()
  })

  it('opens the comments from the Latest Comment cell', async () => {
    const { user } = renderCell('tk_quali', 'latestComment')
    await user.click(await screen.findByRole('button', { name: /^Latest comment by / }))
    expect(await screen.findByRole('button', { name: 'Close comments' })).toBeVisible()
  })

  it('edits the description, shows the dependencies and copies the link', async () => {
    const { user } = renderCell('tk_persona', 'adornments')
    await user.click(
      await screen.findByRole('button', {
        name: 'Waiting on 1 open task: show dependencies',
      }),
    )
    const dependencies = await screen.findByRole('dialog', { name: 'Dependencies' })
    expect(await within(dependencies).findByText('User Qualitative Research')).toBeVisible()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Add a description to User Persona List' }))
    const editor = await screen.findByRole('dialog', { name: 'Description' })
    await user.type(within(editor).getByRole('textbox', { name: 'Description' }), 'Two personas')
    await user.click(within(editor).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(stored('tk_persona').description).toBe('Two personas')
    })

    await user.click(screen.getByRole('button', { name: 'Copy link to User Persona List' }))
    expect(await navigator.clipboard.readText()).toBe(
      taskLink(stored('tk_persona'), window.location.origin),
    )
  })
})
