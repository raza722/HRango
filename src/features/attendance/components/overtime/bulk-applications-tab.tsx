import { useState } from 'react'

import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'

import { useOvertimeRequests } from '../../hooks/use-overtime'
import type { OvertimeApplication } from '../../types/overtime.types'
import {
  clockLabel,
  dayLabel,
  durationLabel,
  serialLabel,
  spanMinutes,
} from '../../utils/overtime-format'
import { overtimeNavyButtonClass, overtimeTableClass } from '../../utils/overtime-styles'
import { BulkRequestDialog } from './bulk-request-dialog'
import { OvertimeExportButton } from './overtime-export-button'
import type { OvertimeTabProps } from './overtime-page'
import {
  OvertimeEmpty,
  OvertimeListFooter,
  OvertimePersonCell,
  OvertimeStatusChip,
  OvertimeTitleRow,
} from './overtime-parts'
import { OvertimeViewDialog } from './overtime-view-dialog'

const PAGE_SIZE = 10

type Dialog = { type: 'create' } | { type: 'view'; id: string } | null

/**
 * The columns as drawn: Sr.#, Reg No# (the request code), Employees, Start Time, End Time,
 * Date, Applied Minutes, Approved Minutes, Total Overtime (the window between the two clocks)
 * and, where the frame has Type (Mandatory / Voluntary, which the API does not keep), Status.
 */
function columnsFor(page: number): DataTableColumn<OvertimeApplication>[] {
  return [
    {
      id: 'serial',
      header: 'Sr.#',
      mobile: 'hidden',
      cell: (_row, index) => serialLabel(page, PAGE_SIZE, index),
    },
    { id: 'regNo', header: 'Reg No#', cell: (row) => row.code },
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
      id: 'total',
      header: 'Total Overtime',
      cell: (row) => durationLabel(Math.max(0, spanMinutes(row.startTime, row.endTime))),
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
 * Bulk Applications (frame 2801:16065): everyone's overtime requests (`GET
 * /requests/overtime?view=all`), newest first, with "+ Create" (the Create Bulk Overtime
 * Request popup, which files one request per person and then opens the Bulk Overtime sheet).
 * The API keeps no mark of a bulk request, so the list holds every overtime request.
 */
export function BulkApplicationsTab({ search, update }: OvertimeTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const canCreate = useCan('requests.overtime.create')
  const list = useOvertimeRequests({ view: 'all', page: search.page, pageSize: PAGE_SIZE })
  const meta = list.data?.meta
  const close = () => {
    setDialog(null)
  }

  return (
    <>
      <OvertimeTitleRow title="Bulk Applications" titleId="bulk-applications-title">
        <OvertimeExportButton params={{ view: 'all' }} disabled={!meta || meta.total === 0} />
        {canCreate && (
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={overtimeNavyButtonClass}
          >
            + Create
          </Button>
        )}
      </OvertimeTitleRow>

      {list.isError ? (
        <ErrorState
          title="Could not load the overtime requests"
          message={list.error.message}
          onRetry={() => void list.refetch()}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={columnsFor(meta?.page ?? search.page)}
          data={list.data?.data ?? []}
          getRowId={(row) => row.id}
          caption="Bulk Applications"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          className={overtimeTableClass}
          emptyState={<OvertimeEmpty>No overtime requests yet.</OvertimeEmpty>}
          rowActions={(row) => (
            <RowActionsMenu
              label={`Actions for ${row.code}, ${row.employeeName}`}
              itemClassName={rowMenuItemClass.poppins}
              actions={[
                {
                  label: 'View',
                  onSelect: () => {
                    setDialog({ type: 'view', id: row.id })
                  },
                },
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

      {dialog?.type === 'create' && (
        <BulkRequestDialog
          onClose={close}
          onCreated={() => {
            update({ tab: 'bulk-overtime' })
          }}
        />
      )}
      {dialog?.type === 'view' && <OvertimeViewDialog id={dialog.id} onClose={close} />}
    </>
  )
}
