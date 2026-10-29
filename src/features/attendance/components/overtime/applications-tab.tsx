import { useEffect, useRef, useState } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { parseDateValue } from '@/lib/date'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { useOvertimeApprovals } from '../../hooks/use-overtime'
import {
  OVERTIME_APPROVAL_BOXES,
  OVERTIME_STATUSES,
  type OvertimeApplication,
  type OvertimeStatusFilter,
} from '../../types/overtime.types'
import { clockLabel, dayLabel, OVERTIME_BOX_LABELS, serialLabel } from '../../utils/overtime-format'
import {
  approvedToggleClass,
  overtimeOutlineButtonClass,
  overtimeSearchClass,
  overtimeTableClass,
  unapprovedToggleClass,
} from '../../utils/overtime-styles'
import { DateBox } from '../shared/date-box'
import { EmployeeFilter } from '../shared/employee-filter'
import { FilterSelect } from '../shared/filter-select'
import {
  OvertimeBulkRejectDialog,
  OvertimeConsentDialog,
  OvertimeForwardDialog,
} from './overtime-approval-dialogs'
import { OvertimeDecisionDialog } from './overtime-decision-dialog'
import { OvertimeSearchIcon } from './overtime-icons'
import type { OvertimeTabProps } from './overtime-page'
import {
  OvertimeEmpty,
  OvertimeFilterButton,
  OvertimeFilterPanel,
  OvertimeListFooter,
  OvertimePersonCell,
  OvertimeStatusChip,
  OvertimeTitleRow,
} from './overtime-parts'
import { OvertimeViewDialog } from './overtime-view-dialog'

const PAGE_SIZE = 10

type Dialog =
  | {
      type: 'view' | 'decide' | 'forward' | 'consent'
      application: OvertimeApplication
    }
  | { type: 'bulk-reject'; applications: OvertimeApplication[] }
  | null

/** The tick column for Reject Selected: only rows waiting for your decision can be ticked. */
function selectColumn(
  rows: readonly OvertimeApplication[],
  tickable: (row: OvertimeApplication) => boolean,
  selected: ReadonlySet<string>,
  onChange: (next: ReadonlySet<string>) => void,
): DataTableColumn<OvertimeApplication> {
  const open = rows.filter(tickable)
  const all = open.length > 0 && open.every((row) => selected.has(row.id))
  return {
    id: 'select',
    header: (
      <Checkbox
        tone="navy"
        aria-label="Select all applications waiting for your decision"
        checked={all}
        disabled={open.length === 0}
        onCheckedChange={(checked) => {
          onChange(checked === true ? new Set(open.map((row) => row.id)) : new Set())
        }}
      />
    ),
    className: 'w-10',
    mobile: 'hidden',
    cell: (row) => (
      <Checkbox
        tone="navy"
        aria-label={`Select ${row.code}`}
        checked={selected.has(row.id)}
        disabled={!tickable(row)}
        onCheckedChange={(checked) => {
          const next = new Set(selected)
          if (checked === true) next.add(row.id)
          else next.delete(row.id)
          onChange(next)
        }}
      />
    ),
  }
}

/** The columns as drawn: Sr.#, Employees, Start Time, End Time, Date, Applied / Approved Minutes, Status. */
function columnsFor(page: number): DataTableColumn<OvertimeApplication>[] {
  return [
    {
      id: 'serial',
      header: 'Sr.#',
      mobile: 'hidden',
      cell: (_row, index) => serialLabel(page, PAGE_SIZE, index),
    },
    {
      id: 'employee',
      header: 'Employees',
      mobile: 'heading',
      className: 'min-w-32',
      cell: (row) => <OvertimePersonCell name={row.employeeName} code={row.employeeCode} />,
    },
    { id: 'start', header: 'Start Time', cell: (row) => clockLabel(row.startTime) },
    { id: 'end', header: 'End Time', cell: (row) => clockLabel(row.endTime) },
    {
      id: 'date',
      header: 'Date',
      cell: (row) => <span className="whitespace-nowrap">{dayLabel(row.date)}</span>,
    },
    {
      id: 'applied',
      header: 'Applied Minutes',
      align: 'center',
      className: 'max-w-20 whitespace-normal',
      cell: (row) => String(row.appliedMinutes),
    },
    {
      id: 'approved',
      header: 'Approved Minutes',
      align: 'center',
      className: 'max-w-20 whitespace-normal',
      cell: (row) => (row.approvedMinutes === null ? '—' : String(row.approvedMinutes)),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <OvertimeStatusChip status={row.status} />,
    },
  ]
}

/** Approved / Unapproved as drawn (navy and Tawny Port): the status switch; the chosen one stays bright. */
function StatusToggle({
  value,
  onChange,
}: {
  value: OvertimeStatusFilter | undefined
  onChange: (next: 'approved' | 'unapproved' | undefined) => void
}) {
  const choices = [
    { value: 'approved', label: 'Approved', className: approvedToggleClass },
    { value: 'unapproved', label: 'Unapproved', className: unapprovedToggleClass },
  ] as const
  return (
    <div role="group" aria-label="Status" className="flex flex-wrap gap-2.5">
      {choices.map((choice) => {
        const pressed = value === choice.value
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              onChange(pressed ? undefined : choice.value)
            }}
            className={cn(
              choice.className,
              'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              value !== undefined && !pressed && 'opacity-50',
            )}
          >
            {choice.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Overtime Applications (frame 2801:15692): the overtime that reached you for approval
 * (`GET /requests/approvals?type=overtime`, the Requested box; Delegates, Consents and
 * Cancellations in Filter) with the Search box, the filled Filter, the Approved / Unapproved
 * switch (Unapproved: waiting for your decision), and the row menu's View, Approve/Reject and
 * Forward (while it waits for you), or Consent in the Consents box. Rows waiting for you can be
 * ticked for Reject Selected (`bulk-reject`); bulk approving stays on the Bulk Overtime sheet,
 * which checks the approved minutes against the daily policy. Buttons follow
 * `requests.approvals.*`.
 */
export function ApplicationsTab({ search, update }: OvertimeTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(
    [search.from, search.to, search.employeeId].some(Boolean),
  )
  const canApprove = useCan('requests.approvals.approve')
  const canReject = useCan('requests.approvals.reject')
  const box = search.box ?? 'requested'
  const consents = box === 'consents'
  // Unapproved: what waits for your decision (the approvals' pending).
  const status =
    search.status === 'unapproved'
      ? 'pending'
      : OVERTIME_STATUSES.find((item) => item === search.status)
  // The Search box: typed text reaches the URL once typing pauses.
  const [text, setText] = useState(search.q ?? '')
  const timer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )
  const type = (value: string) => {
    setText(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      update({ q: value.trim() || undefined })
    }, 300)
  }
  const list = useOvertimeApprovals({
    box,
    page: search.page,
    pageSize: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(search.q ? { q: search.q } : {}),
    ...(search.from ? { from: search.from } : {}),
    ...(search.to ? { to: search.to } : {}),
    ...(search.employeeId ? { employeeId: search.employeeId } : {}),
  })
  const meta = list.data?.meta
  const rows = list.data?.data ?? []
  const tickable = (row: OvertimeApplication) => !consents && canReject && row.isWaiting === true
  // Only the ticked rows of this page that still wait (a refetch may have moved some on).
  const chosen = rows.filter((row) => selected.has(row.id) && tickable(row))
  const filtered = [search.from, search.to, search.employeeId, search.q, status].some(Boolean)
  // The filtered person's name, from their own rows, until the picker has read them.
  const filteredRow = search.employeeId
    ? list.data?.data.find((row) => row.employeeId === search.employeeId)
    : undefined
  const close = () => {
    setDialog(null)
  }

  return (
    <>
      <OvertimeTitleRow title="Overtime Applications" titleId="overtime-applications-title">
        <div className="relative">
          <OvertimeSearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-[0.9375rem] -translate-y-1/2 text-[#A4A4A4]"
          />
          <Input
            type="search"
            aria-label="Search applications"
            placeholder="Search"
            value={text}
            onChange={(event) => {
              type(event.target.value)
            }}
            className={cn(overtimeSearchClass, 'w-full sm:w-[12.5rem]')}
          />
        </div>
        <OvertimeFilterButton
          filled
          open={filtersOpen}
          onClick={() => {
            setFiltersOpen((value) => !value)
          }}
        />
      </OvertimeTitleRow>

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {chosen.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              setDialog({ type: 'bulk-reject', applications: chosen })
            }}
            className={cn(overtimeOutlineButtonClass, 'border-[#7E2448] text-[#7E2448]')}
          >
            Reject Selected ({chosen.length})
          </Button>
        )}
        <StatusToggle
          value={search.status}
          onChange={(status) => {
            update({ status })
          }}
        />
      </div>

      {filtersOpen && (
        <OvertimeFilterPanel>
          <FilterSelect
            label="Approvals"
            showLabel
            options={OVERTIME_APPROVAL_BOXES.map((item) => ({
              value: item,
              label: OVERTIME_BOX_LABELS[item],
            }))}
            value={box}
            onChange={(picked) => {
              const next = OVERTIME_APPROVAL_BOXES.find((item) => item === picked)
              update({ box: next === 'requested' ? undefined : next })
            }}
          />
          <EmployeeFilter
            label="Employee"
            filters={{ permission: 'requests.approvals.view', includeInactive: true }}
            known={
              filteredRow
                ? [
                    {
                      value: filteredRow.employeeId,
                      label: filteredRow.employeeName,
                      hint: filteredRow.employeeCode,
                    },
                  ]
                : undefined
            }
            value={search.employeeId}
            onChange={(employeeId) => {
              update({ employeeId })
            }}
          />
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
        </OvertimeFilterPanel>
      )}

      {list.isError ? (
        <ErrorState
          title="Could not load the overtime applications"
          message={list.error.message}
          onRetry={() => void list.refetch()}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={[
            ...(canReject && !consents
              ? [selectColumn(rows, tickable, selected, setSelected)]
              : []),
            ...columnsFor(meta?.page ?? search.page),
          ]}
          data={rows}
          getRowId={(row) => row.id}
          caption="Overtime Applications"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          className={overtimeTableClass}
          emptyState={
            <OvertimeEmpty>
              {filtered
                ? 'No overtime requests match.'
                : box === 'requested'
                  ? 'No overtime has reached you for approval.'
                  : box === 'delegates'
                    ? 'No overtime is delegated to you.'
                    : consents
                      ? 'No overtime asks for your consent.'
                      : 'No overtime cancellations to decide.'}
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
                ...(!consents && row.isWaiting && (canApprove || canReject)
                  ? [
                      {
                        label: 'Approve/Reject',
                        onSelect: () => {
                          setDialog({ type: 'decide', application: row })
                        },
                      },
                    ]
                  : []),
                // A cancellation is decided, not passed on.
                ...(!consents && row.isWaiting && row.status === 'pending' && canApprove
                  ? [
                      {
                        label: 'Forward',
                        onSelect: () => {
                          setDialog({ type: 'forward', application: row })
                        },
                      },
                    ]
                  : []),
                ...(consents && row.isWaiting
                  ? [
                      {
                        label: 'Consent',
                        onSelect: () => {
                          setDialog({ type: 'consent', application: row })
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

      {dialog?.type === 'view' && (
        <OvertimeViewDialog id={dialog.application.id} via="approvals" onClose={close} />
      )}
      {dialog?.type === 'decide' && (
        <OvertimeDecisionDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'forward' && (
        <OvertimeForwardDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'consent' && (
        <OvertimeConsentDialog application={dialog.application} onClose={close} />
      )}
      {dialog?.type === 'bulk-reject' && (
        <OvertimeBulkRejectDialog
          applications={dialog.applications}
          onClose={close}
          onDone={(rejected) => {
            setSelected((prev) => new Set([...prev].filter((id) => !rejected.includes(id))))
          }}
        />
      )}
    </>
  )
}
