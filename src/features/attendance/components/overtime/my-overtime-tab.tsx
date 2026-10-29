import { useState } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { parseDateValue } from '@/lib/date'
import { useCan } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

import { useOvertimeRequests } from '../../hooks/use-overtime'
import { OVERTIME_STATUSES, type OvertimeApplication } from '../../types/overtime.types'
import { OVERTIME_STATUS_LABELS, serialLabel, stampLabel } from '../../utils/overtime-format'
import { overtimeNavyButtonClass, overtimeTableClass } from '../../utils/overtime-styles'
import { DateBox } from '../shared/date-box'
import { FilterSelect } from '../shared/filter-select'
import { ApplyOvertimeDialog } from './apply-overtime-dialog'
import { OvertimeCancelDialog } from './overtime-cancel-dialog'
import { OvertimeDeleteDialog } from './overtime-delete-dialog'
import { OvertimeExportButton } from './overtime-export-button'
import type { OvertimeTabProps } from './overtime-page'
import {
  OvertimeEmpty,
  OvertimeFilterButton,
  OvertimeFilterPanel,
  OvertimeListFooter,
  OvertimeStatusChip,
  OvertimeTitleRow,
} from './overtime-parts'
import { OvertimeViewDialog } from './overtime-view-dialog'

const PAGE_SIZE = 10

type Dialog =
  | { type: 'apply' }
  | { type: 'view' | 'edit' | 'delete' | 'cancel'; application: OvertimeApplication }
  | null

/** The columns as drawn: Sr.#, Date (From), Date (To), Applied / Approved overtime minutes, Reason, Status. */
function columnsFor(page: number): DataTableColumn<OvertimeApplication>[] {
  return [
    {
      id: 'serial',
      header: 'Sr.#',
      mobile: 'hidden',
      cell: (_row, index) => serialLabel(page, PAGE_SIZE, index),
    },
    {
      id: 'from',
      header: 'Date (From)',
      mobile: 'heading',
      className: 'max-w-28 whitespace-normal',
      cell: (row) => stampLabel(row.date, row.startTime),
    },
    {
      id: 'to',
      header: 'Date (To)',
      className: 'max-w-28 whitespace-normal',
      cell: (row) => stampLabel(row.date, row.endTime),
    },
    {
      id: 'applied',
      header: 'Applied overtime minutes',
      cell: (row) => String(row.appliedMinutes),
    },
    {
      id: 'approved',
      header: 'Approved overtime minutes',
      cell: (row) => (row.approvedMinutes === null ? '—' : String(row.approvedMinutes)),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-28 max-w-48 whitespace-normal',
      cell: (row) => (
        <span className="line-clamp-2" title={row.reason ?? undefined}>
          {row.reason ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <OvertimeStatusChip status={row.status} />,
    },
  ]
}

/**
 * My Overtime (frame 2785:14902): your overtime requests (`GET /requests/overtime?view=my`) with
 * Filter, Export and "+ Apply Overtime"; the row menu opens View (where images can still be
 * added), Edit and Delete on a pending request nobody has acted on (the popups check), and
 * Cancel on a pending request (withdrawn at once) or an approved one (a cancellation for the
 * approvers). Edit follows the create permission and Delete the cancel one, as on Requests.
 */
export function MyOvertimeTab({ search, update }: OvertimeTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [filtersOpen, setFiltersOpen] = useState(
    [search.from, search.to, search.status].some(Boolean),
  )
  const user = useAuthStore((state) => state.user)
  // A user with no employee record (an administrator) has no overtime of their own.
  const canFile = useCan('requests.overtime.create')
  const canApply = canFile && user?.employeeId !== null
  const canCancel = useCan('requests.overtime.cancel')
  const status = OVERTIME_STATUSES.find((item) => item === search.status)
  const filters = {
    view: 'my' as const,
    ...(status ? { status } : {}),
    ...(search.from ? { from: search.from } : {}),
    ...(search.to ? { to: search.to } : {}),
  }
  const list = useOvertimeRequests({ ...filters, page: search.page, pageSize: PAGE_SIZE })
  const meta = list.data?.meta
  const filtered = [search.from, search.to, status].some(Boolean)
  const close = () => {
    setDialog(null)
  }

  return (
    <>
      <OvertimeTitleRow title="My Overtime" titleId="my-overtime-title">
        <OvertimeFilterButton
          open={filtersOpen}
          onClick={() => {
            setFiltersOpen((value) => !value)
          }}
        />
        <OvertimeExportButton params={filters} disabled={!meta || meta.total === 0} />
        {canApply && (
          <Button
            onClick={() => {
              setDialog({ type: 'apply' })
            }}
            className={overtimeNavyButtonClass}
          >
            + Apply Overtime
          </Button>
        )}
      </OvertimeTitleRow>

      {filtersOpen && (
        <OvertimeFilterPanel>
          <DateBox
            label="From"
            value={search.from ?? ''}
            maxDate={new Date()}
            onChange={(value) => {
              update({ from: value, to: search.to && search.to < value ? value : search.to })
            }}
          />
          <DateBox
            label="To"
            value={search.to ?? ''}
            minDate={search.from ? parseDateValue(search.from) : undefined}
            maxDate={new Date()}
            onChange={(value) => {
              update({ to: value })
            }}
          />
          <FilterSelect
            label="Status"
            showLabel
            allLabel="All statuses"
            options={OVERTIME_STATUSES.map((status) => ({
              value: status,
              label: OVERTIME_STATUS_LABELS[status],
            }))}
            value={status}
            onChange={(picked) => {
              update({ status: OVERTIME_STATUSES.find((item) => item === picked) })
            }}
          />
          {filtered && (
            <Button
              variant="ghost"
              className="self-end justify-self-start text-sm text-sidebar dark:text-heading"
              onClick={() => {
                update({ from: undefined, to: undefined, status: undefined })
              }}
            >
              Clear filters
            </Button>
          )}
        </OvertimeFilterPanel>
      )}

      {list.isError ? (
        <ErrorState
          title="Could not load your overtime"
          message={list.error.message}
          onRetry={() => void list.refetch()}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={columnsFor(meta?.page ?? search.page)}
          data={list.data?.data ?? []}
          getRowId={(row) => row.id}
          caption="My Overtime"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          className={overtimeTableClass}
          emptyState={
            <OvertimeEmpty>
              {filtered ? 'No overtime requests match.' : 'You have not applied for overtime yet.'}
            </OvertimeEmpty>
          }
          rowActions={(row) => (
            <RowActionsMenu
              label={`Actions for ${row.code}`}
              itemClassName={rowMenuItemClass.poppins}
              actions={[
                {
                  label: 'View',
                  onSelect: () => {
                    setDialog({ type: 'view', application: row })
                  },
                },
                ...(row.status === 'pending' && canFile
                  ? [
                      {
                        label: 'Edit',
                        onSelect: () => {
                          setDialog({ type: 'edit', application: row })
                        },
                      },
                    ]
                  : []),
                ...(row.status === 'pending' && canCancel
                  ? [
                      {
                        label: 'Delete',
                        variant: 'destructive' as const,
                        onSelect: () => {
                          setDialog({ type: 'delete', application: row })
                        },
                      },
                    ]
                  : []),
                ...((row.status === 'pending' || row.status === 'approved') && canCancel
                  ? [
                      {
                        label: 'Cancel',
                        variant: 'destructive' as const,
                        onSelect: () => {
                          setDialog({ type: 'cancel', application: row })
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}
        />
      )}

      <OvertimeListFooter
        meta={meta}
        noun="requests"
        disabled={list.isFetching}
        onPageChange={(page) => {
          update({ page })
        }}
      />

      {dialog?.type === 'apply' && <ApplyOvertimeDialog onClose={close} />}
      {dialog?.type === 'edit' && (
        <ApplyOvertimeDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'delete' && (
        <OvertimeDeleteDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'view' && <OvertimeViewDialog id={dialog.application.id} onClose={close} />}
      {dialog?.type === 'cancel' && (
        <OvertimeCancelDialog application={dialog.application} onClose={close} />
      )}
    </>
  )
}
