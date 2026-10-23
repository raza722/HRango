import { useId, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { handleListKeys } from './list-keys'
import { ConfirmDialog, TemplateNameDialog } from './small-popups'
import { DotsIcon, DropdownChevronIcon, PlusIcon, SearchIcon } from './wizard-icons'
import { checkTemplateName, type StatusTemplateEntry } from './wizard-state'
import { wz } from './wizard-styles'

type Popup =
  | { kind: 'new' }
  | { kind: 'rename'; entry: StatusTemplateEntry }
  | { kind: 'delete'; entry: StatusTemplateEntry }
  | null

interface StatusTemplateSelectProps {
  labelId: string
  templates: readonly StatusTemplateEntry[]
  /** The chosen template; null shows "Select a status template". */
  value: string | null
  onSelect: (entry: StatusTemplateEntry) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onAdd: (name: string) => void
}

/**
 * Status Templates (702:206158): the dropdown with a search, each template with a 3-dot menu
 * (Rename, Delete) and "Add New Template" at the bottom; New Template (788:112744) and Rename
 * (780:94338) popups.
 */
export function StatusTemplateSelect({
  labelId,
  templates,
  value,
  onSelect,
  onRename,
  onDelete,
  onAdd,
}: StatusTemplateSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [popup, setPopup] = useState<Popup>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const valueId = useId()
  const listId = useId()
  const chosen = templates.find((entry) => entry.id === value)
  const query = search.trim().toLowerCase()
  const shown = query
    ? templates.filter((entry) => entry.name.toLowerCase().includes(query))
    : templates

  const openPopup = (next: Popup) => {
    setOpen(false)
    setSearch('')
    setPopup(next)
  }
  const returnFocus = () => triggerRef.current

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch('')
        }}
      >
        <div className={cn(wz.field, wz.fieldFocus, 'mt-3 p-0')}>
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="listbox"
              aria-labelledby={`${labelId} ${valueId}`}
              className="flex min-h-[4.0625rem] w-full min-w-0 items-center gap-3 rounded-[1.125rem] pr-[1.6rem] pl-5 text-left outline-none"
            >
              <span id={valueId} className={cn(wz.value, 'min-w-0 flex-1 truncate text-[#3D3D3D]')}>
                {chosen?.name ?? 'Select a status template'}
              </span>
              <DropdownChevronIcon
                className={cn(
                  'h-[0.8125rem] w-[1.4375rem] shrink-0 text-[#7127EA] transition-transform',
                  open && 'rotate-180',
                )}
              />
            </button>
          </PopoverTrigger>
        </div>
        <PopoverContent
          align="start"
          sideOffset={15}
          className={cn(wz.panel, 'border-0 p-0')}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const panel = event.currentTarget
            if (panel instanceof HTMLElement) panel.querySelector('input')?.focus()
          }}
        >
          <div className="px-[0.9375rem] pt-[0.9375rem]">
            <label className={wz.search}>
              <SearchIcon className="ml-[0.4rem] size-[1.2rem] shrink-0 text-[#A181FF]" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                }}
                aria-label="Search status templates"
                aria-controls={listId}
                placeholder="Search template here ..."
                className={wz.searchInput}
              />
            </label>
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            onKeyDown={handleListKeys}
            className={cn(
              wz.scrollbar,
              'mt-3 flex max-h-[min(16.125rem,40dvh)] flex-col gap-2 overflow-y-auto px-[0.4375rem] py-0.5 pr-2',
            )}
          >
            {shown.map((entry) => {
              const selected = entry.id === value
              return (
                <li key={entry.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-list-item
                    onClick={() => {
                      onSelect(entry)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={cn(
                      'flex min-h-[3.125rem] min-w-0 flex-1 items-center rounded-xl px-[0.8125rem] text-left text-base leading-[1.6875rem] text-[#262626] transition-colors outline-none hover:bg-[#F3F0FE] focus-visible:ring-2 focus-visible:ring-[#A181FF] sm:text-[1.125rem]',
                      selected && 'bg-[#F3F0FE]',
                    )}
                  >
                    <span className="truncate">{entry.name}</span>
                  </button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${entry.name} template options`}
                        className={wz.dotsButton}
                      >
                        <DotsIcon className="h-[0.33rem] w-[1.3125rem]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={wz.menu}>
                      <DropdownMenuItem
                        className={wz.menuItem}
                        onSelect={() => {
                          openPopup({ kind: 'rename', entry })
                        }}
                      >
                        <Pencil className="size-[1.125rem] text-[#844EFF]" strokeWidth={2} />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className={wz.menuItem}
                        onSelect={() => {
                          openPopup({ kind: 'delete', entry })
                        }}
                      >
                        <Trash2 className="size-[1.125rem] text-[#FF6640]" strokeWidth={2} />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
            {shown.length === 0 && (
              <li className="py-3 text-center text-base text-[#5D5D5D]">No templates match.</li>
            )}
          </ul>
          <div className="mx-[1.25rem] mt-3 border-t-[2.5px] border-black/8" />
          <div className="px-[0.9375rem] pt-3 pb-[0.9375rem]">
            <button
              type="button"
              onClick={() => {
                openPopup({ kind: 'new' })
              }}
              className="flex h-[3.5625rem] w-full items-center justify-center gap-2 rounded-md bg-[#7127EA] px-4 text-base leading-[1.6875rem] font-medium text-white transition-colors hover:bg-[#5f1fd0] focus-visible:ring-2 focus-visible:ring-[#A181FF] focus-visible:ring-offset-2 focus-visible:outline-none sm:text-[1.125rem]"
            >
              <PlusIcon className="size-[0.9rem]" />
              Add New Template
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <TemplateNameDialog
        open={popup?.kind === 'new' || popup?.kind === 'rename'}
        onOpenChange={(next) => {
          if (!next) setPopup(null)
        }}
        title={popup?.kind === 'rename' ? 'Rename' : 'New Template'}
        label={popup?.kind === 'rename' ? 'Status Template Name' : 'Name'}
        initialName={popup?.kind === 'rename' ? popup.entry.name : ''}
        validate={(name) => {
          const result = checkTemplateName(
            templates,
            name,
            popup?.kind === 'rename' ? popup.entry.id : undefined,
          )
          return 'error' in result ? result.error : null
        }}
        onSave={(name) => {
          if (popup?.kind === 'rename') onRename(popup.entry.id, name)
          else onAdd(name)
        }}
        returnFocus={returnFocus}
      />
      <ConfirmDialog
        open={popup?.kind === 'delete'}
        onOpenChange={(next) => {
          if (!next) setPopup(null)
        }}
        title="Delete Template"
        message={`Are you sure you want to delete the “${popup?.kind === 'delete' ? popup.entry.name : ''}” status template?`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (popup?.kind === 'delete') onDelete(popup.entry.id)
        }}
        returnFocus={returnFocus}
      />
    </>
  )
}
