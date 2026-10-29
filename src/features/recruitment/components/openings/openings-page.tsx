import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  btn,
  ListFooter,
  PayrollCard,
  payrollTableClass,
  SearchSelect,
  StatusChip,
  toolbarButton,
} from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import type { OpeningAction } from '../../api/recruitment.api'
import { OPENING_STATUS_META, RC_CODES, RC_PAGE_SIZE } from '../../constants'
import { useOrgOptions } from '../../hooks/use-lookups'
import { useDeleteOpening, useOpeningAction, useOpenings } from '../../hooks/use-recruitment'
import type { OpeningsSearch } from '../../routing'
import { type Opening, OPENING_STATUSES } from '../../types/recruitment.types'
import { formatDay } from '../../utils/format'
import {
  FilterBar,
  FilterField,
  ListError,
  SearchBox,
  StatusFilterChips,
} from '../shared/list-parts'
import { OpeningDetailDialog } from './opening-detail-dialog'
import { OpeningFormDialog } from './opening-form-dialog'

const routeApi = getRouteApi('/_app/recruitment/openings')

type Confirm = { kind: 'delete' | 'close'; opening: Opening } | null

/**
 * Job Openings: the status chips (All, Draft, Open, On Hold, Closed), search and the department,
 * branch and job title filters over the list; each row's ⋮ has View, Edit and the steps its status
 * allows (Publish, Hold, Close, Reopen, Delete). The filters, page, open record and form live in
 * the URL.
 */
export function OpeningsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(RC_CODES.openingsCreate)
  const canEdit = useCan(RC_CODES.openingsEdit)
  const canDelete = useCan(RC_CODES.openingsDelete)
  const canPublish = useCan(RC_CODES.openingsPublish)
  const canHold = useCan(RC_CODES.openingsHold)
  const canClose = useCan(RC_CODES.openingsClose)
  const canReopen = useCan(RC_CODES.openingsReopen)
  const org = useOrgOptions(['departments', 'branches', 'job-titles'])
  const [confirm, setConfirm] = useState<Confirm>(null)
  const step = useOpeningAction()
  const remove = useDeleteOpening()

  const list = useOpenings({
    q: search.q,
    status: search.status,
    departmentId: search.departmentId,
    branchId: search.branchId,
    jobTitleId: search.jobTitleId,
    page: search.page,
    pageSize: RC_PAGE_SIZE,
  })

  const update = (patch: Partial<OpeningsSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  const filter = (patch: Partial<OpeningsSearch>) => {
    update({ ...patch, page: 1 })
  }
  const active = [search.q, search.departmentId, search.branchId, search.jobTitleId].filter(
    Boolean,
  ).length

  const run = (opening: Opening, action: OpeningAction) => {
    step.mutate({ record: opening, action })
  }

  /** What a user may do with an opening in its status. */
  const actionsFor = (opening: Opening): RowAction[] => {
    const items: RowAction[] = []
    if (canEdit && opening.status !== 'closed') {
      items.push({
        label: 'Edit',
        onSelect: () => {
          update({ edit: opening.id, view: undefined })
        },
      })
    }
    if (canPublish && opening.status === 'draft') {
      items.push({
        label: 'Publish',
        onSelect: () => {
          run(opening, 'publish')
        },
      })
    }
    if (canHold && opening.status === 'open') {
      items.push({
        label: 'Hold',
        onSelect: () => {
          run(opening, 'hold')
        },
      })
    }
    if (canReopen && (opening.status === 'on_hold' || opening.status === 'closed')) {
      items.push({
        label: 'Reopen',
        onSelect: () => {
          run(opening, 'reopen')
        },
      })
    }
    if (canClose && (opening.status === 'open' || opening.status === 'on_hold')) {
      items.push({
        // Not "Close": the detail dialog has its own Close button.
        label: 'Close opening',
        variant: 'destructive',
        onSelect: () => {
          setConfirm({ kind: 'close', opening })
        },
      })
    }
    if (canDelete && opening.applicationCount === 0) {
      items.push({
        label: 'Delete',
        variant: 'destructive',
        onSelect: () => {
          setConfirm({ kind: 'delete', opening })
        },
      })
    }
    return items
  }

  const columns: DataTableColumn<Opening>[] = [
    { id: 'code', header: 'Code', className: 'w-24', cell: (row) => row.code },
    {
      id: 'title',
      header: 'Opening',
      mobile: 'heading',
      className: 'min-w-48 whitespace-normal',
      cell: (row) => (
        <span className="grid">
          <button
            type="button"
            onClick={() => {
              update({ view: row.id })
            }}
            className="w-fit rounded-sm text-left font-medium text-heading underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {row.title}
          </button>
          <span className="text-xs text-muted-foreground">
            {[row.departmentName, row.branchName].filter(Boolean).join(' · ') || '—'}
          </span>
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusChip {...OPENING_STATUS_META[row.status]} />,
    },
    {
      id: 'vacancies',
      header: 'Hired / Vacancies',
      align: 'center',
      cell: (row) => `${String(row.hiredCount)} / ${String(row.vacancies)}`,
    },
    {
      id: 'applications',
      header: 'Applications',
      align: 'center',
      cell: (row) => (
        <span title={`${String(row.activeApplicationCount)} still in the pipeline`}>
          {row.applicationCount}
          <span className="text-xs text-muted-foreground">
            {' '}
            ({row.activeApplicationCount} active)
          </span>
        </span>
      ),
    },
    { id: 'applyBy', header: 'Apply By', cell: (row) => formatDay(row.applyBy) },
    {
      id: 'manager',
      header: 'Hiring Manager',
      className: 'whitespace-normal',
      cell: (row) => row.hiringManagerName ?? '—',
    },
  ]

  const closeDialog = () => {
    update({ view: undefined, edit: undefined, dialog: undefined })
  }

  return (
    <PayrollCard
      title="Job Openings"
      actions={
        canCreate && (
          <Button
            onClick={() => {
              update({ dialog: 'create', edit: undefined, view: undefined })
            }}
            className={cn(toolbarButton, btn.navy)}
          >
            + New Opening
          </Button>
        )
      }
    >
      <StatusFilterChips
        label="Opening status"
        options={OPENING_STATUSES.map((value) => ({
          value,
          label: OPENING_STATUS_META[value].label,
        }))}
        value={search.status}
        onChange={(status) => {
          filter({ status })
        }}
      />
      <FilterBar
        label="Filter openings"
        active={active}
        onClear={() => {
          filter({
            q: undefined,
            departmentId: undefined,
            branchId: undefined,
            jobTitleId: undefined,
          })
        }}
      >
        <FilterField label="Search">
          {(id) => (
            <SearchBox
              key={search.q ?? ''}
              id={id}
              value={search.q}
              label="Search openings"
              placeholder="Title or code"
              onSearch={(q) => {
                filter({ q })
              }}
            />
          )}
        </FilterField>
        <FilterField label="Department">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.departmentId ?? null}
              onChange={(value) => {
                filter({ departmentId: value ?? undefined })
              }}
              options={org.departments}
              placeholder="All departments"
              clearable
            />
          )}
        </FilterField>
        <FilterField label="Branch">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.branchId ?? null}
              onChange={(value) => {
                filter({ branchId: value ?? undefined })
              }}
              options={org.branches}
              placeholder="All branches"
              clearable
            />
          )}
        </FilterField>
        <FilterField label="Job Title">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.jobTitleId ?? null}
              onChange={(value) => {
                filter({ jobTitleId: value ?? undefined })
              }}
              options={org['job-titles']}
              placeholder="All job titles"
              clearable
            />
          )}
        </FilterField>
      </FilterBar>

      {list.isError ? (
        <ListError error={list.error} what="job openings" onRetry={() => void list.refetch()} />
      ) : (
        <div className="relative min-w-0 overflow-x-auto">
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Job openings"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={payrollTableClass}
            emptyState={
              active > 0 || search.status
                ? 'No openings match the filters.'
                : 'No job openings yet. New Opening drafts the first one.'
            }
            rowActionsHeader="Actions"
            rowActions={(row) => (
              <RowActionsMenu
                label={`Actions for ${row.code}, ${row.title}`}
                itemClassName={rowMenuItemClass.inter}
                actions={[
                  {
                    label: 'View',
                    onSelect: () => {
                      update({ view: row.id })
                    },
                  },
                  ...actionsFor(row),
                ]}
              />
            )}
          />
        </div>
      )}
      <ListFooter
        meta={list.data?.meta}
        noun="openings"
        disabled={list.isFetching}
        onPageChange={(page) => {
          update({ page })
        }}
      />

      {search.view && (
        <OpeningDetailDialog id={search.view} onClose={closeDialog} actionsFor={actionsFor} />
      )}
      {(search.dialog === 'create' || search.edit) && (
        <OpeningFormDialog
          id={search.edit ?? null}
          onClose={closeDialog}
          onSaved={(saved) => {
            if (search.edit) closeDialog()
            else update({ dialog: undefined, view: saved.id })
          }}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={confirm?.kind === 'delete' ? 'Delete opening' : 'Close opening'}
        description={
          confirm?.kind === 'delete'
            ? `Delete ${confirm.opening.title}? This cannot be undone.`
            : `Close ${confirm?.opening.title ?? 'this opening'}? It stops taking applications; you can reopen it later.`
        }
        confirmLabel={confirm?.kind === 'delete' ? 'Delete' : 'Close opening'}
        variant="destructive"
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === 'delete') {
            remove.mutate(confirm.opening, {
              onSuccess: () => {
                if (search.view === confirm.opening.id) closeDialog()
              },
            })
          } else {
            run(confirm.opening, 'close')
          }
          setConfirm(null)
        }}
      />
    </PayrollCard>
  )
}
