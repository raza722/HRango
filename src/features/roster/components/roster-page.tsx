import { type ComponentType, useEffect, useRef, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Eye, PersonStanding, Plus, Search, SquarePen, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn, PageContainer, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  useDeleteRosterGroup,
  useRosterGroups,
  useSetRosterGroupStatus,
} from '../hooks/use-roster-groups'
import type { RosterGroupRow } from '../types/roster.types'
import { EnrollmentDialog } from './enrollment-dialog'
import { RosterGroupDialog } from './roster-group-dialog'
import { EntriesSelect, PageSummary } from './table-controls'
import { rosterType } from './type-styles'

const routeApi = getRouteApi('/_app/roster')

interface IconActionProps {
  label: string
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  /** Icon colour from the design (blue edit, green enroll, orange view, red delete). */
  tone: string
  onClick: () => void
}

function IconAction({ label, icon: Icon, tone, onClick }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={onClick}>
          <Icon className={cn('size-5.5', tone)} strokeWidth={2} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label.split(' ')[0]}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Roster: the roster groups (purple table, as drawn) with Add New, search,
 * "Show n entries", a Status switch per row and Edit / Enroll / View / Delete.
 * The modals are driven by the URL (`?dialog=edit&id=…`), so Back closes them.
 */
export function RosterPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { page, pageSize, q = '', dialog, id } = search
  const query = useRosterGroups({ page, pageSize, search: q })
  const setStatus = useSetRosterGroupStatus()
  const deleteGroup = useDeleteRosterGroup()
  const [pendingDelete, setPendingDelete] = useState<RosterGroupRow | null>(null)

  const update = (patch: Partial<typeof search>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })
  const openDialog = (next: NonNullable<typeof dialog>, groupId?: string) => {
    void update({ dialog: next, id: groupId })
  }
  const closeDialog = () => {
    void update({ dialog: undefined, id: undefined })
  }

  // The box updates at once; the URL (and the request) follow when typing pauses.
  const [text, setText] = useState(q)
  const [urlQuery, setUrlQuery] = useState(q)
  if (q !== urlQuery) {
    setUrlQuery(q)
    if (q !== text.trim()) setText(q)
  }
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(searchTimer.current)
    },
    [],
  )

  const meta = query.data?.meta
  const lastPage = meta?.totalPages
  useEffect(() => {
    if (lastPage !== undefined && !query.isPlaceholderData && page > lastPage) {
      void navigate({ search: (prev) => ({ ...prev, page: lastPage }), replace: true })
    }
  }, [lastPage, page, query.isPlaceholderData, navigate])

  const offset = ((meta?.page ?? page) - 1) * (meta?.pageSize ?? pageSize)
  const columns: DataTableColumn<RosterGroupRow>[] = [
    {
      id: 'sr',
      header: '#',
      align: 'center',
      cell: (_row, index) => <span className={rosterType.rowNumber}>{offset + index + 1}</span>,
      className: 'w-16',
      mobile: 'hidden',
    },
    {
      id: 'title',
      header: 'Group Title',
      align: 'center',
      mobile: 'heading',
      cell: (row) => row.title,
    },
    {
      id: 'enrolled',
      header: 'Employee Enrolled',
      align: 'center',
      cell: (row) => <span className="tabular-nums">{row.enrolledCount}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => (
        <Switch
          aria-label={`${row.title} is active`}
          checked={row.isActive}
          onCheckedChange={(isActive) => {
            setStatus.mutate({ group: row, isActive })
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      align: 'center',
      className: 'w-52',
      cell: (row) => (
        <div className="inline-flex items-center gap-1 md:justify-center">
          <IconAction
            label={`Edit ${row.title}`}
            icon={SquarePen}
            tone="text-blue-500"
            onClick={() => {
              openDialog('edit', row.id)
            }}
          />
          <IconAction
            label={`Enroll employees in ${row.title}`}
            icon={PersonStanding}
            tone="text-emerald-500"
            onClick={() => {
              openDialog('enroll', row.id)
            }}
          />
          <IconAction
            label={`View ${row.title}`}
            icon={Eye}
            tone="text-orange-500"
            onClick={() => {
              openDialog('view', row.id)
            }}
          />
          <IconAction
            label={`Delete ${row.title}`}
            icon={Trash2}
            tone="text-red-500"
            onClick={() => {
              setPendingDelete(row)
            }}
          />
        </div>
      ),
    },
  ]

  return (
    <PageContainer>
      <header className="@container grid gap-4 rounded-md bg-card px-4 py-5 font-inter shadow-xs sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl leading-tight font-medium text-heading">Roster</h1>
          <div className="flex w-full flex-wrap items-center gap-3 @lg:w-auto">
            <div className="relative min-w-0 flex-1 @lg:w-56 @lg:flex-none">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
              />
              <Input
                type="search"
                aria-label="Search roster groups"
                placeholder="Search"
                value={text}
                onChange={(event) => {
                  const value = event.target.value
                  setText(value)
                  window.clearTimeout(searchTimer.current)
                  searchTimer.current = window.setTimeout(() => {
                    void update({ q: value.trim() || undefined, page: 1 }, true)
                  }, 300)
                }}
                className="pl-9 placeholder:text-field-value sm:pl-9"
              />
            </div>
            <Button
              onClick={() => {
                openDialog('add')
              }}
              className={rosterType.button}
            >
              <Plus /> Add New
            </Button>
          </div>
        </div>
        <EntriesSelect
          value={pageSize}
          label="Roster groups per page"
          onChange={(size) => {
            void update({ pageSize: size, page: 1 }, true)
          }}
        />
      </header>

      <Card className="font-inter">
        <CardContent className="grid gap-5 pt-4 sm:pt-5">
          {query.error && !query.data ? (
            <ErrorState
              message={query.error.message}
              onRetry={() => {
                void query.refetch()
              }}
              className="shadow-none"
            />
          ) : (
            <DataTable
              caption="Roster groups"
              appearance="brand"
              className={rosterType.groupTable}
              columns={columns}
              data={query.data?.data ?? []}
              getRowId={(row) => row.id}
              isLoading={query.isPending}
              isFetching={query.isFetching}
              loadingRowCount={5}
              emptyState={
                q ? 'No roster group matches that search.' : 'No roster groups yet. Use “Add New”.'
              }
            />
          )}
          <div className="flex flex-col-reverse items-center justify-between gap-3 @lg:flex-row">
            <PageSummary meta={meta} rowCount={query.data?.data.length ?? 0} />
            <Pagination
              page={meta?.page ?? page}
              totalPages={meta?.totalPages ?? 1}
              onPageChange={(next) => {
                void update({ page: next })
              }}
              disabled={query.isPending}
              currentClassName={rosterType.pagerCurrent}
            />
          </div>
        </CardContent>
      </Card>

      {(dialog === 'add' || ((dialog === 'edit' || dialog === 'view') && id)) && (
        <RosterGroupDialog
          key={`${dialog}-${id ?? 'new'}`}
          mode={dialog}
          groupId={id}
          onClose={closeDialog}
          onEdit={(groupId) => {
            openDialog('edit', groupId)
          }}
        />
      )}
      {dialog === 'enroll' && id && <EnrollmentDialog groupId={id} onClose={closeDialog} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete this roster group?"
        description={
          <>
            “{pendingDelete?.title}” will be removed. A group that still has enrolled employees
            cannot be deleted.
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (pendingDelete) deleteGroup.mutate(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </PageContainer>
  )
}
