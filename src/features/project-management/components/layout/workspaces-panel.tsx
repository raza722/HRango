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

import { useCreateItem, useWorkspace, useWorkspaceTree } from '../../hooks/use-pm'
import { usePmAccess } from '../../hooks/use-pm-access'
import type { WorkspaceItem, WorkspaceItemKind, WorkspaceSummary } from '../../types/pm.types'
import {
  PanelCaretIcon,
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

/** Neutrals Color 1/700, Poppins Medium 13.6 (workspace) and 12.9 (folders and lists). */
const rowText = 'truncate font-medium text-[#4F4F4F] dark:text-title'
const squareButton =
  'flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(132,78,255,0.1)] text-[#7127EA] dark:text-[#C4ABFF] transition-colors hover:bg-[rgba(132,78,255,0.18)]'

const NEW_ITEM_LABELS: Record<WorkspaceItemKind, string> = {
  folder: 'New Folder',
  list: 'New List',
}

/**
 * The Workspaces panel (Workspace Navigation 411:146521, Workspace Page 1:2755): search, the
 * "+" that opens Create Workspace, Favorites, and each workspace with its folders and lists.
 */
export function WorkspacesPanel({ workspaceId, listId, onCreate }: WorkspacesPanelProps) {
  const { data, isPending, isError } = useWorkspaceTree()
  const open = useWorkspace(workspaceId)
  const access = usePmAccess(open.data)
  const createItem = useCreateItem()
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())

  const query = search.trim().toLowerCase()
  // Folders and lists are read for the open workspace (`GET /workspaces/{id}`).
  const items = useMemo(() => open.data?.items ?? [], [open.data])
  const workspaces = useMemo(() => {
    const all = (data?.workspaces ?? []).filter((workspace) => !workspace.hidden)
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
          className="flex size-10 items-center justify-center rounded-lg bg-white text-[#5D5D5D] shadow-xs dark:bg-card dark:text-title"
        >
          <PanelLeft className="size-4" />
        </button>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Workspaces"
      className="flex shrink-0 flex-col rounded-[1.625rem] bg-white p-2.5 shadow-xs lg:max-h-[calc(100dvh-8rem)] lg:w-[18.75rem] dark:bg-card"
    >
      <div className="flex items-center justify-between pt-2.5 pl-2.5">
        <h2 className="text-base leading-6 font-medium text-[#4F4F4F] dark:text-title">
          Workspaces
        </h2>
        <button
          type="button"
          onClick={() => {
            setCollapsed(true)
          }}
          aria-label="Hide workspaces"
          className="flex size-7 items-center justify-center rounded-[0.55rem] bg-[#F7F7F7] text-[#5D5D5D] hover:bg-[#ececec] dark:bg-white/5 dark:text-title dark:hover:bg-white/10"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="flex h-[1.875rem] min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-2 shadow-[0_0_12.95px_rgba(0,0,0,0.12)] dark:bg-card">
          <PanelSearchIcon className="size-[0.85rem] shrink-0 text-[#A181FF]" />
          <span className="sr-only">Search workspaces</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
            placeholder="Search here..."
            className="min-w-0 flex-1 bg-transparent text-xs tracking-[0.014em] text-[#4F4F4F] outline-none placeholder:text-[#909090] dark:text-title"
          />
        </label>
        {access.createWorkspace && (
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
        )}
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
          {access.manageLists && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Add to ${current.name}`}
                  className={squareButton}
                >
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
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
              className="flex w-full items-center gap-2.5 rounded-[0.72rem] px-2.5 py-2 text-left hover:bg-[#F7F2FF] dark:hover:bg-[#7127EA]/15"
            >
              <Star className="size-4 fill-[#F79009] text-[#F79009]" aria-hidden="true" />
              <span className={cn(rowText, 'flex-1 text-[0.85rem]')}>Favorites</span>
              <PanelCaretIcon
                className={cn(
                  'h-[0.45rem] w-3 text-[#7127EA] transition-transform dark:text-[#C4ABFF]',
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
          <p role="alert" className="px-3 py-2 text-xs text-[#B7192C] dark:text-[#FF9AA3]">
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

      {access.createWorkspace && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 flex h-[4.5rem] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#A181FF] bg-[#F0E9FD] text-sm font-medium text-[#7127EA] hover:bg-[#e6dafc] dark:bg-[#7127EA]/20 dark:text-[#C4ABFF] dark:hover:bg-[#7127EA]/30"
        >
          <span className="flex items-center gap-1.5">
            <PanelPlusIcon className="size-3" /> Create
          </span>
          Workspace
        </button>
      )}
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
  workspace: WorkspaceSummary
  current: boolean
  expanded?: boolean
  onToggle?: (() => void) | undefined
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center rounded-[0.72rem]',
        current || expanded
          ? 'bg-[#EEE7FF] dark:bg-[#7127EA]/10'
          : 'hover:bg-[#F7F2FF] dark:hover:bg-[#7127EA]/15',
        className,
      )}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? `Collapse ${workspace.name}` : `Expand ${workspace.name}`}
          aria-expanded={expanded}
          className="flex size-10 shrink-0 items-center justify-center rounded-[0.72rem] text-[#7127EA] dark:text-[#C4ABFF]"
        >
          <PanelCaretIcon
            className={cn('h-[0.45rem] w-3 transition-transform', !expanded && '-rotate-90')}
          />
        </button>
      ) : (
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center text-[#7127EA] dark:text-[#C4ABFF]"
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
    <ul className="mt-1.5 ml-[1.15rem] flex flex-col gap-1.5 border-l-2 border-[#EEE7FF] pl-2 dark:border-border">
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
                className="flex w-full items-center rounded-[0.72rem] bg-[#EEE7FF] pr-2.5 text-left dark:bg-[#7127EA]/10"
              >
                <span className="flex size-10 shrink-0 items-center justify-center text-[#7127EA] dark:text-[#C4ABFF]">
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
          <span className="flex size-[1.9rem] shrink-0 items-center justify-center rounded-[0.48rem] bg-white dark:bg-card">
            <PanelListIcon className="h-3 w-[1.3rem] text-[#2E64E2] dark:text-[#8FB0FF]" />
          </span>
        )
        return (
          <li key={item.id}>
            <Link
              to="/project-management/workspaces/$workspaceId"
              params={{ workspaceId }}
              search={{ list: item.id }}
              activeOptions={{ exact: true }}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-[0.48rem] p-1.5',
                current
                  ? 'bg-[#EEE7FF] dark:bg-[#7127EA]/10'
                  : 'bg-[#F7F7F7] hover:bg-[#F0E9FD] dark:bg-white/5 dark:hover:bg-[#7127EA]/25',
              )}
            >
              {tile}
              <span className={cn(rowText, 'text-[0.8rem] leading-[1.2rem]')}>{item.name}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
