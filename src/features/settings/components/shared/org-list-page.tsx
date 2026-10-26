import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { type DataTableColumn, PaginatedTableCard, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'
import { cn } from '@/lib/utils'

import type { OrgListParams, OrgResource } from '../../api/org-resource'
import { useOrgPermissions } from '../../hooks/use-org-permissions'
import { useDeleteOrgRecord, useOrgList } from '../../hooks/use-org-records'
import { capitalize } from '../../utils/text'
import { settingsType } from './type-styles'

interface AnyRecord {
  id: string
  name: string
  rowVersion: string
}

/** List state kept in the URL: `?page=2&pageSize=10&q=lah`. */
export interface OrgListSearch {
  page: number
  pageSize: number
  q?: string | undefined
}

interface OrgListPageProps<TRecord extends AnyRecord, TInput, TRow extends AnyRecord> {
  resource: OrgResource<TRecord, TInput, TRow>
  /** Card title, e.g. "Branches". */
  title: string
  search: OrgListSearch
  /** Writes list state to the URL; any change other than `page` goes back to page 1. */
  onSearchChange: (patch: Partial<OrgListSearch>) => void
  /** Extra API filters (location) chosen in `filters`. */
  filterParams?: Omit<OrgListParams, 'page' | 'pageSize' | 'search'>
  /** Filter selects shown beside the search box. */
  filters?: ReactNode
  /** Columns after "Sr#". */
  columns: readonly DataTableColumn<TRow>[]
  addLink: LinkProps
  onEdit: (row: TRow) => void
  /** Extra sentence in the delete dialog, e.g. what else depends on the record. */
  deleteHint?: string
}

/**
 * A Control Panel list (not in the designs, built from the Warning list
 * card): search by name, optional filters, "+ Add", a paged table and
 * Edit / Delete row actions with a confirmation.
 */
export function OrgListPage<TRecord extends AnyRecord, TInput, TRow extends AnyRecord>({
  resource,
  title,
  search,
  onSearchChange,
  filterParams,
  filters,
  columns,
  addLink,
  onEdit,
  deleteHint,
}: OrgListPageProps<TRecord, TInput, TRow>) {
  const { page, pageSize, q = '' } = search
  const query = useOrgList(resource, { page, pageSize, search: q, ...filterParams })
  const deleteMutation = useDeleteOrgRecord(resource)
  const { canCreate, canEdit, canDelete } = useOrgPermissions(resource)
  const [pendingDelete, setPendingDelete] = useState<TRow | null>(null)

  // The box updates at once; the URL (and the request) follow when typing pauses.
  const [text, setText] = useState(q)
  const searchTimer = useRef<number | undefined>(undefined)
  const [urlQuery, setUrlQuery] = useState(q)
  if (q !== urlQuery) {
    // The URL changed from outside (menu link, back button): show its value.
    setUrlQuery(q)
    if (q !== text.trim()) setText(q)
  }
  useEffect(
    () => () => {
      window.clearTimeout(searchTimer.current)
    },
    [],
  )
  const onSearchInput = (value: string) => {
    setText(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => {
      onSearchChange({ q: value.trim() || undefined })
    }, 300)
  }
  const filtered = q !== '' || Object.values(filterParams ?? {}).some(Boolean)

  const singular = capitalize(resource.singular)
  const offset = ((query.data?.meta.page ?? page) - 1) * (query.data?.meta.pageSize ?? pageSize)
  const allColumns: DataTableColumn<TRow>[] = [
    {
      id: 'sr',
      header: 'Sr#',
      cell: (_row, index) => offset + index + 1,
      className: 'w-16',
      mobile: 'hidden',
    },
    ...columns,
  ]

  return (
    <>
      <PaginatedTableCard
        title={title}
        titleAs="h1"
        className={cn('rounded-xl', settingsType.listCard)}
        caption={capitalize(resource.plural)}
        actions={
          canCreate ? (
            <Button asChild variant="outline">
              <Link {...addLink}>
                <Plus /> Add {singular}
              </Link>
            </Button>
          ) : undefined
        }
        toolbar={
          <>
            <div className="relative w-full @lg:w-64">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
              />
              <Input
                type="search"
                aria-label={`Search ${resource.plural}`}
                placeholder="Search by name"
                value={text}
                onChange={(event) => {
                  onSearchInput(event.target.value)
                }}
                className="pl-9 sm:pl-9"
              />
            </div>
            {filters}
          </>
        }
        columns={allColumns}
        result={query}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={(next) => {
          onSearchChange({ page: next })
        }}
        onPageSizeChange={(next) => {
          onSearchChange({ pageSize: next })
        }}
        getRowId={(row) => row.id}
        emptyState={
          filtered
            ? `No ${resource.plural} match these filters.`
            : canCreate
              ? `No ${resource.plural} yet. Use “Add ${singular}” to create one.`
              : `No ${resource.plural} yet.`
        }
        rowActions={
          canEdit || canDelete
            ? (row) => (
                <RowActionsMenu
                  label={`Actions for ${row.name}`}
                  itemClassName={settingsType.rowMenuItem}
                  actions={[
                    ...(canEdit
                      ? [
                          {
                            label: 'Edit',
                            icon: Pencil,
                            onSelect: () => {
                              onEdit(row)
                            },
                          },
                        ]
                      : []),
                    ...(canDelete
                      ? [
                          {
                            label: 'Delete',
                            icon: Trash2,
                            variant: 'destructive' as const,
                            onSelect: () => {
                              setPendingDelete(row)
                            },
                          },
                        ]
                      : []),
                  ]}
                />
              )
            : undefined
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={`Delete this ${resource.singular}?`}
        description={
          <>
            “{pendingDelete?.name}” will be removed. {deleteHint ?? 'This cannot be undone.'}
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
