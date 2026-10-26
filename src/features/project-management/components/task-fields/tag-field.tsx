import { useRef, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { PM_SWATCHES } from '../../constants'
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '../../hooks/use-pm'
import type { Tag, TagKind, TaskRow } from '../../types/pm.types'
import { ChevronDownIcon, MoreIcon, TagIcon } from './field-icons'
import { FieldPopover, SearchField } from './field-popup'
import { fieldStyles, tagColors } from './field-styles'
import type { TaskCellProps } from './task-cell-types'
import { useTaskSave } from './use-task-save'

const COPY: Record<
  TagKind,
  { placeholder: string; search: string; title: string; key: 'tagIds' | 'labelIds' }
> = {
  tag: {
    placeholder: 'Tag for this task',
    search: 'Search or create new tag',
    title: 'Add Tags',
    key: 'tagIds',
  },
  label: {
    placeholder: 'Label for this task',
    search: 'Search or create new label',
    title: 'Labels',
    key: 'labelIds',
  },
}

/** Add Tags column (1:29675). */
export const TagsCell = (props: TaskCellProps) => <TagCell {...props} kind="tag" />
/** Labels column: the same picker over the workspace's labels. */
export const LabelsCell = (props: TaskCellProps) => <TagCell {...props} kind="label" />

/** A tag chip: a dark shade of its colour on a light tint (Active #2A6B39 on #D4F9D6). */
function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className="max-w-28 shrink-0 truncate rounded-[0.25rem] px-2 py-[0.15rem] text-[0.6875rem] font-semibold"
      style={tagColors(tag.color)}
    >
      {tag.name}
    </span>
  )
}

/** A label chip (Labels column): a white card with shadow around the label on its tint. */
function LabelChip({ tag }: { tag: Tag | null }) {
  return (
    <span className="flex h-8 min-w-0 shrink items-center rounded-md bg-white px-[0.3rem] shadow-[0_0_7px_rgba(31,41,55,0.1)]">
      <span
        className="flex h-[1.45rem] min-w-0 items-center truncate rounded-[0.125rem] px-3 text-[0.8125rem] font-medium text-[#626262]"
        style={{ backgroundColor: tag ? tagColors(tag.color).backgroundColor : '#E4E4E4' }}
      >
        {tag?.name ?? '-'}
      </span>
    </span>
  )
}

function TagCell({ task, workspace, kind }: TaskCellProps & { kind: TagKind }) {
  const [open, setOpen] = useState(false)
  const { data: allTags = [] } = useTags(workspace.id)
  const copy = COPY[kind]
  const chosen = task[copy.key]
    .map((id) => allTags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => tag !== undefined)
  const shown = chosen.slice(0, kind === 'label' ? 1 : 2)
  const more = chosen.length - shown.length

  return (
    <FieldPopover
      open={open}
      onOpenChange={setOpen}
      label={copy.title}
      className="w-[min(17.5rem,calc(100vw-1rem))] p-[0.7rem]"
      trigger={
        <button
          type="button"
          aria-label={
            chosen.length > 0
              ? `${copy.title}: ${chosen.map((tag) => tag.name).join(', ')}`
              : `${copy.placeholder}: ${task.name}`
          }
          className={fieldStyles.cell}
        >
          {kind === 'label' ? (
            <span className="flex min-w-0 items-center gap-1">
              <LabelChip tag={shown[0] ?? null} />
              {more > 0 && (
                <span className="text-[0.6875rem] font-semibold text-[#7127EA]">+{more}</span>
              )}
            </span>
          ) : chosen.length === 0 ? (
            <>
              <span className={fieldStyles.cellIcon}>
                <TagIcon />
              </span>
              <span className={fieldStyles.placeholder}>{copy.placeholder}</span>
            </>
          ) : (
            <span className="flex min-w-0 items-center gap-1">
              {shown.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
              {more > 0 && (
                <span className="text-[0.6875rem] font-semibold text-[#7127EA]">+{more}</span>
              )}
            </span>
          )}
          <ChevronDownIcon className={fieldStyles.cellChevron} />
        </button>
      }
    >
      <TagPicker task={task} workspaceId={workspace.id} kind={kind} tags={allTags} />
    </FieldPopover>
  )
}

interface TagPickerProps {
  task: TaskRow
  workspaceId: string
  kind: TagKind
  tags: readonly Tag[]
}

/** "Search or create new tag", then the list; Enter creates; each row has Rename / Delete. */
function TagPicker({ task, workspaceId, kind, tags }: TagPickerProps) {
  const copy = COPY[kind]
  const { save } = useTaskSave()
  const createTag = useCreateTag()
  const [search, setSearch] = useState('')
  const own = tags.filter((tag) => tag.kind === kind)
  const query = search.trim().toLowerCase()
  const listed = own.filter((tag) => !query || tag.name.toLowerCase().includes(query))
  // Labels: only options of the workspace's Labels field (other list fields are not labels).
  const selectedIds = task[copy.key].filter(
    (id) => kind === 'tag' || own.some((tag) => tag.id === id),
  )

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((other) => other !== id)
      : [...selectedIds, id]
    void save(task.id, { [copy.key]: next })
  }

  const createOrPick = async () => {
    const name = search.trim()
    if (!name) return
    const existing = own.find((tag) => tag.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!selectedIds.includes(existing.id)) toggle(existing.id)
      setSearch('')
      return
    }
    try {
      const created = await createTag.mutateAsync({
        workspaceId,
        input: { kind, name, color: PM_SWATCHES[own.length % PM_SWATCHES.length] ?? '#7127EA' },
      })
      setSearch('')
      await save(task.id, { [copy.key]: [...selectedIds, created.id] })
    } catch {
      // The app's mutation cache shows the server's message (a name already used).
    }
  }

  return (
    <div className="flex flex-col">
      <SearchField
        value={search}
        onChange={setSearch}
        onEnter={() => {
          void createOrPick()
        }}
        placeholder={copy.search}
        label={copy.search}
        className="h-9 w-full flex-none"
      />
      {query && !own.some((tag) => tag.name.toLowerCase() === query) && (
        <p className={cn(fieldStyles.muted, 'mt-2 px-1')}>
          Press Enter to create “{search.trim()}”
        </p>
      )}
      <div className={cn(fieldStyles.divider, 'my-[0.7rem]')} />
      <ul
        className={cn(fieldStyles.scroll, 'flex max-h-64 flex-col gap-[0.45rem] overflow-y-auto')}
      >
        {listed.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            selected={selectedIds.includes(tag.id)}
            onToggle={() => {
              toggle(tag.id)
            }}
          />
        ))}
        {listed.length === 0 && !query && (
          <li className={fieldStyles.muted}>No {kind === 'tag' ? 'tags' : 'labels'} yet</li>
        )}
      </ul>
    </div>
  )
}

const menuItem =
  'h-9 rounded-lg border border-[#EFEFEF] px-3 text-[0.8125rem] text-[#4F4F4F] focus:border-[#D9C8FB] focus:bg-[#F7F2FF]'

interface TagRowProps {
  tag: Tag
  selected: boolean
  onToggle: () => void
}

function TagRow({ tag, selected, onToggle }: TagRowProps) {
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(tag.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusRename = useRef(false)
  const kindName = tag.kind === 'tag' ? 'tag' : 'label'

  const rename = async () => {
    const next = name.trim()
    if (!next || next === tag.name) {
      setRenaming(false)
      setName(tag.name)
      return
    }
    try {
      await updateTag.mutateAsync({ tag, patch: { name: next } })
      setRenaming(false)
    } catch {
      // Toasted by the mutation cache; keep the field open to fix the name.
    }
  }

  return (
    <li
      className={cn(
        'flex h-[2.4rem] shrink-0 items-center gap-2 rounded-[0.5625rem] bg-[#F7F7F7] pr-1 pl-3',
        selected && 'ring-1 ring-[#A181FF]',
      )}
      style={selected ? { backgroundColor: tagColors(tag.color).backgroundColor } : undefined}
    >
      {renaming ? (
        <label className="min-w-0 flex-1">
          <span className="sr-only">Rename {tag.name}</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void rename()
              }
              if (event.key === 'Escape') {
                setRenaming(false)
                setName(tag.name)
              }
            }}
            onBlur={() => {
              void rename()
            }}
            maxLength={tag.kind === 'tag' ? 25 : 200}
            className="h-7 w-full rounded-md border border-[#A181FF] bg-white px-2 text-[0.8125rem] outline-none"
          />
        </label>
      ) : (
        <button
          type="button"
          aria-pressed={selected}
          onClick={onToggle}
          className="min-w-0 flex-1 truncate text-left text-[0.8125rem] font-medium"
          style={{ color: tagColors(tag.color).color }}
        >
          {tag.name}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Options for ${tag.name}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#7127EA] hover:bg-white"
        >
          <MoreIcon className="size-[1.1rem]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-[0.625rem] p-2 shadow-[0_0_14px_rgba(0,0,0,0.12)]"
          onCloseAutoFocus={(event) => {
            // Rename hands focus to its field instead of back to the menu button.
            if (!focusRename.current) return
            event.preventDefault()
            focusRename.current = false
            inputRef.current?.focus()
            inputRef.current?.select()
          }}
        >
          <DropdownMenuItem
            className={menuItem}
            onSelect={() => {
              setName(tag.name)
              setRenaming(true)
              focusRename.current = true
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className={cn(menuItem, 'mt-1.5')}
            onSelect={() => {
              deleteTag.mutate(tag)
            }}
          >
            Delete
          </DropdownMenuItem>
          {/* Labels are options of a custom field, which keeps no colours. */}
          {kindName === 'tag' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-1 pt-1 pb-1.5 text-xs font-medium text-[#909090]">
                Tag Colors
              </DropdownMenuLabel>
              <div className="grid grid-cols-6 gap-1.5 px-2 pb-2">
                {PM_SWATCHES.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    aria-label={`Colour ${color}`}
                    onSelect={() => {
                      updateTag.mutate({ tag, patch: { color } })
                    }}
                    className={cn(
                      'size-5 justify-center rounded-full p-0',
                      tag.color.toLowerCase() === color.toLowerCase() &&
                        'ring-2 ring-[#303030] ring-offset-1',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
