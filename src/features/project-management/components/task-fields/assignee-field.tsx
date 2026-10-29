import { useState } from 'react'

import { cn } from '@/lib/utils'

import { usePeople } from '../../hooks/use-pm'
import type { PmPerson, TaskRow, Workspace } from '../../types/pm.types'
import { membersOf } from '../workspace/workspace-members'
import { ChevronDownIcon, InviteIcon } from './field-icons'
import { FieldPopover, PersonAvatar, PopupHeader, SearchField } from './field-popup'
import { fieldStyles } from './field-styles'
import { ADDED_PREVIEW, VISIBLE_AVATARS } from './field-utils'
import { RemoveButton } from './remove-button'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

/**
 * Add Assignee column: stacked avatars with the purple "n+" chip (its "+n Members" popup lists
 * the rest) and the Add Assignee Menu (V.3, 1:21985).
 */
export function AssigneesCell({ task, workspace }: TaskCellProps) {
  const people = usePeople()
  const [open, setOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const shown = task.assigneeIds.slice(0, VISIBLE_AVATARS)
  const hidden = task.assigneeIds.slice(VISIBLE_AVATARS)
  const names = task.assigneeIds
    .map(
      (id) =>
        people.get(id)?.name ??
        task.assignees.find((entry) => entry.employeeId === id)?.name ??
        'Unknown',
    )
    .join(', ')

  const openPicker = () => {
    setOpen(true)
  }

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label="Add Assignee"
      className="w-[min(31rem,calc(100vw-1rem))]"
      anchor={
        <div
          data-state={open ? 'open' : 'closed'}
          className={cn(fieldStyles.cell, 'gap-0 pr-1 pl-1')}
        >
          <button
            type="button"
            onClick={openPicker}
            aria-label={
              task.assigneeIds.length > 0 ? `Assignees: ${names}` : `Add assignee to ${task.name}`
            }
            className="flex min-w-0 items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:outline-none"
          >
            {shown.length === 0 ? (
              <>
                <span className={fieldStyles.cellIcon}>
                  <InviteIcon />
                </span>
                <span className={fieldStyles.placeholder}>Add Assignee</span>
              </>
            ) : (
              <span className="flex items-center">
                {shown.map((id, index) => (
                  <PersonAvatar
                    key={id}
                    person={people.get(id)}
                    className={cn('ring-white', index > 0 && '-ml-[0.45rem]')}
                  />
                ))}
              </span>
            )}
          </button>
          {hidden.length > 0 && (
            <MembersPopover
              open={membersOpen}
              onOpenChange={setMembersOpen}
              task={task}
              hidden={hidden}
              people={people}
            />
          )}
          <button
            type="button"
            onClick={openPicker}
            aria-label={`Open Add Assignee for ${task.name}`}
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-[#F8F5FF] dark:hover:bg-[#7127EA]/15"
          >
            <ChevronDownIcon className="h-[0.4rem] w-[0.75rem] text-[#7127EA] dark:text-[#C4ABFF]" />
          </button>
        </div>
      }
    >
      <AddAssigneePopup
        task={task}
        workspace={workspace}
        onClose={() => {
          setOpen(false)
        }}
      />
    </FieldPopover>
  )
}

interface MembersPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskRow
  hidden: string[]
  people: Map<string, PmPerson>
}

/** The "n+" chip and its "+n Members" list, each with the red remove button. */
function MembersPopover({ open, onOpenChange, task, hidden, people }: MembersPopoverProps) {
  const { save } = useTaskSave()
  const title = `+${hidden.length} Members`
  return (
    <FieldPopover
      open={open}
      onOpenChange={onOpenChange}
      label={title}
      className="w-64 px-3 py-3.5"
      trigger={
        <button
          type="button"
          aria-label={`${hidden.length} more ${hidden.length === 1 ? 'assignee' : 'assignees'}`}
          className="-ml-[0.45rem] flex size-[1.95rem] shrink-0 items-center justify-center rounded-full bg-[#7127EA] text-xs font-medium text-white ring-[1.6px] ring-white"
        >
          {hidden.length}+
        </button>
      }
    >
      <PopupHeader
        title={title}
        onClose={() => {
          onOpenChange(false)
        }}
      />
      <ul
        className={cn(fieldStyles.scroll, 'mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1')}
      >
        {hidden.map((id) => {
          const person = people.get(id)
          const name = person?.name ?? 'Unknown'
          return (
            <li key={id} className={fieldStyles.row}>
              <PersonAvatar person={person} />
              <span className="truncate">{name}</span>
              <RemoveButton
                label={`Remove ${name}`}
                className="mr-1"
                onClick={() => {
                  void save(task.id, {
                    assigneeIds: task.assigneeIds.filter((other) => other !== id),
                  })
                }}
              />
            </li>
          )
        })}
      </ul>
    </FieldPopover>
  )
}

interface AddAssigneePopupProps {
  task: TaskRow
  workspace: Workspace
  onClose: () => void
}

function AddAssigneePopup({ task, workspace, onClose }: AddAssigneePopupProps) {
  const people = usePeople()
  const { save } = useTaskSave()
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const multiple = workspace.setup.organizer.includes('multiple-assignees')

  const query = search.trim().toLowerCase()
  const matches = (person: PmPerson | undefined) =>
    !query || (person?.name.toLowerCase().includes(query) ?? false)

  // Assignees are workspace members (the API refuses anyone else).
  const members = membersOf(workspace, people)
  const personOf = (id: string): PmPerson | undefined =>
    people.get(id) ?? members.find((member) => member.id === id)
  const added = task.assigneeIds.filter((id) => matches(personOf(id)))
  const addedRows = added.map((id) => ({ kind: 'person' as const, id }))
  const visibleAdded = showAll ? addedRows : addedRows.slice(0, ADDED_PREVIEW)
  const employees = members.filter(
    (person) => !task.assigneeIds.includes(person.id) && matches(person),
  )

  const add = (id: string) => {
    void save(task.id, { assigneeIds: multiple ? [...task.assigneeIds, id] : [id] })
  }
  const remove = (id: string) => {
    void save(task.id, { assigneeIds: task.assigneeIds.filter((other) => other !== id) })
  }
  return (
    <div className="flex flex-col gap-3.5 px-3 py-[1.125rem]">
      <PopupHeader title="Add Assignee" onClose={onClose} />
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search employee here ..."
        label="Search employee"
        className="h-[2.2rem] w-full flex-none"
      />

      <div className={fieldStyles.divider} />

      <section aria-label="Added Assignees" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <h4 className={fieldStyles.sectionTitle}>Added Assignees</h4>
          {addedRows.length > ADDED_PREVIEW && (
            <button
              type="button"
              onClick={() => {
                setShowAll((all) => !all)
              }}
              className={fieldStyles.link}
            >
              {showAll ? 'View less' : 'View more'}
            </button>
          )}
        </div>
        {addedRows.length === 0 ? (
          <p className={cn(fieldStyles.muted, 'px-0.5')}>No assignees yet</p>
        ) : (
          <ul
            className={cn(fieldStyles.scroll, 'flex max-h-[8.4rem] flex-col gap-2 overflow-y-auto')}
          >
            {visibleAdded.map((row) => {
              const person = personOf(row.id)
              const name = person?.name ?? 'Unknown'
              return (
                <li key={row.id} className={fieldStyles.row}>
                  <PersonAvatar person={person} />
                  <span className="truncate">{name}</span>
                  <RemoveButton
                    label={`Remove ${name}`}
                    className="mr-1.5"
                    onClick={() => {
                      remove(row.id)
                    }}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className={fieldStyles.divider} />

      <section aria-label="Select or Add Assignees" className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <h4 className={fieldStyles.sectionTitle}>Select or Add Assignees</h4>
          <span className="text-[0.6875rem] font-medium tracking-[0.01em] text-[#3D3D3D] dark:text-title">
            {employees.length} Employees
          </span>
        </div>
        <ul
          className={cn(
            fieldStyles.scroll,
            'flex max-h-[14.25rem] flex-col gap-2 overflow-y-auto pr-1.5',
          )}
        >
          {employees.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  add(person.id)
                }}
                aria-label={`Add ${person.name}`}
                className={fieldStyles.rowButton}
              >
                <PersonAvatar person={person} />
                <span className="truncate">{person.name}</span>
              </button>
            </li>
          ))}
          {employees.length === 0 && (
            <li className={cn(fieldStyles.muted, 'px-0.5')}>No employee matches the search</li>
          )}
        </ul>
      </section>
    </div>
  )
}
