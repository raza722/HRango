import { useEffect, useId, useRef, useState } from 'react'
import { Search } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  Pagination,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { DEVICES_PAGE_SIZE, type DevicesSearch } from '../../devices-routing'
import { DEVICE_CODES, useBranchOptions, useDevices, useOpenedAt } from '../../hooks/use-devices'
import { type BiometricDevice, DEVICE_STATUSES } from '../../types/devices.types'
import { deviceAddress } from '../../utils/device-format'
import {
  compactTableClass,
  navyButtonClass,
  pageTitleClass,
  toolbarButtonClass,
} from '../../utils/settings-styles'
import { ActiveChip } from '../settings/settings-list'
import { FilterSelect } from '../shared/filter-select'
import { DeleteDeviceDialog } from './delete-device-dialog'
import { LastSynced } from './device-parts'

const STATUS_LABELS = { active: 'Active', inactive: 'Inactive' } as const

/** The search box: types at once, writes the URL when typing pauses, follows outside changes. */
function DeviceSearch({
  value,
  onSearch,
}: {
  value: string | undefined
  onSearch: (q?: string) => void
}) {
  const [text, setText] = useState(value ?? '')
  const [shown, setShown] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  if (value !== shown) {
    // The URL changed from outside (back button, a link): show its value.
    setShown(value)
    if ((value ?? '') !== text.trim()) setText(value ?? '')
  }
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )
  return (
    <div className="grid min-w-0 gap-1.5">
      <span aria-hidden="true" className="text-sm font-medium text-heading">
        Search
      </span>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-label"
        />
        <Input
          type="search"
          aria-label="Search devices"
          placeholder="Code, name, serial no or IP"
          value={text}
          onChange={(event) => {
            const next = event.target.value
            setText(next)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => {
              onSearch(next.trim() || undefined)
            }, 300)
          }}
          className="bg-card pl-9 sm:pl-9"
        />
      </div>
    </div>
  )
}

/**
 * The device list: search, Branch and Status filters, then code, name, model, serial no,
 * IP:port, branch, status, last sync (flagged when it is old) and how many people are
 * enrolled. A name opens the device; ⋮ has View, Edit and Delete as the user may.
 */
export function DevicesList({
  search,
  onSearchChange,
}: {
  search: DevicesSearch
  onSearchChange: (patch: Partial<DevicesSearch>) => void
}) {
  const titleId = useId()
  const now = useOpenedAt()
  const can = {
    create: useCan(DEVICE_CODES.create),
    edit: useCan(DEVICE_CODES.edit),
    delete: useCan(DEVICE_CODES.delete),
  }
  const branches = useBranchOptions()
  const [deleting, setDeleting] = useState<BiometricDevice | null>(null)
  const list = useDevices({
    page: search.page,
    pageSize: DEVICES_PAGE_SIZE,
    q: search.q,
    branchId: search.branchId,
    status: search.status,
  })
  const filter = (patch: Partial<DevicesSearch>) => {
    onSearchChange({ ...patch, page: 1 })
  }
  const filtered = Boolean(search.q ?? search.branchId ?? search.status)
  const meta = list.data?.meta
  const open = (device: BiometricDevice) => {
    onSearchChange({ device: device.id, tab: undefined })
  }

  const columns: DataTableColumn<BiometricDevice>[] = [
    { id: 'code', header: 'Code', className: 'whitespace-nowrap', cell: (row) => row.code },
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      className: 'min-w-24 whitespace-normal',
      cell: (row) => (
        <button
          type="button"
          onClick={() => {
            open(row)
          }}
          className="w-fit rounded-sm text-left font-medium text-person underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {row.name}
        </button>
      ),
    },
    {
      id: 'model',
      header: 'Model',
      className: 'min-w-24 whitespace-normal',
      cell: (row) => row.model ?? '—',
    },
    { id: 'serial', header: 'Serial No', cell: (row) => row.serialNo ?? '—' },
    {
      id: 'address',
      header: 'IP:Port',
      className: 'whitespace-nowrap',
      cell: (row) => deviceAddress(row),
    },
    {
      id: 'branch',
      header: 'Branch',
      className: 'min-w-24 whitespace-normal',
      cell: (row) => row.branchName ?? '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <ActiveChip active={row.status === 'active'} />,
    },
    {
      id: 'synced',
      header: 'Last Synced',
      className: 'min-w-24 whitespace-normal',
      cell: (row) => <LastSynced lastSyncedAt={row.lastSyncedAt} now={now} />,
    },
    {
      id: 'enrolled',
      header: 'Enrolled',
      align: 'center',
      cell: (row) => <span className="tabular-nums">{row.enrolledCount}</span>,
    },
  ]

  const actionsFor = (row: BiometricDevice): RowAction[] => [
    {
      label: 'View',
      onSelect: () => {
        open(row)
      },
    },
    ...(can.edit
      ? [
          {
            label: 'Edit',
            onSelect: () => {
              onSearchChange({ edit: row.id })
            },
          },
        ]
      : []),
    ...(can.delete
      ? [
          {
            label: 'Delete',
            variant: 'destructive' as const,
            onSelect: () => {
              setDeleting(row)
            },
          },
        ]
      : []),
  ]

  return (
    <section
      aria-labelledby={titleId}
      className="grid min-w-0 gap-4 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 id={titleId} className={pageTitleClass}>
            Biometric Devices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The machines people punch on, who is enrolled on each, and the punches they hand over.
          </p>
        </div>
        {can.create && (
          <Button
            onClick={() => {
              onSearchChange({ edit: 'new' })
            }}
            className={cn(toolbarButtonClass, 'px-5', navyButtonClass)}
          >
            + Create
          </Button>
        )}
      </div>

      <div className="@container rounded-md bg-muted/50 p-3">
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
          <DeviceSearch
            value={search.q}
            onSearch={(q) => {
              filter({ q })
            }}
          />
          <FilterSelect
            label="Branch"
            showLabel
            allLabel="All branches"
            options={branches.options}
            value={search.branchId}
            onChange={(branchId) => {
              filter({ branchId })
            }}
          />
          <FilterSelect
            label="Status"
            showLabel
            allLabel="Active and inactive"
            options={DEVICE_STATUSES.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
            }))}
            value={search.status}
            onChange={(status) => {
              filter({ status: DEVICE_STATUSES.find((item) => item === status) })
            }}
          />
        </div>
      </div>

      {list.isError ? (
        <ErrorState
          title="Could not load the devices"
          message={list.error.message}
          onRetry={() => void list.refetch()}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          getRowId={(row) => row.id}
          caption="Biometric devices"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          loadingRowCount={5}
          className={compactTableClass}
          emptyState={
            <p className="py-10 text-center text-sm text-muted-foreground">
              {filtered
                ? 'No devices match these filters.'
                : can.create
                  ? 'No biometric devices yet. Use + Create to add the first one.'
                  : 'No biometric devices yet.'}
            </p>
          }
          rowActions={(row) => (
            <RowActionsMenu
              label={`Actions for ${row.name} (${row.code})`}
              itemClassName={rowMenuItemClass.poppins}
              actions={actionsFor(row)}
            />
          )}
        />
      )}

      {!list.isError && meta && meta.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing {(meta.page - 1) * meta.pageSize + 1} to{' '}
            {Math.min(meta.page * meta.pageSize, meta.total)} of{' '}
            {meta.total === 1 ? '1 device' : `${String(meta.total)} devices`}
          </p>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            disabled={list.isFetching}
            onPageChange={(page) => {
              onSearchChange({ page })
            }}
          />
        </div>
      )}

      {deleting && (
        <DeleteDeviceDialog
          device={deleting}
          onClose={() => {
            setDeleting(null)
          }}
        />
      )}
    </section>
  )
}
