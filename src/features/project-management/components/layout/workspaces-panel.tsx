import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { PanelLeft, Star } from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useCreateItem, useWorkspaceTree } from '../../hooks/use-pm'
import type { Workspace, WorkspaceItem, WorkspaceItemKind } from '../../types/pm.types'
import {
  PanelCaretIcon,
  PanelDocIcon,
  PanelDotsIcon,
  PanelListIcon,
  PanelPlusIcon,
  PanelSearchIcon,
} from './panel-icons'

interface WorkspacesPanelProps {
  workspaceId: string | null
  listId: string | null
  onCreate: () => void
}

/** Neutrals Color 1/700, Poppins Medium 13.6 (workspace) and 12.9 (folders, lists, docs). */
const rowText = 'truncate font-medium text-[#4F4F4F]'
const squareButton =
  'flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(132,78,255,0.1)] text-[#7127EA] transition-colors hover:bg-[rgba(132,78,255,0.18)]'

const NEW_ITEM_LABELS: Record<WorkspaceItemKind, string> = {
  folder: 'New Folder',
  list: 'New List',
  doc: 'New Doc',
}

/**
 * The Workspaces panel (Workspace Navigation 411:146521, Workspace Page 1:2755): search, the
 * "+" that opens Create Workspace, Favorites, and each workspace with its folders, lists and docs.
 */
export function WorkspacesPanel({ workspaceId, listId, onCreate }: WorkspacesPanelProps) {
  const { data, isPending, isError } = useWorkspaceTree()
  const createItem = useCreateItem()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())

  const query = search.trim().toLowerCase()
  const items = useMemo(() => data?.items ?? [], [data])
  const workspaces = useMemo(() => {
    const all = data?.workspaces ?? []
    if (!query) return all
    return all.filter(
      (workspace) =>
        workspace.name.toLowerCase().includes(query) ||
        items.some(
          (item) => item.workspaceId === workspace.id && item.name.toLowerCase().includes(query),
        ),
    )
  }, [data, items, query])
  const favorites = workspaces.filter((workspace) => workspace.favorite)
  const current = workspaces.find((workspace) => workspace.id === workspaceId)

  const toggle = (id: string) => {
    setClosed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addItem = (kind: WorkspaceItemKind) => {
    if (!current) return
    const label = NEW_ITEM_LABELS[kind]
    const taken = items.filter(
      (item) => item.workspaceId === current.id && item.name.startsWith(label),
    ).length
    const name = `${label} ${taken + 1}`
    createItem.mutate(
      { workspaceId: current.id, input: { kind, name, parentId: null } },
      { onSuccess: () => toast.success(`${name} added to ${current.name}`) },
    )
  }

  if (collapsed) {
    return (
      <aside aria-label="Workspaces" className="flex shrink-0 justify-start lg:w-12">
        <button
          type="button"
          onClick={() => {
            setCollapsed(false)
          }}
          aria-label="Show workspaces"
          className="flex size-10 items-center justify-center rounded-lg bg-white text-[#5D5D5D] shadow-xs"
        >
          <PanelLeft className="size-4" />
        </button>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Workspaces"
      className="flex shrink-0 flex-col rounded-[1.625rem] bg-white p-2.5 shadow-xs lg:max-h-[calc(100dvh-8rem)] lg:w-[18.75rem]"
    >
      <div className="flex items-center justify-between pt-2.5 pl-2.5">
        <h2 className="text-base leading-6 font-medium text-[#4F4F4F]">Workspaces</h2>
        <button
          type="button"
          onClick={() => {
            setCollapsed(true)
          }}
          aria-label="Hide workspaces"
          className="flex size-7 items-center justify-center rounded-[0.55rem] bg-[#F7F7F7] text-[#5D5D5D] hover:bg-[#ececec]"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="flex h-[1.875rem] min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-2 shadow-[0_0_12.95px_rgba(0,0,0,0.12)]">
          <PanelSearchIcon className="size-[0.85rem] shrink-0 text-[#A181FF]" />
          <span className="sr-only">Search workspaces</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
            placeholder="Search here..."
            className="min-w-0 flex-1 bg-transparent text-xs tracking-[0.014em] text-[#4F4F4F] outline-none placeholder:text-[#909090]"
          />
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onCreate}
              aria-label="Create Workspace"
              className={squareButton}
            >
              <PanelPlusIcon className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="rounded-full bg-[#282828] px-4 text-[0.6rem] text-white">
            Create Workspace
          </TooltipContent>
        </Tooltip>
      </div>

      {current && (
        <div className="mt-3 flex justify-end gap-2 pr-[0.875rem]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Workspace tree options" className={squareButton}>
                <PanelDotsIcon className="h-1 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setClosed(new Set())
                }}
              >
                Expand all
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setClosed(
                    new Set([
                      current.id,
                      ...items.filter((i) => i.kind === 'folder').map((i) => i.id),
                    ]),
                  )
                }}
              >
                Collapse all
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Add to ${current.name}`} className={squareButton}>
                <PanelPlusIcon className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  addItem('folder')
                }}
              >
                Folder
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  addItem('list')
                }}
              >
                List
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  addItem('doc')
                }}
              >
                Doc
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav
        aria-label="Workspace tree"
        className="mt-3 flex min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:#7127EA_transparent] flex-col gap-1.5 overflow-y-auto pr-2"
      >
        {favorites.length > 0 && (
          <div className="mb-1">
            <button
              type="button"
              onClick={() => {
                setFavoritesOpen((open) => !open)
              }}
              aria-expanded={favoritesOpen}
              className="flex w-full items-center gap-2.5 rounded-[0.72rem] px-2.5 py-2 text-left hover:bg-[#F7F2FF]"
            >
              <Star className="size-4 fill-[#F79009] text-[#F79009]" aria-hidden="true" />
              <span className={cn(rowText, 'flex-1 text-[0.85rem]')}>Favorites</span>
              <PanelCaretIcon
                className={cn(
                  'h-[0.45rem] w-3 text-[#7127EA] transition-transform',
                  !favoritesOpen && '-rotate-90',
                )}
              />
            </button>
            {favoritesOpen &&
              favorites.map((workspace) => (
                <WorkspaceLink
                  key={`fav-${workspace.id}`}
                  workspace={workspace}
                  current={workspace.id === workspaceId && !listId}
                  className="ml-3"
                />
              ))}
          </div>
        )}

        {isPending && <p className="px-3 py-2 text-xs text-[#909090]">Loading workspaces…</p>}
        {isError && (
          <p role="alert" className="px-3 py-2 text-xs text-[#B7192C]">
            Could not load the workspaces.
          </p>
        )}
        {!isPending && !isError && workspaces.length === 0 && (
          <p className="px-3 py-2 text-xs text-[#909090]">
            {query ? 'No workspace matches your search.' : 'No workspaces yet.'}
          </p>
        )}

        {workspaces.map((workspace) => {
          const open = workspace.id === workspaceId && !closed.has(workspace.id)
          const own = items.filter((item) => item.workspaceId === workspace.id)
          return (
            <div key={workspace.id}>
              <WorkspaceLink
                workspace={workspace}
                current={workspace.id === workspaceId && !listId}
                expanded={open}
                onToggle={
                  workspace.id === workspaceId
                    ? () => {
                        toggle(workspace.id)
                      }
                    : undefined
                }
              />
              {open && (
                <ItemTree
                  workspaceId={workspace.id}
                  items={own}
                  parentId={null}
                  listId={listId}
                  closed={closed}
                  onToggle={toggle}
                />
              )}
            </div>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={onCreate}
        className="mt-3 flex h-[4.5rem] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#A181FF] bg-[#F0E9FD] text-sm font-medium text-[#7127EA] hover:bg-[#e6dafc]"
      >
        <span className="flex items-center gap-1.5">
          <PanelPlusIcon className="size-3" /> Create
        </span>
        Workspace
      </button>
    </aside>
  )
}

function WorkspaceLink({
  workspace,
  current,
  expanded,
  onToggle,
  className,
}: {
  workspace: Workspace
  current: boolean
  expanded?: boolean
  onToggle?: (() => void) | undefined
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center rounded-[0.72rem]',
        current || expanded ? 'bg-[#EEE7FF]' : 'hover:bg-[#F7F2FF]',
        className,
      )}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${workspace.name}` : `Expand ${workspace.name}`}
          aria-expanded={expanded}
          className="flex size-10 shrink-0 items-center justify-center rounded-[0.72rem] text-[#7127EA]"
        >
          <PanelCaretIcon
            className={cn('h-[0.45rem] w-3 transition-transform', !expanded && '-rotate-90')}
          />
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center text-[#7127EA]"
        >
          <PanelCaretIcon className="h-[0.45rem] w-3 -rotate-90" />
        </span>
      )}
      <Link
        to="/project-management/workspaces/$workspaceId"
        params={{ workspaceId: workspace.id }}
        aria-current={current ? 'page' : undefined}
        className={cn(rowText, 'min-w-0 flex-1 py-2.5 pr-2.5 text-[0.85rem] leading-5')}
      >
        {workspace.name}
      </Link>
    </div>
  )
}

function ItemTree({
  workspaceId,
  items,
  parentId,
  listId,
  closed,
  onToggle,
}: {
  workspaceId: string
  items: readonly WorkspaceItem[]
  parentId: string | null
  listId: string | null
  closed: ReadonlySet<string>
  onToggle: (id: string) => void
}) {
  const level = items.filter((item) => item.parentId === parentId)
  if (level.length === 0) return null
  return (
    <ul className="mt-1.5 ml-[1.15rem] flex flex-col gap-1.5 border-l-2 border-[#EEE7FF] pl-2">
      {level.map((item) => {
        if (item.kind === 'folder') {
          const open = !closed.has(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onToggle(item.id)
                }}
                aria-expanded={open}
                className="flex w-full items-center rounded-[0.72rem] bg-[#EEE7FF] pr-2.5 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center text-[#7127EA]">
                  <PanelCaretIcon
                    className={cn('h-[0.45rem] w-3 transition-transform', !open && '-rotate-90')}
                  />
                </span>
                <span className={cn(rowText, 'flex-1 py-2 text-[0.8rem] leading-[1.2rem]')}>
                  {item.name}
                </span>
              </button>
              {open && (
                <ItemTree
                  workspaceId={workspaceId}
                  items={items}
                  parentId={item.id}
                  listId={listId}
                  closed={closed}
                  onToggle={onToggle}
                />
              )}
            </li>
          )
        }
        const current = item.id === listId
        const tile = (
          <span className="flex size-[1.9rem] shrink-0 items-center justify-center rounded-[0.48rem] bg-white">
            {item.kind === 'list' ? (
              <PanelListIcon className="h-3 w-[1.3rem] text-[#2E64E2]" />
            ) : (
              <PanelDocIcon className="h-[1.2rem] w-4 text-[#2F639A]" />
            )}
          </span>
        )
        return (
          <li key={item.id}>
            {item.kind === 'list' ? (
              <Link
                to="/project-management/workspaces/$workspaceId"
                params={{ workspaceId }}
                search={{ list: item.id }}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-[0.48rem] p-1.5',
                  current ? 'bg-[#EEE7FF]' : 'bg-[#F7F7F7] hover:bg-[#F0E9FD]',
                )}
              >
                {tile}
                <span className={cn(rowText, 'text-[0.8rem] leading-[1.2rem]')}>{item.name}</span>
              </Link>
            ) : (
              <div
                title="Docs have no screen in the design yet"
                className="flex items-center gap-2.5 rounded-[0.48rem] bg-[#F7F7F7] p-1.5"
              >
                {tile}
                <span className={cn(rowText, 'text-[0.8rem] leading-[1.2rem]')}>{item.name}</span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
